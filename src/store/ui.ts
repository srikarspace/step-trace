import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { DEFAULT_PINNED } from '@/features/filter/filter'

export type Tab = 'Summary' | 'Input' | 'Returned' | 'Content' | 'Raw'
export type Theme = 'light' | 'dark'
export type Range = readonly [number, number]

type Prefs = {
  live: boolean
  hideThinking: boolean
  tab: Tab
  theme: Theme | null
  pinned: string[]
  tableWidth: number
  columns: Record<string, number>
}

type View = {
  file: string | null
  selectedId: string | null
  panelOpen: boolean
  collapsed: ReadonlySet<string>
  text: string
  chips: ReadonlySet<string>
  range: Range | null
  flash: { id: string; at: number } | null
}

type Actions = {
  setFile: (file: string | null) => void
  select: (id: string) => void
  moveTo: (id: string) => void
  jumpTo: (id: string) => void
  closePanel: () => void
  toggleGroup: (id: string) => void
  setText: (text: string) => void
  toggleChip: (id: string | null, additive: boolean) => void
  togglePin: (id: string) => void
  setRange: (range: Range | null) => void
  clearFilters: () => void
  setLive: (live: boolean) => void
  setHideThinking: (on: boolean) => void
  setTab: (tab: Tab) => void
  setTheme: (theme: Theme) => void
  setTableWidth: (width: number) => void
  setColumnWidth: (id: string, width: number) => void
}

export type UiState = Prefs & View & Actions

const params = new URLSearchParams(location.search)

function toggled(set: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(set)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

const emptyView = {
  selectedId: null,
  panelOpen: false,
  collapsed: new Set<string>(),
  flash: null,
} satisfies Partial<View>

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      live: true,
      hideThinking: false,
      tab: 'Summary',
      theme: null,
      pinned: DEFAULT_PINNED,
      tableWidth: 32,
      columns: {},

      file: params.get('file'),
      selectedId: params.get('step'),
      panelOpen: params.has('step'),
      collapsed: new Set(),
      text: '',
      chips: new Set(),
      range: null,
      flash: null,

      setFile: (file) => set({ file, ...emptyView }),
      select: (id) => set({ selectedId: id, panelOpen: true }),
      moveTo: (id) => set({ selectedId: id }),
      jumpTo: (id) => set({ selectedId: id, panelOpen: true, flash: { id, at: performance.now() } }),
      closePanel: () => set({ panelOpen: false }),
      toggleGroup: (id) => set((s) => ({ collapsed: toggled(s.collapsed, id) })),
      setText: (text) => set({ text }),
      toggleChip: (id, additive) =>
        set((s) => {
          if (id === null) return { chips: new Set() }
          if (additive) return { chips: toggled(s.chips, id) }
          return { chips: s.chips.has(id) && s.chips.size === 1 ? new Set() : new Set([id]) }
        }),
      togglePin: (id) =>
        set((s) => {
          if (!s.pinned.includes(id)) return { pinned: [...s.pinned, id] }
          const chips = s.chips.has(id) ? toggled(s.chips, id) : s.chips
          return { pinned: s.pinned.filter((p) => p !== id), chips }
        }),
      setRange: (range) => set({ range }),
      clearFilters: () => set({ text: '', chips: new Set(), range: null }),
      setLive: (live) => set({ live }),
      setHideThinking: (hideThinking) => set({ hideThinking }),
      setTab: (tab) => set({ tab }),
      setTheme: (theme) => set({ theme }),
      setTableWidth: (tableWidth) => set({ tableWidth }),
      setColumnWidth: (id, width) => set((s) => ({ columns: { ...s.columns, [id]: width } })),
    }),
    {
      name: 'steptrace:v2',
      storage: createJSONStorage(() => localStorage),
      partialize: (s): Prefs => ({
        live: s.live,
        hideThinking: s.hideThinking,
        tab: s.tab,
        theme: s.theme,
        pinned: s.pinned,
        tableWidth: s.tableWidth,
        columns: s.columns,
      }),
    },
  ),
)
