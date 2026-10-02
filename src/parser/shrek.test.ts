import { describe, expect, test } from 'bun:test'
import { parseShrek } from './shrek'

const T0 = Date.parse('2026-10-01T00:00:00.000Z')
let n = 0

function line(type: string, fields: Record<string, unknown>, atMs: number): string {
  n += 1
  return JSON.stringify({
    type,
    uuid: `u${n}`,
    timestamp: new Date(T0 + atMs).toISOString(),
    sessionId: 's1',
    ...fields,
  })
}

const session = (at = 0) => line('session', { cwd: '/repo', argv: ['-p', 'hi'] }, at)
const user = (content: string, at: number) => line('message', { message: { role: 'user', content } }, at)
const call = (id: string, name: string, args: string) => ({
  type: 'function',
  id,
  function: { name, arguments: args },
})
const assistant = (message: Record<string, unknown>, at: number, meta: Record<string, unknown> = {}) =>
  line('message', { message: { role: 'assistant', content: null, ...message }, ...meta }, at)
const tool = (id: string, content: string, at: number, meta: Record<string, unknown> = {}) =>
  line('message', { message: { role: 'tool', tool_call_id: id, content }, ...meta }, at)

const kinds = (text: string) => parseShrek(text).steps.map((s) => s.kind)

