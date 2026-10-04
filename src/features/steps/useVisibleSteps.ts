import { useDeferredValue, useMemo } from 'react'
import { applyFilters } from '@/features/filter/filter'
import type { Session, Step } from '@/parser/types'
import { useUi } from '@/store/ui'

const NO_STEPS: Step[] = []

function sessionSpan(session: Session | undefined) {
  const start = session?.startedAt ?? 0
  let end = session?.endedAt ?? start
  for (const step of session?.steps ?? NO_STEPS) end = Math.max(end, step.tsEnd ?? step.tsStart)
  return { start, end, span: Math.max(1, end - start) }
}

function nearestVisible(shown: Step[], byId: Map<string, Step>, collapsed: ReadonlySet<string>, id: string | null) {
  if (!id || shown.length === 0 || shown.some((s) => s.id === id)) return id
  const was = byId.get(id)
  if (!was) return id
  const target = was.parentId && collapsed.has(was.parentId) ? (byId.get(was.parentId) ?? was) : was
  let best = shown[0]!
  for (const step of shown) {
    if (Math.abs(step.index - target.index) < Math.abs(best.index - target.index)) best = step
  }
  return best.id
}

export function useVisibleSteps(session: Session | undefined) {
  const text = useUi((s) => s.text)
  const chips = useUi((s) => s.chips)
  const hideThinking = useUi((s) => s.hideThinking)
  const range = useUi((s) => s.range)
  const collapsed = useUi((s) => s.collapsed)
  const selectedId = useUi((s) => s.selectedId)
  const deferredText = useDeferredValue(text)

  const steps = session?.steps ?? NO_STEPS
  const byId = useMemo(() => new Map(steps.map((s) => [s.id, s])), [steps])
  const span = useMemo(() => sessionSpan(session), [session])
  const matched = useMemo(
    () => applyFilters(steps, { text: deferredText, chips, hideThinking, range }),
    [steps, deferredText, chips, hideThinking, range],
  )
  const shown = useMemo(
    () => (collapsed.size === 0 ? matched : matched.filter((s) => !(s.parentId && collapsed.has(s.parentId)))),
    [matched, collapsed],
  )
  const activeId = useMemo(
    () => nearestVisible(shown, byId, collapsed, selectedId),
    [shown, byId, collapsed, selectedId],
  )
  const filtered = text.trim() !== '' || chips.size > 0 || hideThinking || range !== null

  return { steps, byId, shown, activeId, filtered, span }
}
