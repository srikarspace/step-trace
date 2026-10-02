import { ChevronDown, ChevronRight } from 'lucide-react'
import { memo, useEffect, useRef } from 'react'
import type { Step } from '../parser/types'
import { formatMs, formatSize, statusLabel } from './format'
import { StepIcon } from './icons'

function statusText(step: Step) {
  if (step.status === 'pending') return <span className="muted">(Pending)</span>
  if (step.status === 'none') return null
  return statusLabel(step.status)
}

function timeText(step: Step) {
  if (step.status === 'pending') return <span className="muted">Pending</span>
  return step.durationMs === null ? <span className="muted">—</span> : formatMs(step.durationMs)
}

/** Label, then detail, then what a tool returned. Shared by the table and the detail header. */
export function StepTitle({ step }: { step: Step }) {
  return (
    <>
      <StepIcon step={step} />
      <span className="step-label">{step.label}</span>
      {step.name ? <span className="step-detail">{step.name}</span> : null}
      {step.resultPreview ? <span className="step-returned">Returned {step.resultPreview}</span> : null}
    </>
  )
}

type RowProps = {
  step: Step
  selected: boolean
  compact: boolean
  collapsed: boolean
  initiator: Step | undefined
  waterfall: { start: number; span: number }
  onSelect: (id: string) => void
  onJump: (id: string) => void
  onToggle: (id: string) => void
}

const Row = memo(function Row({ step, selected, compact, collapsed, initiator, waterfall, onSelect, onJump, onToggle }: RowProps) {
  const cls = [
    `depth-${step.depth}`,
    step.childCount > 0 ? 'group' : '',
    selected ? 'selected' : '',
    step.status === 'error' ? 'err' : '',
    step.status === 'pending' ? 'pending' : '',
  ]
  const left = ((step.tsStart - waterfall.start) / waterfall.span) * 100
  const width = (((step.tsEnd ?? step.tsStart) - step.tsStart) / waterfall.span) * 100
  const title = [step.label, step.name, step.resultPreview && `Returned ${step.resultPreview}`].filter(Boolean).join('\n')

  return (
    <tr className={cls.join(' ')} data-id={step.id} onMouseDown={() => onSelect(step.id)}>
      <td className="num muted">{step.index}</td>
      <td className="name" title={title}>
        <div className="name-cell">
          {step.childCount > 0 ? (
            <button
              className="twisty"
              aria-label={collapsed ? 'Expand' : 'Collapse'}
              aria-expanded={!collapsed}
              onMouseDown={(e) => {
                e.stopPropagation()
                onToggle(step.id)
              }}
            >
              {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            </button>
          ) : (
            <span className="twisty" />
          )}
          <StepTitle step={step} />
          {collapsed ? (
            <span className={step.childErrors > 0 ? 'tone-error' : 'muted'}>
              ({step.childCount} rows{step.childErrors > 0 ? `, ${step.childErrors} failed` : ''})
            </span>
          ) : null}
        </div>
      </td>
      {compact ? null : (
        <>
          <td className={step.status === 'error' ? 'err' : ''}>{statusText(step)}</td>
          <td>{step.type}</td>
          <td>
            {initiator ? (
              <button
                className="link"
                title={`${initiator.label} ${initiator.name}`}
                onMouseDown={(e) => {
                  e.stopPropagation()
                  onJump(initiator.id)
                }}
              >
                #{initiator.index} {initiator.label}
              </button>
            ) : (
              <span className="muted">{step.kind === 'prompt' ? 'you' : ''}</span>
            )}
          </td>
          <td className="num">{formatSize(step)}</td>
          <td className="num">{timeText(step)}</td>
          <td className="water">
            <i
              className={`tone-bg-${step.status === 'error' ? 'error' : step.effect}`}
              style={{ left: `${left}%`, width: `${width}%`, opacity: step.status === 'pending' ? 0.4 : 1 }}
            />
          </td>
        </>
      )}
    </tr>
  )
})

type Props = {
  steps: Step[]
  byId: Map<string, Step>
  selectedId: string | null
  collapsed: ReadonlySet<string>
  compact: boolean
  flashId: string | null
  waterfall: { start: number; span: number }
  followTail: boolean
  onSelect: (id: string) => void
  onJump: (id: string) => void
  onToggle: (id: string) => void
  emptyText: string
}

export function StepTable(p: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!p.selectedId) return
    const row = wrapRef.current?.querySelector<HTMLElement>(`tr[data-id="${CSS.escape(p.selectedId)}"]`)
    row?.scrollIntoView({ block: 'nearest' })
  }, [p.selectedId, p.compact])

  useEffect(() => {
    if (!p.flashId) return
    const row = wrapRef.current?.querySelector<HTMLElement>(`tr[data-id="${CSS.escape(p.flashId)}"]`)
    if (!row) return
    row.classList.remove('flash')
    void row.offsetWidth
    row.classList.add('flash')
  }, [p.flashId])

  const count = p.steps.length
  useEffect(() => {
    const el = wrapRef.current
    if (p.followTail && el) el.scrollTop = el.scrollHeight
  }, [count, p.followTail])

  return (
    <div className="table-wrap" ref={wrapRef} tabIndex={0}>
      <table className="steps">
        <colgroup>
          <col className="col-idx" />
          <col />
          {p.compact ? null : (
            <>
              <col className="col-status" />
              <col className="col-type" />
              <col className="col-init" />
              <col className="col-size" />
              <col className="col-time" />
              <col className="col-water" />
            </>
          )}
        </colgroup>
        <thead>
          <tr>
            <th className="num">#</th>
            <th>Name</th>
            {p.compact ? null : (
              <>
                <th>Status</th>
                <th>Type</th>
                <th>Initiator</th>
                <th className="num">Size</th>
                <th className="num">Time</th>
                <th>Waterfall</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {p.steps.map((step) => (
            <Row
              key={step.id}
              step={step}
              selected={step.id === p.selectedId}
              compact={p.compact}
              collapsed={p.collapsed.has(step.id)}
              initiator={step.initiatorId ? p.byId.get(step.initiatorId) : undefined}
              waterfall={p.waterfall}
              onSelect={p.onSelect}
              onJump={p.onJump}
              onToggle={p.onToggle}
            />
          ))}
        </tbody>
      </table>
      {count === 0 ? <div className="empty">{p.emptyText}</div> : null}
    </div>
  )
}
