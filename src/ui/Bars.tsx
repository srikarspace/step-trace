import { Ban, ChevronDown, Circle, EllipsisVertical, Filter, Moon, RotateCw, Settings, Sun, TriangleAlert } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { SessionEntry } from '../../server/api'
import type { Session, Step } from '../parser/types'
import { chipButtons, parseFilter, type Chip, type ChipOptions, type FilterState } from './filter'
import { formatCount, formatMs, shortModel } from './format'

type ToolbarProps = {
  sessions: SessionEntry[]
  file: string | null
  live: boolean
  hideThinking: boolean
  warnings: string[]
  onLive: (on: boolean) => void
  onClear: () => void
  onReload: () => void
  onFile: (file: string) => void
  onHideThinking: (on: boolean) => void
  theme: 'light' | 'dark'
  onToggleTheme: () => void
}

function sessionLabel(s: SessionEntry): string {
  const when = new Date(s.mtimeMs).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  const project = s.project.split('/').pop() || '?'
  return `${when} · ${project} · ${s.title || '(no prompt)'}`
}

export function Toolbar(p: ToolbarProps) {
  return (
    <div className="toolbar">
      <button
        className={`icon-btn ${p.live ? 'recording' : ''}`}
        title={p.live ? 'Stop following (live: polls the file and jumps to new sessions)' : 'Follow live'}
        aria-label="Follow live"
        aria-pressed={p.live}
        onClick={() => p.onLive(!p.live)}
      >
        <Circle size={14} fill={p.live ? 'currentColor' : 'none'} />
      </button>
      <button className="icon-btn" title="Clear filters" aria-label="Clear filters" onClick={p.onClear}>
        <Ban size={14} />
      </button>
      <button className="icon-btn" title="Reload" aria-label="Reload" onClick={p.onReload}>
        <RotateCw size={14} />
      </button>
      <div className="tb-sep" />
      <label className="tb-check">
        <input type="checkbox" checked={p.hideThinking} onChange={(e) => p.onHideThinking(e.target.checked)} />
        Hide thinking
      </label>
      <div className="tb-sep" />
      <select className="tb-select" aria-label="Session" value={p.file ?? ''} onChange={(e) => p.onFile(e.target.value)}>
        {p.file && !p.sessions.some((s) => s.path === p.file) && <option value={p.file}>{p.file}</option>}
        {p.sessions.map((s) => (
          <option key={s.path} value={s.path}>
            {sessionLabel(s)}
          </option>
        ))}
      </select>
      <div className="tb-spacer" />
      {p.warnings.length > 0 && (
        <span className="warn-badge" title={p.warnings.join('\n')}>
          <TriangleAlert size={12} aria-hidden /> {p.warnings.length} parse warning{p.warnings.length === 1 ? '' : 's'}
        </span>
      )}
      <Dropdown icon label={<EllipsisVertical size={14} aria-hidden />} title="Settings">
        <button className="menu-item" onClick={p.onToggleTheme}>
          {p.theme === 'dark' ? <Sun size={14} aria-hidden /> : <Moon size={14} aria-hidden />}
          {p.theme === 'dark' ? 'Light theme' : 'Dark theme'}
        </button>
      </Dropdown>
    </div>
  )
}

type FilterBarProps = {
  filter: FilterState
  options: ChipOptions
  /** Chip ids shown as buttons; the rest stay in the settings menu. */
  pinned: ReadonlySet<string>
  onText: (text: string) => void
  /** null is the All button. */
  onChip: (id: string | null, additive: boolean) => void
  onPin: (id: string) => void
}

const MORE: { label: string; token: string }[] = [
  { label: 'Errors only', token: 'status:error' },
  { label: 'Pending only', token: 'status:pending' },
  { label: 'Hide system', token: '-kind:system' },
]

/** Button with a checkbox menu. Items keep focus on the button so ticking one leaves the menu open. */
type DropdownProps = {
  label: React.ReactNode
  title?: string
  /** Icon-only trigger, menu opening leftwards from the right edge. */
  icon?: boolean
  children: React.ReactNode
}

/** Stays open while you tick items; closes on a click outside or Esc. */
function Dropdown({ label, title, icon = false, children }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className={icon ? 'more more-right' : 'more'}>
      <button
        className={icon ? 'icon-btn' : 'btn'}
        title={title}
        aria-label={icon ? title : undefined}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {label}
        {icon ? null : <ChevronDown size={12} aria-hidden />}
      </button>
      {open && (
        <div className="more-menu" onMouseDown={(e) => e.preventDefault()}>
          {children}
        </div>
      )}
    </div>
  )
}

function Check({ checked, onChange, children }: { checked: boolean; onChange: () => void; children: React.ReactNode }) {
  return (
    <label>
      <input type="checkbox" checked={checked} onChange={onChange} />
      {children}
    </label>
  )
}

type PinSectionProps = { heading: string; chips: Chip[]; pinned: ReadonlySet<string>; onPin: (id: string) => void }

