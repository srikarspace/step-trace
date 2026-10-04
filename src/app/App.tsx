import { FilterBar } from '@/features/filter/FilterBar'
import { Overview } from '@/features/overview/Overview'
import { useActiveFile, useReload, useSession } from '@/features/sessions/queries'
import { StatusBar } from '@/features/statusbar/StatusBar'
import { useVisibleSteps } from '@/features/steps/useVisibleSteps'
import { Toolbar } from '@/features/toolbar/Toolbar'
import { useKeyboardNav } from '@/hooks/useKeyboardNav'
import { useTheme } from '@/hooks/useTheme'
import { useUrlSync } from '@/hooks/useUrlSync'
import type { Session } from '@/parser/types'
import { useUi } from '@/store/ui'
import { Workspace } from './Workspace'

type EmptyState = { error: Error | null; file: string | null; root: string; session: Session | undefined; total: number }

function emptyText({ error, file, root, session, total }: EmptyState): string {
  if (error) return error.message
  if (!file) return `No shrek sessions in ${root || '~/.shrek/projects'}. Run: bun run bin/shrek.ts -p "…"`
  if (!session) return 'Loading…'
  return total === 0 ? 'This session has no steps yet.' : 'No steps match the filter.'
}

export function App() {
  const theme = useTheme()
  const { file, root, sessions, error: listError } = useActiveFile()
  const query = useSession(file)
  const session = query.data
  const reload = useReload()
  const { steps, byId, shown, activeId, filtered, span } = useVisibleSteps(session)
  const panelOpen = useUi((s) => s.panelOpen)
  const range = useUi((s) => s.range)
  const setRange = useUi((s) => s.setRange)

  const selected = activeId ? byId.get(activeId) : undefined
  const showPanel = panelOpen && selected !== undefined && session !== undefined
  const error = query.error ?? listError

  useKeyboardNav(shown, byId, activeId)
  useUrlSync(file, panelOpen ? activeId : null)

  return (
    <div className="flex h-full flex-col">
      <Toolbar
        sessions={sessions}
        file={file}
        warnings={session?.warnings ?? []}
        theme={theme}
        onReload={() => reload(file)}
      />
      <FilterBar steps={steps} />
      <Overview
        steps={steps}
        start={span.start}
        end={span.end}
        selected={selected}
        range={range}
        theme={theme}
        onRange={setRange}
      />
      <Workspace
        session={session}
        shown={shown}
        byId={byId}
        activeId={activeId}
        selected={selected}
        showPanel={showPanel}
        waterfall={{ start: span.start, span: span.span }}
        emptyText={emptyText({ error, file, root, session, total: steps.length })}
      />
      {session ? <StatusBar session={session} shown={shown} filtered={filtered} /> : null}
    </div>
  )
}
