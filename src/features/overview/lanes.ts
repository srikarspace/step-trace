import type { Step } from '@/parser/types'

export const AXIS_HEIGHT = 18
export const BAR_HEIGHT = 4
export const LANE_GAP = 2
const MIN_BAR_WIDTH = 2

export type BarLayout = {
  x0: Float64Array
  x1: Float64Array
  lane: Uint16Array
}

export function laneCapacity(height: number): number {
  return Math.max(1, Math.floor((height - AXIS_HEIGHT - 4) / (BAR_HEIGHT + LANE_GAP)))
}

export function laneY(lane: number): number {
  return AXIS_HEIGHT + lane * (BAR_HEIGHT + LANE_GAP)
}

export function layoutBars(steps: Step[], start: number, pxPerMs: number, lanes: number): BarLayout {
  const x0 = new Float64Array(steps.length)
  const x1 = new Float64Array(steps.length)
  const lane = new Uint16Array(steps.length)
  const laneEnds = new Float64Array(lanes).fill(-Infinity)
  const last = lanes - 1
  steps.forEach((step, i) => {
    const a = (step.tsStart - start) * pxPerMs
    const b = Math.max(a + MIN_BAR_WIDTH, ((step.tsEnd ?? step.tsStart) - start) * pxPerMs)
    let k = 0
    while (k < last && laneEnds[k]! > a) k += 1
    laneEnds[k] = Math.max(laneEnds[k]!, b + LANE_GAP)
    x0[i] = a
    x1[i] = b
    lane[i] = k
  })
  return { x0, x1, lane }
}
