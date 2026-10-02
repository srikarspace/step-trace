import { useCallback, useDeferredValue, useEffect, useEffectEvent, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { SessionEntry } from '../../server/api'
import { parseShrek } from '../parser/shrek'
import type { Session } from '../parser/types'
import { FilterBar, StatusBar, Toolbar } from './Bars'
import { DetailPanel, type Tab } from './DetailPanel'
import { applyFilters, chipOptions, DEFAULT_PINNED, type FilterState } from './filter'
import { Overview } from './Overview'
import { StepTable } from './StepTable'

const POLL_MS = 1000
const params = new URLSearchParams(location.search)

/** Versioned so a shape change never reads stale values. Bump when a stored value changes meaning. */
const STORAGE_PREFIX = 'steptrace:v1:'

function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

function store(key: string, value: unknown) {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value))
  } catch {}
}

function useSystemDark(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = matchMedia('(prefers-color-scheme: dark)')
      query.addEventListener('change', onChange)
      return () => query.removeEventListener('change', onChange)
    },
    () => matchMedia('(prefers-color-scheme: dark)').matches,
  )
}

export function App() {
  const [sessions, setSessions] = useState<SessionEntry[]>([])
  const [root, setRoot] = useState('')
  const [file, setFile] = useState<string | null>(params.get('file'))
  const [session, setSession] = useState<Session | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [live, setLive] = useState(() => readStored('live', true))

  const [filter, setFilter] = useState<FilterState>({
    text: '',
    chips: new Set(),
    hideThinking: readStored('hideThinking', false),
    range: null,
  })
  const [selectedId, setSelectedId] = useState<string | null>(params.get('step'))
  const [panelOpen, setPanelOpen] = useState(params.has('step'))
  const [tab, setTab] = useState<Tab>(() => readStored('tab', 'Summary'))
  const [flashId, setFlashId] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set())
  const [tableWidth, setTableWidth] = useState(() => readStored('tableWidth', 32))
  const [themeChoice, setThemeChoice] = useState<'light' | 'dark' | null>(() => readStored('theme', null))
  const systemDark = useSystemDark()
  const theme = themeChoice ?? (systemDark ? 'dark' : 'light')
  const [pinned, setPinned] = useState<ReadonlySet<string>>(() => new Set(readStored('chips', DEFAULT_PINNED)))

  const newestRef = useRef<string | undefined>(undefined)
  const loadedRef = useRef<{ file: string; mtimeMs: number; size: number } | null>(null)
  const mainRef = useRef<HTMLDivElement>(null)

  const fileRef = useRef(file)

  const loadSession = useCallback(async (path: string, entry?: SessionEntry) => {
    let text: string
    try {
      const res = await fetch(`/api/session?path=${encodeURIComponent(path)}`)
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        if (fileRef.current === path) setLoadError(body?.error ?? `Could not load ${path} (HTTP ${res.status})`)
        return
      }
      text = await res.text()
    } catch {
      if (fileRef.current === path) setLoadError('steptrace server is not running. Start it with bun run dev.')
      return
    }
    // A slower response for a session the user already left must not replace the one on screen.
    if (fileRef.current !== path) return
    loadedRef.current = { file: path, mtimeMs: entry?.mtimeMs ?? 0, size: entry?.size ?? text.length }
    setLoadError(null)
    setSession(parseShrek(text, path))
  }, [])

  const fetchSessions = useCallback(async () => {
    const res = await fetch('/api/sessions')
    const data = (await res.json()) as { root: string; sessions: SessionEntry[] }
    setRoot(data.root)
    setSessions(data.sessions)
    newestRef.current = data.sessions[0]?.path
    return data.sessions
  }, [])

  // First load: explicit ?file, else the newest session.
  useEffect(() => {
    fetchSessions()
      .then((list) => setFile((current) => current ?? list[0]?.path ?? null))
      .catch(() => setLoadError('steptrace server is not running. Start it with bun run dev.'))
  }, [fetchSessions])

  // Declared before the load effect so it updates first.
  useEffect(() => {
    fileRef.current = file
  }, [file])

  useEffect(() => {
    // `sessions` is deliberately not a dependency: polling reloads the file when it changes.
    if (file) void loadSession(file, sessions.find((s) => s.path === file))
  }, [file, loadSession])

  // Live: reload the open file when it grows, and jump to a newer session if we were on the newest.
  useEffect(() => {
    if (!live) return
    const timer = setInterval(async () => {
      const before = newestRef.current
      const list = await fetchSessions().catch(() => null)
      if (!list) return
      const loaded = loadedRef.current
      if (list[0] && before && list[0].path !== before && loaded?.file === before) {
        setSelectedId(null)
        setPanelOpen(false)
        setFile(list[0].path)
        return
      }
      const entry = list.find((s) => s.path === loaded?.file)
      if (entry && loaded && (entry.mtimeMs !== loaded.mtimeMs || entry.size !== loaded.size)) {
        void loadSession(entry.path, entry)
      }
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [live, fetchSessions, loadSession])

  const steps = session?.steps ?? []
  const byId = useMemo(() => new Map(steps.map((s) => [s.id, s])), [steps])
  const chipOpts = useMemo(() => chipOptions(steps), [steps])
  // Typing stays responsive; the table catches up when React is idle.
  const deferredText = useDeferredValue(filter.text)
  const matched = useMemo(() => applyFilters(steps, { ...filter, text: deferredText }), [steps, filter, deferredText])
  const shown = useMemo(
    () => (collapsed.size === 0 ? matched : matched.filter((s) => !(s.parentId && collapsed.has(s.parentId)))),
    [matched, collapsed],
  )
  const isFiltered =
    filter.text.trim() !== '' || filter.chips.size > 0 || filter.hideThinking || filter.range !== null

  const span = useMemo(() => {
    const start = session?.startedAt ?? 0
    // A loop, not Math.max(...spread): spreading 30k values can overflow the argument limit.
    let end = session?.endedAt ?? start
    for (const s of steps) end = Math.max(end, s.tsEnd ?? s.tsStart)
    return { start, end, span: Math.max(1, end - start) }
  }, [session, steps])
  const waterfall = useMemo(() => ({ start: span.start, span: span.span }), [span])

  // Selection filtered or collapsed away → nearest visible row, never cleared. Derived, not stored.
  const activeId = useMemo(() => {
    if (!selectedId || shown.length === 0) return selectedId
    if (shown.some((s) => s.id === selectedId)) return selectedId
    const was = byId.get(selectedId)
    if (!was) return selectedId
    const target = was.parentId && collapsed.has(was.parentId) ? (byId.get(was.parentId) ?? was) : was
    return shown.reduce((best, s) => (Math.abs(s.index - target.index) < Math.abs(best.index - target.index) ? s : best)).id
  }, [shown, selectedId, byId, collapsed])

  const toggleGroup = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // URL mirrors file + selected step, so a step is linkable.
  useEffect(() => {
    const url = new URL(location.href)
    if (file) url.searchParams.set('file', file)
    if (activeId && panelOpen) url.searchParams.set('step', activeId)
    else url.searchParams.delete('step')
    history.replaceState(null, '', url)
  }, [file, activeId, panelOpen])

  const select = useCallback((id: string) => {
    setSelectedId(id)
    setPanelOpen(true)
  }, [])

  const jumpTo = useCallback(
    (id: string) => {
      select(id)
      setFlashId(null)
      requestAnimationFrame(() => setFlashId(id))
    },
    [select],
  )

  // Keyboard: ↑/↓ move, Home/End jump, ←/→ collapse, Esc closes the panel.
  // An effect event reads the latest rows and selection without re-subscribing on every change.
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('input, select, textarea')) {
      if (e.key === 'Escape') target.blur()
      return
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
      e.preventDefault()
      document.getElementById('filter')?.focus()
      return
    }
    if (e.key === 'Escape') {
      setPanelOpen(false)
      return
    }
    if (shown.length === 0) return
    const at = shown.findIndex((s) => s.id === activeId)
    const current = shown[at]
    // ←/→ collapse and expand an LLM response, like a DevTools tree.
    if (current && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      const group = current.childCount > 0 ? current : current.parentId ? byId.get(current.parentId) : undefined
      if (!group) return
      const isCollapsed = collapsed.has(group.id)
      if (e.key === 'ArrowLeft' && !isCollapsed) toggleGroup(group.id)
      if (e.key === 'ArrowRight' && isCollapsed) toggleGroup(group.id)
      if (e.key === 'ArrowLeft') setSelectedId(group.id)
      e.preventDefault()
      return
    }
    let next: number | null = null
    if (e.key === 'ArrowDown') next = at === -1 ? 0 : Math.min(shown.length - 1, at + 1)
    if (e.key === 'ArrowUp') next = at === -1 ? 0 : Math.max(0, at - 1)
    if (e.key === 'Home') next = 0
    if (e.key === 'End') next = shown.length - 1
    if (next === null) return
    e.preventDefault()
    setSelectedId(shown[next]!.id)
  })
  useEffect(() => {
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function onChip(id: string | null, additive: boolean) {
    setFilter((f) => {
      if (id === null) return { ...f, chips: new Set() }
      if (!additive) return { ...f, chips: f.chips.has(id) && f.chips.size === 1 ? new Set() : new Set([id]) }
      const chips = new Set(f.chips)
      if (chips.has(id)) chips.delete(id)
      else chips.add(id)
      return { ...f, chips }
    })
  }

  function onPin(id: string) {
    const next = new Set(pinned)
    if (next.has(id)) {
      next.delete(id)
      // A hidden button must not keep filtering.
      setFilter((f) => (f.chips.has(id) ? { ...f, chips: new Set([...f.chips].filter((c) => c !== id)) } : f))
    } else next.add(id)
    setPinned(next)
    store('chips', [...next])
  }

  function startResize(e: React.PointerEvent) {
    const main = mainRef.current
    if (!main) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const rect = main.getBoundingClientRect()
    const move = (ev: PointerEvent) => {
      const pct = Math.min(80, Math.max(15, ((ev.clientX - rect.left) / rect.width) * 100))
      setTableWidth(pct)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setTableWidth((w) => {
        store('tableWidth', w)
        return w
      })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const selected = activeId ? byId.get(activeId) : undefined
  const showPanel = panelOpen && selected !== undefined && session !== null
  const emptyText = loadError
    ? loadError
    : !file
      ? `No shrek sessions in ${root || '~/.shrek/projects'}. Run: bun run bin/shrek.ts -p "…"`
      : !session
        ? 'Loading…'
        : steps.length === 0
          ? 'This session has no steps yet.'
          : 'No steps match the filter.'

  return (
    <div className="app">
      <Toolbar
        sessions={sessions}
        file={file}
        live={live}
        hideThinking={filter.hideThinking}
        warnings={session?.warnings ?? []}
        onLive={(on) => {
          setLive(on)
          store('live', on)
        }}
        onClear={() => setFilter((f) => ({ ...f, text: '', chips: new Set(), range: null }))}
        onReload={() => {
          void fetchSessions()
          if (file) void loadSession(file)
        }}
        onFile={(path) => {
          setCollapsed(new Set())
          setSelectedId(null)
          setPanelOpen(false)
          setFile(path)
        }}
        theme={theme}
        onToggleTheme={() => {
          const next = theme === 'dark' ? 'light' : 'dark'
          document.documentElement.dataset.theme = next
          setThemeChoice(next)
          store('theme', next)
        }}
        onHideThinking={(on) => {
          store('hideThinking', on)
          setFilter((f) => ({ ...f, hideThinking: on }))
        }}
      />
      <FilterBar
        filter={filter}
        onText={(text) => setFilter((f) => ({ ...f, text }))}
        options={chipOpts}
        pinned={pinned}
        onChip={onChip}
        onPin={onPin}
      />
      <Overview
        steps={steps}
        start={span.start}
        end={span.end}
        selectedId={activeId}
        range={filter.range}
        theme={theme}
        onRange={(range) => setFilter((f) => ({ ...f, range }))}
      />
      <div
        ref={mainRef}
        className={`main ${showPanel ? 'has-panel' : ''}`}
        style={{ '--table-w': `${tableWidth}%` } as React.CSSProperties}
      >
        <StepTable
          steps={shown}
          byId={byId}
          selectedId={activeId}
          collapsed={collapsed}
          onToggle={toggleGroup}
          compact={showPanel}
          flashId={flashId}
          waterfall={waterfall}
          followTail={live && !showPanel}
          onSelect={select}
          onJump={jumpTo}
          emptyText={emptyText}
        />
        {showPanel && (
          <>
            <div className="divider" onPointerDown={startResize} />
            <DetailPanel
              session={session}
              step={selected}
              initiator={selected.initiatorId ? byId.get(selected.initiatorId) : undefined}
              tab={tab}
              onTab={(t) => {
                setTab(t)
                store('tab', t)
              }}
              onSelect={jumpTo}
              onClose={() => setPanelOpen(false)}
            />
          </>
        )}
      </div>
      {session && (
        <StatusBar
          session={session}
          shown={shown}
          filtered={isFiltered}
          onFilterText={(text) => setFilter((f) => ({ ...f, text }))}
        />
      )}
    </div>
  )
}
