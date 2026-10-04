import { Ban, Circle, RotateCw, TriangleAlert } from 'lucide-react'
import type { SessionEntry } from '../../../server/api'
import { IconButton } from '@/components/IconButton'
import { ToolbarSeparator } from '@/components/ToolbarSeparator'
import { Checkbox } from '@/components/ui/checkbox'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useUi, type Theme } from '@/store/ui'
import { SessionPicker } from './SessionPicker'
import { SettingsMenu } from './SettingsMenu'

type Props = {
  sessions: SessionEntry[]
  file: string | null
  warnings: string[]
  theme: Theme
  onReload: () => void
}

function Warnings({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex cursor-help items-center gap-1 whitespace-nowrap text-warn">
          <TriangleAlert className="size-3" aria-hidden /> {warnings.length} parse warning
          {warnings.length === 1 ? '' : 's'}
        </span>
      </TooltipTrigger>
      <TooltipContent className="whitespace-pre-line">{warnings.join('\n')}</TooltipContent>
    </Tooltip>
  )
}

export function Toolbar({ sessions, file, warnings, theme, onReload }: Props) {
  const live = useUi((s) => s.live)
  const setLive = useUi((s) => s.setLive)
  const hideThinking = useUi((s) => s.hideThinking)
  const setHideThinking = useUi((s) => s.setHideThinking)
  const clearFilters = useUi((s) => s.clearFilters)

  return (
    <div className="flex min-h-7 flex-wrap items-center gap-1.5 border-b border-border-soft bg-toolbar px-1.5">
      <IconButton
        label={live ? 'Stop following (live: polls the file and jumps to new sessions)' : 'Follow live'}
        aria-pressed={live}
        className={cn(live && 'text-error hover:text-error')}
        onClick={() => setLive(!live)}
      >
        <Circle fill={live ? 'currentColor' : 'none'} />
      </IconButton>
      <IconButton label="Clear filters" onClick={clearFilters}>
        <Ban />
      </IconButton>
      <IconButton label="Reload" onClick={onReload}>
        <RotateCw />
      </IconButton>
      <ToolbarSeparator />
      <label className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap">
        <Checkbox checked={hideThinking} onCheckedChange={(on) => setHideThinking(on === true)} />
        Hide thinking
      </label>
      <ToolbarSeparator />
      <SessionPicker sessions={sessions} file={file} />
      <div className="flex-1" />
      <Warnings warnings={warnings} />
      <SettingsMenu theme={theme} />
    </div>
  )
}
