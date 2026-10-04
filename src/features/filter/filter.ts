import type { Effect, Step } from '@/parser/types'

export type Chip = { id: string; label: string; effect: Effect; title?: string }
type ChipDef = Chip & { test: (s: Step) => boolean }

const tools = (...names: string[]) => (s: Step) => s.toolName !== undefined && names.includes(s.toolName)

const KIND_CHIPS: ChipDef[] = [
  { id: 'kind:prompt', label: 'Prompt', effect: 'model', title: 'Your requests', test: (s) => s.kind === 'prompt' },
  {
    id: 'kind:model',
    label: 'Model',
    effect: 'model',
    title: 'LLM responses, reasoning and answers',
    test: (s) => s.kind === 'llm' || s.kind === 'thinking' || s.kind === 'text',
  },
  { id: 'kind:system', label: 'System', effect: 'meta', title: 'System prompt and run end', test: (s) => s.kind === 'system' },
]

const GROUP_CHIPS: ChipDef[] = [
  { id: 'group:read', label: 'Read', effect: 'read', title: 'Read, Grep, Glob', test: tools('Read', 'Grep', 'Glob') },
  { id: 'group:write', label: 'Write', effect: 'mutate', title: 'Write, Edit', test: tools('Write', 'Edit') },
  { id: 'group:exec', label: 'Exec', effect: 'mutate', title: 'Bash', test: tools('Bash') },
]

export const DEFAULT_PINNED = ['kind:prompt', 'kind:model', 'group:read', 'group:write', 'group:exec', 'kind:system']

const KNOWN_TOOLS: [string, Effect][] = [
  ['Bash', 'mutate'],
  ['Edit', 'mutate'],
  ['Glob', 'read'],
  ['Grep', 'read'],
  ['Read', 'read'],
  ['Write', 'mutate'],
]

const DEFS = new Map([...KIND_CHIPS, ...GROUP_CHIPS].map((c) => [c.id, c]))
const strip = ({ id, label, effect, title }: ChipDef): Chip => ({ id, label, effect, title })

function chipMatches(id: string, step: Step): boolean {
  if (id.startsWith('tool:')) return step.toolName === id.slice(5)
  return DEFS.get(id)?.test(step) ?? false
}

export type ChipOptions = { kinds: Chip[]; groups: Chip[]; tools: Chip[] }

export function chipOptions(steps: Step[]): ChipOptions {
  const byName = new Map<string, Chip>()
  const add = (name: string, effect: Effect) => {
    if (!byName.has(name)) byName.set(name, { id: `tool:${name}`, label: name, effect })
  }
  for (const [name, effect] of KNOWN_TOOLS) add(name, effect)
  for (const step of steps) if (step.toolName) add(step.toolName, step.effect)
  return {
    kinds: KIND_CHIPS.map(strip),
    groups: GROUP_CHIPS.map(strip),
    tools: [...byName.values()].sort((a, b) => a.label.localeCompare(b.label)),
  }
}

export function chipButtons(options: ChipOptions, pinned: ReadonlySet<string>): Chip[] {
  const [prompt, model, system] = options.kinds
  const row = [prompt, model, ...options.groups, system, ...options.tools].filter((c): c is Chip => c !== undefined)
  return row.filter((c) => pinned.has(c.id))
}

export type Token = { key: string | null; value: string; negate: boolean; valid: boolean }

const KEYS: Record<string, (s: Step, v: string) => boolean> = {
  tool: (s, v) => (s.toolName ?? '').toLowerCase() === v,
  status: (s, v) => s.status === v,
  kind: (s, v) => s.kind === v,
  model: (s, v) => (s.model ?? '').toLowerCase().includes(v),
}
export const FILTER_KEYS = Object.keys(KEYS)

export function parseFilter(text: string): Token[] {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((raw) => {
      const negate = raw.startsWith('-') && raw.length > 1
      const body = negate ? raw.slice(1) : raw
      const colon = body.indexOf(':')
      if (colon <= 0) return { key: null, value: body.toLowerCase(), negate, valid: true }
      const key = body.slice(0, colon).toLowerCase()
      const value = body.slice(colon + 1).toLowerCase()
      return { key, value, negate, valid: key in KEYS && value !== '' }
    })
}

const haystacks = new WeakMap<Step, string>()
export function haystack(step: Step): string {
  let text = haystacks.get(step)
  if (text === undefined) {
    const input = step.input === undefined ? (step.badArgs ?? '') : JSON.stringify(step.input)
    text = [step.label, step.name, step.text ?? '', step.result ?? '', input].join('\n').toLowerCase()
    haystacks.set(step, text)
  }
  return text
}

function tokenMatches(step: Step, token: Token): boolean {
  if (token.key === null) return haystack(step).includes(token.value)
  return KEYS[token.key]!(step, token.value)
}

export function matchesText(step: Step, tokens: Token[]): boolean {
  const byKey = new Map<string, Token[]>()
  for (const token of tokens) {
    if (!token.valid) continue
    if (token.negate || token.key === null) {
      if (tokenMatches(step, token) === token.negate) return false
      continue
    }
    byKey.set(token.key, [...(byKey.get(token.key) ?? []), token])
  }
  for (const group of byKey.values()) {
    if (!group.some((token) => tokenMatches(step, token))) return false
  }
  return true
}

export type FilterState = {
  text: string
  chips: ReadonlySet<string>
  hideThinking: boolean
  range: readonly [number, number] | null
}

export function applyFilters(steps: Step[], f: FilterState): Step[] {
  const tokens = parseFilter(f.text).filter((t) => t.valid)
  const chips = [...f.chips]
  return steps.filter((step) => {
    if (f.hideThinking && step.kind === 'thinking') return false
    if (chips.length > 0 && !chips.some((id) => chipMatches(id, step))) return false
    if (f.range) {
      const end = step.tsEnd ?? step.tsStart
      if (end < f.range[0] || step.tsStart > f.range[1]) return false
    }
    return tokens.length === 0 || matchesText(step, tokens)
  })
}
