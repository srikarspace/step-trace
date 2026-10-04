import { useEffect, useRef, useState } from 'react'
import type { Step } from '@/parser/types'
import type { Range, Theme } from '@/store/ui'
import { drawBase, drawOverlay, fitCanvas, readPalette } from './draw'
import { laneCapacity, layoutBars } from './lanes'

type Props = {
  steps: Step[]
  start: number
  end: number
  selected: Step | undefined
  range: Range | null
  theme: Theme
  onRange: (range: Range | null) => void
}

const MIN_BRUSH_PX = 3

function useSize(ref: React.RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return size
}

export function Overview({ steps, start, end, selected, range, theme, onRange }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const baseRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const dragRef = useRef<[number, number] | null>(null)
  const frameRef = useRef(0)
  const { width, height } = useSize(wrapRef)

  const span = Math.max(1, end - start)
  const pxPerMs = width / span
  const lanes = laneCapacity(height)
  const layout = layoutBars(steps, start, pxPerMs, lanes)
  const selectedIndex = selected ? selected.index : -1
  const toX = (ts: number) => (ts - start) * pxPerMs
  const toTs = (x: number) => start + x / Math.max(pxPerMs, 1e-9)

  useEffect(() => {
    const canvas = baseRef.current
    if (!canvas || width === 0) return
    const frame = requestAnimationFrame(() => {
      const ctx = fitCanvas(canvas, width, height)
      if (ctx) drawBase(ctx, { steps, layout, lanes, width, height, span, palette: readPalette(canvas) })
    })
    return () => cancelAnimationFrame(frame)
  }, [steps, layout, lanes, width, height, span, theme])

  function paintOverlay() {
    const canvas = overlayRef.current
    if (!canvas || width === 0) return
    const ctx = fitCanvas(canvas, width, height)
    if (!ctx) return
    const drag = dragRef.current
    const brush = drag
      ? ([Math.min(...drag), Math.max(...drag)] as const)
      : range
        ? ([toX(range[0]), toX(range[1])] as const)
        : null
    drawOverlay(ctx, { layout, selected: selectedIndex, brush, width, height, palette: readPalette(canvas) })
  }

  function schedulePaint() {
    cancelAnimationFrame(frameRef.current)
    frameRef.current = requestAnimationFrame(paintOverlay)
  }

  useEffect(schedulePaint)

  function localX(e: React.PointerEvent) {
    const rect = e.currentTarget.getBoundingClientRect()
    return Math.min(width, Math.max(0, e.clientX - rect.left))
  }

  return (
    <div
      ref={wrapRef}
      title="Drag to filter by time. Click to clear."
      className="relative h-[84px] flex-none cursor-crosshair border-b"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        const x = localX(e)
        dragRef.current = [x, x]
        schedulePaint()
      }}
      onPointerMove={(e) => {
        const drag = dragRef.current
        if (!drag) return
        dragRef.current = [drag[0], localX(e)]
        schedulePaint()
      }}
      onPointerCancel={() => {
        dragRef.current = null
        schedulePaint()
      }}
      onPointerUp={() => {
        const drag = dragRef.current
        if (!drag) return
        dragRef.current = null
        const [a, b] = [Math.min(...drag), Math.max(...drag)]
        onRange(b - a < MIN_BRUSH_PX ? null : [toTs(a), toTs(b)])
        schedulePaint()
      }}
    >
      <canvas ref={baseRef} className="absolute inset-0 size-full" />
      <canvas ref={overlayRef} className="absolute inset-0 size-full" />
    </div>
  )
}