function PinSection({ heading, chips, pinned, onPin }: PinSectionProps) {
  if (chips.length === 0) return null
  return (
    <>
      <div className="menu-heading">{heading}</div>
      {chips.map((c) => (
        <Check key={c.id} checked={pinned.has(c.id)} onChange={() => onPin(c.id)}>
          <span className="swatch" style={{ background: `var(--c-${c.effect})` }} />
          {c.label}
          {c.title && c.title !== c.label ? <span className="muted">{c.title}</span> : null}
        </Check>
      ))}
    </>
  )
}

export function FilterBar({ filter, options, pinned, onText, onChip, onPin }: FilterBarProps) {
  const invalid = parseFilter(filter.text).filter((t) => !t.valid)
  const words = filter.text.split(/\s+/).filter(Boolean)
  const buttons = chipButtons(options, pinned)

  function toggleToken(token: string) {
    onText(words.includes(token) ? words.filter((w) => w !== token).join(' ') : [...words, token].join(' '))
  }

  return (
    <div className="filterbar">
      <label className="filter-input" title="Text, or tool:Bash status:error kind:llm model:x. Prefix - to negate.">
        <Filter size={12} className="muted" aria-hidden />
        <input
          id="filter"
          placeholder="Filter"
          value={filter.text}
          onChange={(e) => onText(e.target.value)}
          spellCheck={false}
        />
      </label>
      {invalid.length > 0 && (
        <span className="filter-bad" title="Ignored: unknown key or empty value">
          {invalid.map((t) => `${t.negate ? '-' : ''}${t.key}:${t.value}`).join(' ')}
        </span>
      )}
      <Dropdown label="More filters">
        {MORE.map((m) => (
          <Check key={m.token} checked={words.includes(m.token)} onChange={() => toggleToken(m.token)}>
            {m.label}
          </Check>
        ))}
      </Dropdown>
      <div className="tb-sep" />
      <div className="chips">
        <button className={`chip ${filter.chips.size === 0 ? 'active' : ''}`} onClick={() => onChip(null, false)}>
          All
        </button>
        {buttons.map((c) => (
          <button
            key={c.id}
            className={`chip ${filter.chips.has(c.id) ? 'active' : ''}`}
            style={{ borderLeftColor: `var(--c-${c.effect})` }}
            title={`${c.title ?? c.label}. Cmd/Ctrl-click to select several`}
            onClick={(e) => onChip(c.id, e.metaKey || e.ctrlKey)}
          >
            {c.label}
          </button>
        ))}
      </div>
      <Dropdown icon label={<Settings size={14} aria-hidden />} title="Choose filter buttons">
        <PinSection heading="Steps" chips={options.kinds} pinned={pinned} onPin={onPin} />
        <PinSection heading="Tool groups" chips={options.groups} pinned={pinned} onPin={onPin} />
        <PinSection heading="Single tools" chips={options.tools} pinned={pinned} onPin={onPin} />
      </Dropdown>
    </div>
  )
}

type StatusBarProps = {
  session: Session
  shown: Step[]
  filtered: boolean
  onFilterText: (text: string) => void
}

function sumUsage(steps: Step[]) {
  let tin = 0
  let tout = 0
  let cost = 0
  let hasCost = false
  for (const s of steps) {
    if (!s.usage) continue
    tin += s.usage.in
    tout += s.usage.out
    if (s.usage.cost !== null) {
      cost += s.usage.cost
      hasCost = true
    }
  }
  return { tin, tout, cost: hasCost ? cost : null }
}

export function StatusBar({ session, shown, filtered, onFilterText }: StatusBarProps) {
  const all = session.steps
  const pair = (a: number, b: number) => (filtered ? `${formatCount(a)} / ${formatCount(b)}` : formatCount(b))
  const tools = (xs: Step[]) => xs.filter((s) => s.kind === 'tool').length
  const errors = (xs: Step[]) => xs.filter((s) => s.status === 'error').length
  const usageAll = sumUsage(all)
  const usageShown = sumUsage(shown)
  const llm = all.find((s) => s.model)
  const wall = session.startedAt !== null && session.endedAt !== null ? session.endedAt - session.startedAt : null
  const errorCount = errors(all)

  return (
    <div className="statusbar">
      <span>
        {pair(shown.length, all.length)} steps · {pair(tools(shown), tools(all))} tools
      </span>
      <span title="prompt tokens in / completion tokens out, summed over LLM calls">
        {usageAll.tin + usageAll.tout === 0
          ? 'no usage recorded'
          : `${pair(usageShown.tin, usageAll.tin)} in · ${pair(usageShown.tout, usageAll.tout)} out tokens`}
      </span>
      {usageAll.cost !== null && <span>${usageAll.cost.toFixed(4)}</span>}
      {errorCount > 0 && (
        <button className="seg-btn err" onClick={() => onFilterText('status:error')}>
          <TriangleAlert size={12} aria-hidden /> {pair(errors(shown), errorCount)} error{errorCount === 1 ? '' : 's'}
        </button>
      )}
      <span className="finish">Finish: {formatMs(wall)}</span>
      {session.turn && (
        <span className={session.turn.reason === 'answer' ? '' : 'err'}>Ended: {session.turn.reason}</span>
      )}
      {llm?.model && <span title={llm.model}>{shortModel(llm.model)}</span>}
    </div>
  )
}
