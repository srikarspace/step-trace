import type { Step } from '../parser/types'

export function formatMs(ms: number | null): string {
  if (ms === null) return '—'
  if (ms < 1000) return `${Math.round(ms)} ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(2)} s`
  return `${(ms / 60_000).toFixed(1)} min`
}

export function formatBytes(bytes: number | null): string {
  if (bytes === null) return '—'
  return `${(bytes / 1000).toFixed(1)} kB`
}

export function formatCount(n: number): string {
  return n >= 10_000 ? `${(n / 1000).toFixed(1)}k` : n.toLocaleString()
}

/** Size column: tokens out for an LLM call, payload bytes for everything else. */
export function formatSize(step: Step): string {
  if (step.kind === 'llm') return step.usage ? `${formatCount(step.usage.out)} tok` : '—'
  return formatBytes(step.bytes)
}

export function shortModel(model: string | undefined): string {
  if (!model) return ''
  return model.split('/').pop() ?? model
}

const STATUS_LABELS: Record<Step['status'], string> = { ok: 'OK', error: 'Error', pending: 'Pending', none: '' }

/** Display text for a status; filter tokens stay lowercase (`status:error`). */
export function statusLabel(status: Step['status']): string {
  return STATUS_LABELS[status]
}
