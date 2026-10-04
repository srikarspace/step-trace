import { describe, expect, test } from 'bun:test'
import type { Step } from '@/parser/types'
import { layoutBars } from './lanes'

const bar = (tsStart: number, tsEnd: number) => ({ tsStart, tsEnd }) as Step

describe('layoutBars', () => {
  test('given bars that do not overlap, when laid out, then they share the first lane', () => {
    const { lane } = layoutBars([bar(0, 10), bar(20, 30)], 0, 1, 4)
    expect([...lane]).toEqual([0, 0])
  })

  test('given overlapping bars, when laid out, then each takes the first free lane', () => {
    const { lane } = layoutBars([bar(0, 10), bar(5, 15), bar(6, 8), bar(20, 30)], 0, 1, 4)
    expect([...lane]).toEqual([0, 1, 2, 0])
  })

  test('given more overlapping bars than lanes, when laid out, then the rest stack in the last lane', () => {
    const { lane } = layoutBars([bar(0, 10), bar(0, 10), bar(0, 10), bar(0, 10)], 0, 1, 2)
    expect([...lane]).toEqual([0, 1, 1, 1])
  })
})
