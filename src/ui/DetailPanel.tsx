import { Copy, X } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Session, Step } from '../parser/types'
import { formatBytes, formatCount, formatMs, statusLabel } from './format'

export type Tab = 'Summary' | 'Input' | 'Returned' | 'Content' | 'Raw'

/** Tabs with nothing to show for this step are hidden, never shown empty. */
export function tabsFor(step: Step): Tab[] {
  if (step.kind === 'tool') return ['Summary', 'Input', ...(step.result !== undefined ? (['Returned'] as const) : []), 'Raw']
  if (step.text) return ['Summary', 'Content', 'Raw']
  return ['Summary', 'Raw']
}

type Props = {
  session: Session
  step: Step
  initiator: Step | undefined
  tab: Tab
  onTab: (tab: Tab) => void
  onSelect: (id: string) => void
  onClose: () => void
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  if (children === undefined || children === null || children === '') return null
  return (
    <>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </>
  )
}

function CopyButton({ text }: { text: string }) {
  return (
    <div className="copy-row">
      <button className="btn" onClick={() => void navigator.clipboard.writeText(text)}>
        <Copy size={12} aria-hidden /> Copy
      </button>
    </div>
  )
}

function Summary({ session, step, initiator, onSelect }: Pick<Props, 'session' | 'step' | 'initiator' | 'onSelect'>) {
  const since = session.startedAt === null ? null : step.tsStart - session.startedAt
  const u = step.usage
  return (
    <>
      <div className="section-title">General</div>
      <dl className="kv">
        <Row label="Step">{step.label}</Row>
        <Row label="Detail">{step.name}</Row>
        <Row label="Type">{step.type}</Row>
        <Row label="Status">{statusLabel(step.status)}</Row>
        <Row label="Tool">{step.toolName}</Row>
        <Row label="Call id">{step.toolCallId}</Row>
        <Row label="LLM step">{step.llmStep}</Row>
        <Row label="Model">{step.model}</Row>
        <Row label="Started">{since !== null && `+${formatMs(since)}`}</Row>
        <Row label="Duration">{step.durationMs !== null && formatMs(step.durationMs)}</Row>
        <Row label="Size">{step.bytes !== null && formatBytes(step.bytes)}</Row>
        <Row label="Initiator">
          {initiator && (
            <button className="link" onClick={() => onSelect(initiator.id)}>
              #{initiator.index} {initiator.label}
            </button>
          )}
        </Row>
      </dl>
      {u && (
        <>
          <div className="section-title">Usage</div>
          <dl className="kv">
            <Row label="Input tokens">{formatCount(u.in)}</Row>
            <Row label="Cached">{formatCount(u.cached)}</Row>
            <Row label="Output tokens">{formatCount(u.out)}</Row>
            <Row label="Reasoning">{formatCount(u.reasoning)}</Row>
            <Row label="Cost">{u.cost !== null && `$${u.cost.toFixed(4)}`}</Row>
          </dl>
        </>
      )}
      {step.kind === 'llm' && !u && (
        <p className="muted">No usage on this line. Transcripts written before shrek recorded usage lack it.</p>
      )}
    </>
  )
}

export function DetailPanel({ session, step, initiator, tab, onTab, onSelect, onClose }: Props) {
  const tabs = tabsFor(step)
  const active = tabs.includes(tab) ? tab : 'Summary'

  let body: ReactNode
  if (active === 'Summary') {
    body = <Summary session={session} step={step} initiator={initiator} onSelect={onSelect} />
  } else if (active === 'Input') {
    const text = step.badArgs ?? JSON.stringify(step.input, null, 2)
    body = (
      <>
        {step.badArgs !== undefined && <div className="banner">Arguments were not valid JSON. Shown as sent.</div>}
        <CopyButton text={text} />
        <pre className="code">{text}</pre>
      </>
    )
  } else if (active === 'Returned') {
    body = (
      <>
        {step.status === 'error' && <div className="banner">The tool failed. This error text is what the LLM received.</div>}
        <CopyButton text={step.result ?? ''} />
        <pre className="code">{step.result}</pre>
      </>
    )
  } else if (active === 'Content') {
    body = (
      <>
        <CopyButton text={step.text ?? ''} />
        <pre className="code">{step.text}</pre>
      </>
    )
  } else {
    const raw = step.rawLines.map((i) => JSON.stringify(session.lines[i], null, 2)).join('\n\n')
    body = (
      <>
        <CopyButton text={raw} />
        <pre className="code">{raw}</pre>
      </>
    )
  }

  return (
    <div className="detail">
      <div className="tabs">
        <button className="icon-btn" title="Close (Esc)" aria-label="Close" onClick={onClose}>
          <X size={14} />
        </button>
        {tabs.map((t) => (
          <button key={t} className={`tab ${t === active ? 'active' : ''}`} onClick={() => onTab(t)}>
            {t}
          </button>
        ))}
      </div>
      <div className="detail-body">{body}</div>
    </div>
  )
}
