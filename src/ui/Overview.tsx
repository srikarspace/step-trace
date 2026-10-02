import { useEffect, useRef, useState } from 'react'
import type { Step } from '../parser/types'
import { formatMs } from './format'

type Props = {
  steps: Step[]
  /** Session span, epoch ms. */
  start: number
  end: number
  selectedId: string | null
  range: readonly [number, number] | null
  /** Colours are read from CSS, so a theme change must redraw. */
  theme: 'light' | 'dark'
  onRange: (range: [number, number] | null) => void
}

const AXIS_H = 18
const BAR_H = 4
const LANE_GAP = 2
const TICK_STEPS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10_000, 20_000, 60_000, 120_000, 300_000]

function niceStep(spanMs: number, widthPx: number): number {
  const target = spanMs / Math.max(1, widthPx / 110)
  return TICK_STEPS.find((s) => s >= target) ?? TICK_STEPS.at(-1)!
}

/** Greedy packing, like DevTools: each bar goes in the first lane that is free. */
function packLanes(steps: Step[], pxPerMs: number): number[] {
  const laneEnds: number[] = []
  return steps.map((step) => {
    const x0 = step.tsStart * pxPerMs
    const x1 = Math.max(x0 + 2, (step.tsEnd ?? step.tsStart) * pxPerMs) + LANE_GAP
    let lane = laneEnds.findIndex((end) => end <= x0)
    if (lane === -1) lane = laneEnds.length
    laneEnds[lane] = x1
    return lane
  })
}

export function Overview({ steps, start, end, selectedId, range, theme, onRange }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [drag, setDrag] = useState<[number, number] | null>(null)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSize({ w: entry.contentRect.width, h: entry.contentRect.height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const span = Math.max(1, end - start)
  const pxPerMs = size.w / span
  const toX = (ts: number) => (ts - start) * pxPerMs
  const toTs = (x: number) => start + x / Math.max(pxPerMs, 1e-9)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || size.w === 0) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(size.w * dpr)
    canvas.height = Math.round(size.h * dpr)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, size.w, size.h)

    const css = getComputedStyle(canvas)
    const color = (name: string) => css.getPropertyValue(name).trim()
    const colors: Record<string, string> = {
      model: color('--c-model'),
      read: color('--c-read'),
      mutate: color('--c-mutate'),
      meta: color('--c-meta'),
    }

    // Grid and axis labels.
    const tick = niceStep(span, size.w)
    ctx.font = '11px system-ui, sans-serif'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'top'
    for (let t = tick; t <= span; t += tick) {
      const x = Math.round(t * pxPerMs) + 0.5
      ctx.fillStyle = color('--border-soft')
      ctx.fillRect(x, 0, 1, size.h)
      ctx.fillStyle = color('--text-muted')
      ctx.fillText(formatMs(t), x - 3, 3)
    }

    // Landmarks: prompts and errors, full height.
    for (const step of steps) {
      const isError = step.status === 'error'
      if (step.kind !== 'prompt' && !isError) continue
      ctx.fillStyle = isError ? color('--c-error') : colors.model!
      ctx.fillRect(Math.round(toX(step.tsStart)), 0, 1, size.h)
    }

    // Bars.
    const rel = steps.map((s) => ({ ...s, tsStart: s.tsStart - start, tsEnd: s.tsEnd === null ? null : s.tsEnd - start }))
    const lanes = packLanes(rel, pxPerMs)
    const maxLanes = Math.max(1, Math.floor((size.h - AXIS_H - 4) / (BAR_H + LANE_GAP)))
    steps.forEach((step, i) => {
      const lane = Math.min(lanes[i]!, maxLanes - 1)
      const x0 = toX(step.tsStart)
      const x1 = Math.max(x0 + 2, toX(step.tsEnd ?? step.tsStart))
      const y = AXIS_H + lane * (BAR_H + LANE_GAP)
      ctx.globalAlpha = step.kind === 'thinking' ? 0.55 : 1
      ctx.fillStyle = step.status === 'error' ? color('--c-error') : colors[step.effect]!
      ctx.fillRect(x0, y, x1 - x0, BAR_H)
      if (step.id === selectedId) {
        ctx.globalAlpha = 1
        ctx.strokeStyle = color('--text')
        ctx.strokeRect(x0 - 1.5, y - 1.5, x1 - x0 + 3, BAR_H + 3)
      }
    })
    ctx.globalAlpha = 1

    // Brush: dim outside the selected range.
    const shown = drag ? ([Math.min(...drag), Math.max(...drag)] as const) : range ? [toX(range[0]), toX(range[1])] : null
    if (shown) {
      ctx.fillStyle = 'rgb(128 128 128 / 0.25)'
      ctx.fillRect(0, 0, shown[0], size.h)
      ctx.fillRect(shown[1], 0, size.w - shown[1], size.h)
      ctx.fillStyle = color('--accent')
      ctx.fillRect(shown[0], 0, 1, size.h)
      ctx.fillRect(shown[1], 0, 1, size.h)
    }
  }, [steps, start, span, size, selectedId, range, drag, pxPerMs, theme])

  function localX(e: React.PointerEvent): number {
    const rect = e.currentTarget.getBoundingClientRect()
    return Math.min(size.w, Math.max(0, e.clientX - rect.left))
  }

  return (
    <div
      ref={wrapRef}
      className="overview"
      title="Drag to filter by time. Click to clear."
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        const x = localX(e)
        setDrag([x, x])
      }}
      onPointerMove={(e) => drag && setDrag([drag[0], localX(e)])}
      onPointerCancel={() => setDrag(null)}
      onPointerUp={() => {
        if (!drag) return
        const [a, b] = [Math.min(...drag), Math.max(...drag)]
        setDrag(null)
        onRange(b - a < 3 ? null : [toTs(a), toTs(b)])
      }}
    >
      <canvas ref={canvasRef} />
    </div>
  )
}
