import { TriangleAlert } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { formatCount, formatMs, shortModel } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Session, Step } from '@/parser/types'
import { useUi } from '@/store/ui'
import { totals } from './usage'

type Props = { session: Session; shown: Step[]; filtered: boolean }

function Segment({ className, title, children }: { className?: string; title?: string; children: ReactNode }) {
  return (
    <span title={title} className={cn('border-r border-border-soft px-2.5', className)}>
      {children}
    </span>
  )
}

export function StatusBar({ session, shown, filtered }: Props) {
  const setText = useUi((s) => s.setText)
  const all = useMemo(() => totals(session.steps), [session.steps])
  const visible = useMemo(() => (filtered ? totals(shown) : all), [filtered, shown, all])
  const pair = (a: number, b: number) => (filtered ? `${formatCount(a)} / ${formatCount(b)}` : formatCount(b))
  const model = session.steps.find((s) => s.model)?.model
  const wall = session.startedAt !== null && session.endedAt !== null ? session.endedAt - session.startedAt : null

  return (
    <div className="flex h-[26px] flex-none items-center overflow-hidden border-t bg-toolbar whitespace-nowrap">
      <Segment>
        {pair(visible.steps, all.steps)} steps · {pair(visible.tools, all.tools)} tools
      </Segment>
      <Segment title="prompt tokens in / completion tokens out, summed over LLM calls">
        {all.tokensIn + all.tokensOut === 0
          ? 'no usage recorded'
          : `${pair(visible.tokensIn, all.tokensIn)} in · ${pair(visible.tokensOut, all.tokensOut)} out tokens`}
      </Segment>
      {all.cost !== null ? <Segment>${all.cost.toFixed(4)}</Segment> : null}
      {all.errors > 0 ? (
        <Button variant="segment" size="none" className="text-error" onClick={() => setText('status:error')}>
          <TriangleAlert className="size-3" aria-hidden /> {pair(visible.errors, all.errors)} error
          {all.errors === 1 ? '' : 's'}
        </Button>
      ) : null}
      <Segment className="text-link">Finish: {formatMs(wall)}</Segment>
      {session.turn ? (
        <Segment className={cn(session.turn.reason !== 'answer' && 'text-error')}>Ended: {session.turn.reason}</Segment>
      ) : null}
      {model ? <Segment title={model}>{shortModel(model)}</Segment> : null}
    </div>
  )
}
