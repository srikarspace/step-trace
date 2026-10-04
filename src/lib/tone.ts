import type { Effect, Step } from '@/parser/types'

export type Tone = Effect | 'error'

export const toneText: Record<Tone, string> = {
  model: 'text-model',
  read: 'text-read',
  mutate: 'text-mutate',
  meta: 'text-meta',
  error: 'text-error',
}

export const toneVar: Record<Tone, string> = {
  model: 'var(--c-model)',
  read: 'var(--c-read)',
  mutate: 'var(--c-mutate)',
  meta: 'var(--c-meta)',
  error: 'var(--c-error)',
}

export function toneOf(step: Step): Tone {
  return step.status === 'error' ? 'error' : step.effect
}
