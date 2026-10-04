import { useEffect, useEffectEvent } from 'react'
import type { Step } from '@/parser/types'
import { useUi } from '@/store/ui'

const OWNS_KEYS = 'input, textarea, select, [role="listbox"], [role="menu"], [role="combobox"]'

function groupOf(step: Step, byId: Map<string, Step>): Step | undefined {
  if (step.childCount > 0) return step
  return step.parentId ? byId.get(step.parentId) : undefined
}

function nextIndex(key: string, at: number, length: number): number | null {
  if (key === 'ArrowDown') return at === -1 ? 0 : Math.min(length - 1, at + 1)
  if (key === 'ArrowUp') return at === -1 ? 0 : Math.max(0, at - 1)
  if (key === 'Home') return 0
  if (key === 'End') return length - 1
  return null
}

export function useKeyboardNav(shown: Step[], byId: Map<string, Step>, activeId: string | null) {
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    const target = e.target as HTMLElement
    if (target.closest(OWNS_KEYS)) {
      if (e.key === 'Escape' && target.matches('input, textarea')) target.blur()
      return
    }
    const ui = useUi.getState()
    if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
      e.preventDefault()
      document.getElementById('filter')?.focus()
      return
    }
    if (e.key === 'Escape') {
      ui.closePanel()
      return
    }
    if (shown.length === 0) return
    const at = shown.findIndex((s) => s.id === activeId)
    const current = shown[at]
    if (current && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault()
      const group = groupOf(current, byId)
      if (!group) return
      const isCollapsed = ui.collapsed.has(group.id)
      if (e.key === 'ArrowLeft' && !isCollapsed) ui.toggleGroup(group.id)
      if (e.key === 'ArrowRight' && isCollapsed) ui.toggleGroup(group.id)
      if (e.key === 'ArrowLeft') ui.moveTo(group.id)
      return
    }
    const next = nextIndex(e.key, at, shown.length)
    if (next === null) return
    e.preventDefault()
    ui.moveTo(shown[next]!.id)
  })

  useEffect(() => {
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
