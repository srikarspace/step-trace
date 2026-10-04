import { formatMs } from '@/lib/format'
import type { Step } from '@/parser/types'
import { BAR_HEIGHT, laneY, type BarLayout } from './lanes'

const TONES = ['model', 'read', 'mutate', 'meta', 'error'] as const
type ToneName = (typeof TONES)[number]
const MINUTE = 60_000
const TICK_STEPS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10_000, 20_000, 30_000]
const MINUTE_STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 240, 480, 720, 1440].map((m) => m * MINUTE)
const THINKING_ALPHA = 0.55

export type Palette = Record<ToneName | 'grid' | 'label' | 'text' | 'accent', string>

export function readPalette(el: Element): Palette {
  const css = getComputedStyle(el)
  const read = (name: string) => css.getPropertyValue(name).trim()
  return {
    model: read('--c-model'),
    read: read('--c-read'),
    mutate: read('--c-mutate'),
    meta: read('--c-meta'),
    error: read('--c-error'),
    grid: read('--border-soft'),
    label: read('--muted-foreground'),
    text: read('--foreground'),
    accent: read('--primary'),
  }
}

export function fitCanvas(canvas: HTMLCanvasElement, width: number, height: number) {
  const dpr = window.devicePixelRatio || 1
  const w = Math.round(width * dpr)
  const h = Math.round(height * dpr)
  if (canvas.width !== w) canvas.width = w
  if (canvas.height !== h) canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx?.clearRect(0, 0, width, height)
  return ctx
}

function niceStep(spanMs: number, widthPx: number): number {
  const target = spanMs / Math.max(1, widthPx / 110)
  const steps = [...TICK_STEPS, ...MINUTE_STEPS]
  return steps.find((s) => s >= target) ?? Math.ceil(target / MINUTE_STEPS.at(-1)!) * MINUTE_STEPS.at(-1)!
}

function drawAxis(ctx: CanvasRenderingContext2D, width: number, height: number, span: number, palette: Palette) {
  const tick = niceStep(span, width)
  const pxPerMs = width / span
  const lines = new Path2D()
  ctx.font = '11px system-ui, sans-serif'
  ctx.textAlign = 'right'
  ctx.textBaseline = 'top'
  ctx.fillStyle = palette.label
  for (let t = tick; t <= span; t += tick) {
    const x = Math.round(t * pxPerMs) + 0.5
    lines.rect(x, 0, 1, height)
    ctx.fillText(formatMs(t), x - 3, 3)
  }
  ctx.fillStyle = palette.grid
  ctx.fill(lines)
}

function drawLandmarks(ctx: CanvasRenderingContext2D, steps: Step[], layout: BarLayout, height: number, palette: Palette) {
  const prompts = new Path2D()
  const errors = new Path2D()
  steps.forEach((step, i) => {
    const x = Math.round(layout.x0[i]!)
    if (step.status === 'error') errors.rect(x, 0, 1, height)
    else if (step.kind === 'prompt') prompts.rect(x, 0, 1, height)
  })
  ctx.fillStyle = palette.model
  ctx.fill(prompts)
  ctx.fillStyle = palette.error
  ctx.fill(errors)
}

function drawBars(ctx: CanvasRenderingContext2D, steps: Step[], layout: BarLayout, lanes: number, palette: Palette) {
  const kinds = TONES.length * 2
  const paths = Array.from({ length: kinds }, () => new Path2D())
  const runStart = new Float64Array(lanes * kinds).fill(NaN)
  const runEnd = new Float64Array(lanes * kinds)
  const flush = (slot: number) => {
    const start = runStart[slot]!
    if (Number.isNaN(start)) return
    paths[slot % kinds]!.rect(start, laneY(Math.floor(slot / kinds)), runEnd[slot]! - start, BAR_HEIGHT)
  }
  steps.forEach((step, i) => {
    const tone = step.status === 'error' ? 4 : TONES.indexOf(step.effect)
    const slot = layout.lane[i]! * kinds + tone * 2 + (step.kind === 'thinking' ? 1 : 0)
    const a = layout.x0[i]!
    const b = layout.x1[i]!
    if (a <= runEnd[slot]! + 0.5 && b >= runStart[slot]! - 0.5) {
      runStart[slot] = Math.min(runStart[slot]!, a)
      runEnd[slot] = Math.max(runEnd[slot]!, b)
      return
    }
    flush(slot)
    runStart[slot] = a
    runEnd[slot] = b
  })
  for (let slot = 0; slot < runStart.length; slot += 1) flush(slot)
  paths.forEach((path, k) => {
    ctx.globalAlpha = k % 2 === 1 ? THINKING_ALPHA : 1
    ctx.fillStyle = palette[TONES[Math.floor(k / 2)]!]
    ctx.fill(path)
  })
  ctx.globalAlpha = 1
}

type BaseScene = {
  steps: Step[]
  layout: BarLayout
  lanes: number
  width: number
  height: number
  span: number
  palette: Palette
}

export function drawBase(ctx: CanvasRenderingContext2D, scene: BaseScene) {
  drawAxis(ctx, scene.width, scene.height, scene.span, scene.palette)
  drawLandmarks(ctx, scene.steps, scene.layout, scene.height, scene.palette)
  drawBars(ctx, scene.steps, scene.layout, scene.lanes, scene.palette)
}

type OverlayScene = {
  layout: BarLayout
  selected: number
  brush: readonly [number, number] | null
  width: number
  height: number
  palette: Palette
}

export function drawOverlay(ctx: CanvasRenderingContext2D, scene: OverlayScene) {
  const { layout, selected, brush, width, height, palette } = scene
  if (selected >= 0 && selected < layout.x0.length) {
    const x0 = layout.x0[selected]!
    const x1 = layout.x1[selected]!
    ctx.strokeStyle = palette.text
    ctx.strokeRect(x0 - 1.5, laneY(layout.lane[selected]!) - 1.5, x1 - x0 + 3, BAR_HEIGHT + 3)
  }
  if (!brush) return
  const [a, b] = brush
  ctx.fillStyle = 'rgb(128 128 128 / 0.25)'
  ctx.fillRect(0, 0, a, height)
  ctx.fillRect(b, 0, width - b, height)
  ctx.fillStyle = palette.accent
  ctx.fillRect(a, 0, 1, height)
  ctx.fillRect(b, 0, 1, height)
}
