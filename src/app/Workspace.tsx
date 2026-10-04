import type { Layout } from 'react-resizable-panels'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { DetailPanel } from '@/features/detail/DetailPanel'
import type { Waterfall } from '@/features/steps/StepRow'
import { StepTable } from '@/features/steps/StepTable'
import type { Session, Step } from '@/parser/types'
import { useUi } from '@/store/ui'

type Props = {
  session: Session | undefined
  shown: Step[]
  byId: Map<string, Step>
  activeId: string | null
  selected: Step | undefined
  showPanel: boolean
  waterfall: Waterfall
  emptyText: string
}

export function Workspace({ session, shown, byId, activeId, selected, showPanel, waterfall, emptyText }: Props) {
  const live = useUi((s) => s.live)
  const tableWidth = useUi((s) => s.tableWidth)
  const setTableWidth = useUi((s) => s.setTableWidth)

  function onLayoutChanged(layout: Layout) {
    if (layout.detail !== undefined && layout.table !== undefined) setTableWidth(layout.table)
  }

  return (
    <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1" onLayoutChanged={onLayoutChanged}>
      <ResizablePanel id="table" defaultSize={`${tableWidth}`} minSize={180}>
        <StepTable
          shown={shown}
          byId={byId}
          activeId={activeId}
          compact={showPanel}
          followTail={live && !showPanel}
          waterfall={waterfall}
          emptyText={emptyText}
        />
      </ResizablePanel>
      {showPanel && session && selected ? (
        <>
          <ResizableHandle />
          <ResizablePanel id="detail" defaultSize={`${100 - tableWidth}`} minSize="20">
            <DetailPanel
              session={session}
              step={selected}
              initiator={selected.initiatorId ? byId.get(selected.initiatorId) : undefined}
            />
          </ResizablePanel>
        </>
      ) : null}
    </ResizablePanelGroup>
  )
}
