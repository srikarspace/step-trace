import { describe, expect, test } from 'bun:test'
import type { Step } from '@/parser/types'
import { applyFilters, chipButtons, chipOptions, DEFAULT_PINNED, parseFilter, type FilterState } from './filter'

const step = (over: Partial<Step>): Step => ({
  id: over.name ?? 'x',
  index: 0,
  kind: 'tool',
  effect: 'mutate',
  status: 'ok',
  label: 'x',
  name: 'x',
  type: 'x',
  depth: 0,
  parentId: null,
  childCount: 0,
  childErrors: 0,
  tsStart: 0,
  tsEnd: null,
  durationMs: null,
  initiatorId: null,
  bytes: null,
  rawLines: [],
  ...over,
})

const steps = [
  step({ name: 'Bash · ls', toolName: 'Bash' }),
  step({ name: 'Bash · rm', toolName: 'Bash', status: 'error' }),
  step({ name: 'Read · a.ts', toolName: 'Read', effect: 'read', tsStart: 100, tsEnd: 200 }),
  step({ name: 'think', kind: 'thinking', effect: 'model' }),
]
const base: FilterState = { text: '', chips: new Set(), hideThinking: false, range: null }
const names = (f: Partial<FilterState>) => applyFilters(steps, { ...base, ...f }).map((s) => s.name)

describe('filters', () => {
  test('tool:bash -status:error → only ok Bash steps', () => {
    expect(names({ text: 'tool:bash -status:error' })).toEqual(['Bash · ls'])
  })
  test('invalid token (tool:, nope:x) ignored, table not emptied', () => {
    expect(parseFilter('tool: nope:x').every((t) => !t.valid)).toBe(true)
    expect(names({ text: 'tool: nope:x' })).toHaveLength(steps.length)
  })
  test('repeats of one key OR', () => {
    expect(names({ text: 'tool:read tool:bash' })).toHaveLength(3)
  })
  test('chips OR within, AND with text', () => {
    expect(names({ chips: new Set(['tool:Read', 'tool:Bash']), text: 'ls' })).toEqual(['Bash · ls'])
  })
  test('kind and tool chips OR together', () => {
    expect(names({ chips: new Set(['kind:model', 'tool:Read']) })).toEqual(['Read · a.ts', 'think'])
  })
  test('default buttons are the original row: Prompt, Model, Read, Write, Exec, System', () => {
    expect(chipButtons(chipOptions(steps), new Set(DEFAULT_PINNED)).map((c) => c.label)).toEqual([
      'Prompt',
      'Model',
      'Read',
      'Write',
      'Exec',
      'System',
    ])
  })
  test('group chips match their member tools', () => {
    expect(names({ chips: new Set(['group:exec']) })).toEqual(['Bash · ls', 'Bash · rm'])
    expect(names({ chips: new Set(['group:read']) })).toEqual(['Read · a.ts'])
  })
  test('tool options include known shrek tools and any tool a session called, once each, sorted', () => {
    const { tools } = chipOptions([...steps, step({ name: 'm', toolName: 'Mystery', effect: 'meta' })])
    expect(tools.map((c) => c.label)).toEqual(['Bash', 'Edit', 'Glob', 'Grep', 'Mystery', 'Read', 'Write'])
  })
  test('bare text searches name case-insensitively', () => {
    expect(names({ text: 'A.TS' })).toEqual(['Read · a.ts'])
  })
  test('hide thinking', () => {
    expect(names({ hideThinking: true })).not.toContain('think')
  })
  test('time range keeps overlapping steps', () => {
    expect(names({ range: [150, 160] })).toEqual(['Read · a.ts'])
  })
})
