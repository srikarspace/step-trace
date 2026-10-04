import { useVirtualizer } from '@tanstack/react-virtual'
import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import type { Step } from '@/parser/types'
import { useUi } from '@/store/ui'
import { gridTemplate, ROW_HEIGHT } from './columns'
import { StepHeader } from './StepHeader'
import { StepRow, type Waterfall } from './StepRow'

type Props = {
  shown: Step[]
  byId: Map<string, Step>
  activeId: string | null
  compact: boolean
  followTail: boolean
  waterfall: Waterfall
  emptyText: string
}

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')

function flashRow(scroller: HTMLElement, id: string) {
  if (reducedMotion.matches) return
  const color = getComputedStyle(scroller).getPropertyValue('--primary')
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const row = scroller.querySelector(`[data-id="${CSS.escape(id)}"]`)
      row?.animate([{ backgroundColor: color }, {}], { duration: 400, easing: 'ease-out' })
    }),
  )
}

export function StepTable({ shown, byId, activeId, compact, followTail, waterfall, emptyText }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const collapsed = useUi((s) => s.collapsed)
  const widths = useUi((s) => s.columns)
  const flash = useUi((s) => s.flash)
  const select = useUi((s) => s.select)
  const jumpTo = useUi((s) => s.jumpTo)
  const toggleGroup = useUi((s) => s.toggleGroup)

  const virtualizer = useVirtualizer({
    count: shown.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    getItemKey: (index) => shown[index]!.id,
    overscan: 12,
    scrollMargin: ROW_HEIGHT,
    scrollPaddingStart: ROW_HEIGHT,
  })

  const activeIndex = activeId === null ? -1 : shown.findIndex((s) => s.id === activeId)
  const count = shown.length

  useEffect(() => {
    if (activeIndex >= 0) virtualizer.scrollToIndex(activeIndex, { align: 'auto' })
  }, [activeIndex, compact, virtualizer])

  useEffect(() => {
    if (followTail && count > 0) virtualizer.scrollToIndex(count - 1, { align: 'end' })
  }, [count, followTail, virtualizer])

  useEffect(() => {
    if (flash && scrollRef.current) flashRow(scrollRef.current, flash.id)
  }, [flash])

  function onMouseDown(e: React.MouseEvent) {
    const target = e.target as HTMLElement
    const action = target.closest<HTMLElement>('[data-action]')
    const id = action?.dataset.target
    if (action && id) {
      if (action.dataset.action === 'toggle') toggleGroup(id)
      else jumpTo(id)
      return
    }
    const row = target.closest<HTMLElement>('[data-id]')?.dataset.id
    if (row) select(row)
  }

  return (
    <div
      ref={scrollRef}
      data-steps-scroll
      role="grid"
      aria-rowcount={count}
      tabIndex={0}
      onMouseDown={onMouseDown}
      className="relative h-full overflow-auto outline-none [&:not(:focus-within)_[data-selected]]:bg-selected-blur"
      style={{ '--steps-grid': gridTemplate(compact, widths, byId.size) } as React.CSSProperties}
    >
      <StepHeader compact={compact} rows={byId.size} gridRef={scrollRef} />
      <div
        role="rowgroup"
        className={cn('relative box-content', count > 0 && 'border-b border-border-soft')}
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualizer.getVirtualItems().map((item) => {
          const step = shown[item.index]!
          return (
            <StepRow
              key={item.key}
              step={step}
              top={item.start - ROW_HEIGHT}
              selected={step.id === activeId}
              collapsed={collapsed.has(step.id)}
              compact={compact}
              initiator={step.initiatorId ? byId.get(step.initiatorId) : undefined}
              waterfall={waterfall}
            />
          )
        })}
      </div>
      {count === 0 ? <div className="p-6 text-muted-foreground">{emptyText}</div> : null}
    </div>
  )
}
