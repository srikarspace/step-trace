import type { ReactNode } from 'react'
import { formatBytes, formatCount, formatMs, statusLabel } from '@/lib/format'
import type { Session, Step } from '@/parser/types'
import { useUi } from '@/store/ui'

function Row({ label, children }: { label: string; children: ReactNode }) {
  if (children === undefined || children === null || children === '' || children === false) return null
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="m-0 wrap-anywhere">{children}</dd>
    </>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <div className="mt-1 mb-1.5 font-semibold">{title}</div>
      <dl className="mb-3.5 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-0.5">{children}</dl>
    </>
  )
}

type Props = { session: Session; step: Step; initiator: Step | undefined }

export function Summary({ session, step, initiator }: Props) {
  const jumpTo = useUi((s) => s.jumpTo)
  const since = session.startedAt === null ? null : step.tsStart - session.startedAt
  const usage = step.usage
  return (
    <>
      <Section title="General">
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
          {initiator ? (
            <button type="button" className="cursor-pointer text-link underline" onClick={() => jumpTo(initiator.id)}>
              #{initiator.index} {initiator.label}
            </button>
          ) : null}
        </Row>
      </Section>
      {usage ? (
        <Section title="Usage">
          <Row label="Input tokens">{formatCount(usage.in)}</Row>
          <Row label="Cached">{formatCount(usage.cached)}</Row>
          <Row label="Output tokens">{formatCount(usage.out)}</Row>
          <Row label="Reasoning">{formatCount(usage.reasoning)}</Row>
          <Row label="Cost">{usage.cost !== null && `$${usage.cost.toFixed(4)}`}</Row>
        </Section>
      ) : null}
      {step.kind === 'llm' && !usage ? (
        <p className="text-muted-foreground">No usage on this line. Transcripts written before shrek recorded usage lack it.</p>
      ) : null}
    </>
  )
}