describe('parseShrek', () => {
  test('one assistant message with reasoning, text and two tool calls → llm + thinking + text + 2 tools', () => {
    const text = [
      session(),
      user('do it', 10),
      assistant(
        {
          reasoning: 'think',
          content: 'ok',
          tool_calls: [call('c1', 'Read', '{"file_path":"/repo/a.ts"}'), call('c2', 'Bash', '{"command":"ls"}')],
        },
        500,
      ),
    ].join('\n')
    const { steps } = parseShrek(text)
    expect(steps.map((s) => s.kind)).toEqual(['prompt', 'llm', 'thinking', 'text', 'tool', 'tool'])
    expect(new Set(steps.map((s) => s.id)).size).toBe(steps.length)
    expect(steps[4]).toMatchObject({ label: 'Read', name: 'a.ts', depth: 1, parentId: steps[1]?.id })
    expect(steps[5]).toMatchObject({ label: 'Bash', name: 'ls' })
    expect(steps[1]).toMatchObject({ label: 'LLM response 1', name: 'asked to run Read, Bash', childCount: 4 })
    expect(steps[3]?.label).toBe('Message')
  })

  test('tool call + matching result → one step, ok, duration from timestamps', () => {
    const text = [
      session(),
      user('x', 0),
      assistant({ tool_calls: [call('c1', 'Read', '{"file_path":"a"}')] }, 1000),
      tool('c1', 'contents', 1040),
    ].join('\n')
    const steps = parseShrek(text).steps.filter((s) => s.kind === 'tool')
    expect(steps).toHaveLength(1)
    expect(steps[0]).toMatchObject({ status: 'ok', durationMs: 40, result: 'contents', bytes: 8 })
  })

  test('tool call with no result → pending, no end, no duration', () => {
    const text = [session(), assistant({ tool_calls: [call('c1', 'Bash', '{"command":"x"}')] }, 10)].join('\n')
    const step = parseShrek(text).steps.find((s) => s.kind === 'tool')
    expect(step).toMatchObject({ status: 'pending', tsEnd: null, durationMs: null })
  })

  test('result starting with "Error:" and no isError field → error', () => {
    const text = [session(), assistant({ tool_calls: [call('c1', 'Edit', '{}')] }, 10), tool('c1', 'Error: nope', 20)]
    const { steps } = parseShrek(text.join('\n'))
    expect(steps.find((s) => s.kind === 'tool')?.status).toBe('error')
    expect(steps.find((s) => s.kind === 'llm')?.childErrors).toBe(1)
  })

  test('isError meta wins over the text heuristic, durationMs meta wins over timestamps', () => {
    const text = [
      session(),
      assistant({ tool_calls: [call('c1', 'Bash', '{"command":"x"}')] }, 10),
      tool('c1', 'Error: looks bad but is fine', 500, { isError: false, durationMs: 7 }),
    ]
    const step = parseShrek(text.join('\n')).steps.find((s) => s.kind === 'tool')
    expect(step).toMatchObject({ status: 'ok', durationMs: 7, tsEnd: T0 + 500, tsStart: T0 + 493 })
  })

  test('arguments that are not JSON → badArgs kept, no throw', () => {
    const text = [session(), assistant({ tool_calls: [call('c1', 'Read', '{oops')] }, 10)].join('\n')
    const step = parseShrek(text).steps.find((s) => s.kind === 'tool')
    expect(step?.badArgs).toBe('{oops')
    expect(step?.input).toBeUndefined()
  })

  test('llm step carries usage, model and latency from meta; initiator is the prompt', () => {
    const text = [
      session(),
      user('x', 0),
      assistant({ content: 'hi' }, 900, {
        step: 1,
        model: 'm/x',
        latencyMs: 800,
        usage: { prompt_tokens: 100, completion_tokens: 20, completion_tokens_details: { reasoning_tokens: 5 }, cost: 0 },
      }),
    ].join('\n')
    const { steps } = parseShrek(text)
    const llm = steps.find((s) => s.kind === 'llm')
    expect(llm).toMatchObject({ durationMs: 800, model: 'm/x', initiatorId: steps[0]?.id })
    expect(llm?.usage).toEqual({ in: 100, out: 20, reasoning: 5, cached: 0, cost: 0 })
  })

  test('without latency meta, llm duration = gap since previous line', () => {
    const text = [session(), user('x', 100), assistant({ content: 'hi' }, 1300)].join('\n')
    expect(parseShrek(text).steps.find((s) => s.kind === 'llm')?.durationMs).toBe(1200)
  })

  test('assistant with only content → Answer row; tool result preview is its first non-empty line', () => {
    const text = [
      session(),
      assistant({ tool_calls: [call('c1', 'Bash', '{"command":"x"}')] }, 1),
      tool('c1', '\n  main\nmore', 2),
      assistant({ content: 'done' }, 3),
    ].join('\n')
    const { steps } = parseShrek(text)
    expect(steps.find((s) => s.kind === 'tool')?.resultPreview).toBe('main')
    expect(steps.find((s) => s.kind === 'text')?.label).toBe('Answer')
    expect(steps.filter((s) => s.kind === 'llm').map((s) => s.name)).toEqual(['asked to run Bash', 'answered'])
  })

  test('second llm call is initiated by the last tool result', () => {
    const text = [
      session(),
      user('x', 0),
      assistant({ tool_calls: [call('c1', 'Read', '{}')] }, 10),
      tool('c1', 'r', 20),
      assistant({ content: 'done' }, 30),
    ].join('\n')
    const { steps } = parseShrek(text)
    const toolStep = steps.find((s) => s.kind === 'tool')
    expect(steps.filter((s) => s.kind === 'llm')[1]?.initiatorId).toBe(toolStep?.id)
  })

  test('turn.complete with reason other than answer → error system step + session.turn', () => {
    const text = [session(), line('turn.complete', { reason: 'max_steps', durationMs: 9, answer: '' }, 50)]
    const parsed = parseShrek(text.join('\n'))
    expect(parsed.turn).toEqual({ reason: 'max_steps', durationMs: 9, answer: '' })
    expect(parsed.steps.at(-1)).toMatchObject({ kind: 'system', status: 'error', label: 'Run stopped', name: 'reason: max_steps' })
  })

  test('unknown record type → generic system step naming it, no throw', () => {
    const steps = parseShrek([session(), line('future-thing', { a: 1 }, 5)].join('\n')).steps
    expect(steps).toHaveLength(1)
    expect(steps[0]?.name).toContain('future-thing')
  })

  test('truncated last line → earlier lines parsed, warning reported', () => {
    const text = `${[session(), user('x', 1)].join('\n')}\n{"type":"mess`
    const parsed = parseShrek(text)
    expect(kinds(text)).toEqual(['prompt'])
    expect(parsed.warnings[0]).toContain('truncated')
  })

  test('session line → metadata, not a step', () => {
    const parsed = parseShrek(session())
    expect(parsed.steps).toHaveLength(0)
    expect(parsed).toMatchObject({ cwd: '/repo', sessionId: 's1', argv: ['-p', 'hi'] })
  })

  test('effect: Read → read, Bash → mutate, unknown tool → meta', () => {
    const text = [
      session(),
      assistant({ tool_calls: [call('a', 'Read', '{}'), call('b', 'Bash', '{}'), call('c', 'Mystery', '{}')] }, 1),
    ].join('\n')
    expect(parseShrek(text).steps.filter((s) => s.kind === 'tool').map((s) => s.effect)).toEqual([
      'read',
      'mutate',
      'meta',
    ])
  })
})
