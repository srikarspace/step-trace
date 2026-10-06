import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { Session, Step } from '@/parser/types'
import { useUi, type Tab } from '@/store/ui'
import { CodeBlock } from './CodeBlock'
import { Summary } from './tabs/Summary'

function tabsFor(step: Step): Tab[] {
  if (step.kind === 'tool') return ['Summary', 'Input', ...(step.result !== undefined ? (['Returned'] as const) : []), 'Raw']
  if (step.text) return ['Summary', 'Content', 'Raw']
  return ['Summary', 'Raw']
}

function InputTab({ step }: { step: Step }) {
  const banner = step.badArgs !== undefined ? 'Arguments were not valid JSON. Shown as sent.' : undefined
  return <CodeBlock text={step.badArgs ?? JSON.stringify(step.input ?? {}, null, 2)} banner={banner} />
}

function ReturnedTab({ step }: { step: Step }) {
  const banner = step.status === 'error' ? 'The tool failed. This error text is what the LLM received.' : undefined
  return <CodeBlock text={step.result ?? ''} banner={banner} />
}

function RawTab({ session, step }: { session: Session; step: Step }) {
  return <CodeBlock text={step.rawLines.map((i) => JSON.stringify(session.lines[i], null, 2)).join('\n\n')} />
}

type Props = { session: Session; step: Step; initiator: Step | undefined }

export function DetailPanel({ session, step, initiator }: Props) {
  const tab = useUi((s) => s.tab)
  const setTab = useUi((s) => s.setTab)
  const closePanel = useUi((s) => s.closePanel)
  const tabs = tabsFor(step)
  const active = tabs.includes(tab) ? tab : 'Summary'

  return (
    <Tabs value={active} onValueChange={(value) => setTab(value as Tab)} className="h-full border-l">
      <TabsList>
        <Button variant="ghost" size="icon" title="Close (Esc)" aria-label="Close" onClick={closePanel}>
          <X />
        </Button>
        {tabs.map((t) => (
          <TabsTrigger key={t} value={t}>
            {t}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="Summary">
        <Summary session={session} step={step} initiator={initiator} />
      </TabsContent>
      <TabsContent value="Input">
        <InputTab key={step.id} step={step} />
      </TabsContent>
      <TabsContent value="Returned">
        <ReturnedTab key={step.id} step={step} />
      </TabsContent>
      <TabsContent value="Content">
        <CodeBlock key={step.id} text={step.text ?? ''} />
      </TabsContent>
      <TabsContent value="Raw">
        <RawTab key={step.id} session={session} step={step} />
      </TabsContent>
    </Tabs>
  )
}
