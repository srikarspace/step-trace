import { ChevronDown, ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { formatMs, formatSize, statusLabel } from '@/lib/format'
import { toneOf, toneVar } from '@/lib/tone'
import { cn } from '@/lib/utils'
import type { Step } from '@/parser/types'
import { StepTitle } from './StepTitle'

export type Waterfall = { start: number; span: number }

type Props = {
  step: Step
  top: number
  selected: boolean
  collapsed: boolean
  compact: boolean
  initiator: Step | undefined
  waterfall: Waterfall
}

function Cell({ className, children, title }: { className?: string; children?: ReactNode; title?: string }) {
  return (
    <div role="gridcell" title={title} className={cn('truncate border-r border-border-soft px-1.5', className)}>
      {children}
    </div>
  )
}

function Twisty({ step, collapsed }: { step: Step; collapsed: boolean }) {
  if (step.depth === 1) return null
  if (step.childCount === 0) return <span className="w-4 flex-none" />
  return (
    <button
      type="button"
      data-action="toggle"
      data-target={step.id}
      aria-label={collapsed ? 'Expand' : 'Collapse'}
      aria-expanded={!collapsed}
      className="grid size-4 flex-none cursor-pointer place-items-center rounded-[3px] text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
    </button>
  )
}

function NameCell({ step, collapsed }: { step: Step; collapsed: boolean }) {
  const title = [step.label, step.name, step.resultPreview && `Returned ${step.resultPreview}`].filter(Boolean).join('\n')
  return (
    <div
      role="gridcell"
      title={title}
      className={cn(
        'relative flex min-w-0 items-center gap-1.5 overflow-hidden border-r border-border-soft px-1.5 whitespace-nowrap',
        step.depth === 1 && 'pl-7 before:absolute before:-inset-y-1 before:left-[13px] before:w-px before:bg-border',
      )}
    >
      <Twisty step={step} collapsed={collapsed} />
      <StepTitle step={step} />
      {collapsed ? (
        <span className={cn('flex-none', step.childErrors > 0 ? 'text-error' : 'text-muted-foreground')}>
          ({step.childCount} rows{step.childErrors > 0 ? `, ${step.childErrors} failed` : ''})
        </span>
      ) : null}
    </div>
  )
}

function statusText(step: Step) {
  if (step.status === 'pending') return <span className="text-muted-foreground">(Pending)</span>
  return statusLabel(step.status)
}

function timeText(step: Step) {
  if (step.status === 'pending') return <span className="text-muted-foreground">Pending</span>
  return step.durationMs === null ? <span className="text-muted-foreground">—</span> : formatMs(step.durationMs)
}

function InitiatorCell({ step, initiator }: { step: Step; initiator: Step | undefined }) {
  if (!initiator) return <Cell className="text-muted-foreground">{step.kind === 'prompt' ? 'you' : ''}</Cell>
  return (
    <Cell>
      <button
        type="button"
        data-action="jump"
        data-target={initiator.id}
        title={`${initiator.label} ${initiator.name}`}
        className="cursor-pointer text-link underline"
      >
        #{initiator.index} {initiator.label}
      </button>
    </Cell>
  )
}

function WaterfallCell({ step, waterfall }: { step: Step; waterfall: Waterfall }) {
  const left = ((step.tsStart - waterfall.start) / waterfall.span) * 100
  const width = (((step.tsEnd ?? step.tsStart) - step.tsStart) / waterfall.span) * 100
  return (
    <div role="gridcell" className="relative">
      <i
        className="absolute top-2 h-1.5 min-w-0.5 rounded-[1px]"
        style={{
          left: `${left}%`,
          width: `${width}%`,
          background: toneVar[toneOf(step)],
          opacity: step.status === 'pending' ? 0.4 : 1,
        }}
      />
    </div>
  )
}

export function StepRow({ step, top, selected, collapsed, compact, initiator, waterfall }: Props) {
  return (
    <div
      role="row"
      data-id={step.id}
      data-selected={selected || undefined}
      className={cn(
        'absolute inset-x-0 top-0 grid h-[22px] cursor-default grid-cols-(--steps-grid) leading-[21px] select-none',
        step.depth === 0 && 'border-t border-border-soft',
        step.status === 'pending' && 'text-muted-foreground',
        selected ? 'bg-selected' : cn(step.childCount > 0 && 'bg-row-alt', 'hover:bg-accent'),
      )}
      style={{ transform: `translateY(${top}px)` }}
    >
      <Cell className="text-right text-muted-foreground">{step.index}</Cell>
      <NameCell step={step} collapsed={collapsed} />
      {compact ? null : (
        <>
          <Cell className={cn(step.status === 'error' && 'text-error')}>{statusText(step)}</Cell>
          <Cell>{step.type}</Cell>
          <InitiatorCell step={step} initiator={initiator} />
          <Cell className="text-right">{formatSize(step)}</Cell>
          <Cell className="text-right">{timeText(step)}</Cell>
          <WaterfallCell step={step} waterfall={waterfall} />
        </>
      )}
    </div>
  )
}
