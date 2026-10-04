import type { SessionEntry } from '../../../server/api'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useUi } from '@/store/ui'

function sessionLabel(s: SessionEntry): string {
  const when = new Date(s.mtimeMs).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  const project = s.project.split('/').pop() || '?'
  return `${when} · ${project} · ${s.title || '(no prompt)'}`
}

export function SessionPicker({ sessions, file }: { sessions: SessionEntry[]; file: string | null }) {
  const setFile = useUi((s) => s.setFile)
  const listed = file === null || sessions.some((s) => s.path === file)
  return (
    <Select value={file ?? ''} onValueChange={setFile}>
      <SelectTrigger aria-label="Session" className="max-w-[min(520px,50vw)] bg-background">
        <SelectValue placeholder="No sessions" />
      </SelectTrigger>
      <SelectContent position="popper" align="start" className="max-w-[min(720px,90vw)]">
        {listed ? null : <SelectItem value={file}>{file}</SelectItem>}
        {sessions.map((s) => (
          <SelectItem key={s.path} value={s.path}>
            {sessionLabel(s)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
