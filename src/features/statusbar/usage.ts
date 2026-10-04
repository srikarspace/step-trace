import type { Step } from '@/parser/types'

export type Totals = { steps: number; tools: number; errors: number; tokensIn: number; tokensOut: number; cost: number | null }

export function totals(steps: Step[]): Totals {
  const sum: Totals = { steps: steps.length, tools: 0, errors: 0, tokensIn: 0, tokensOut: 0, cost: null }
  for (const step of steps) {
    if (step.kind === 'tool') sum.tools += 1
    if (step.status === 'error') sum.errors += 1
    if (!step.usage) continue
    sum.tokensIn += step.usage.in
    sum.tokensOut += step.usage.out
    if (step.usage.cost !== null) sum.cost = (sum.cost ?? 0) + step.usage.cost
  }
  return sum
}
