import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const args = process.argv.slice(2)
const live = args.includes('--live')
const target = Number(args.find((a) => /^\d+$/.test(a)) ?? 100_000)

const stateDir = resolve(process.env.SHREK_STATE_DIR ?? '.fixtures')
const dir = join(stateDir, 'projects', 'fixture')
mkdirSync(dir, { recursive: true })
const file = join(dir, `${target}.jsonl`)

const TOOLS = ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash'] as const
const cwd = '/repo/fixture'
let clock = Date.parse('2026-10-01T00:00:00.000Z')
let uuid = 0
let call = 0
let llm = 0
let rows = 0

function line(type: string, fields: Record<string, unknown>): string {
  uuid += 1
  return JSON.stringify({ type, uuid: `f${uuid}`, timestamp: new Date(clock).toISOString(), sessionId: 'fixture', ...fields })
}

function argsFor(tool: (typeof TOOLS)[number], n: number): Record<string, unknown> {
  if (tool === 'Bash') return { command: `bun test src/module${n % 50}.test.ts` }
  if (tool === 'Grep') return { pattern: `symbol${n % 97}` }
  if (tool === 'Glob') return { pattern: `src/**/*${n % 13}.ts` }
  return { file_path: `${cwd}/src/module${n % 50}.ts`, content: 'x'.repeat(n % 400) }
}

function round(): string[] {
  llm += 1
  const latency = 300 + ((llm * 37) % 1500)
  clock += latency
  const calls = Array.from({ length: 1 + (llm % 3) }, (_, k) => {
    call += 1
    const tool = TOOLS[(llm + k) % TOOLS.length]!
    return { type: 'function', id: `call${call}`, function: { name: tool, arguments: JSON.stringify(argsFor(tool, call)) } }
  })
  const out = [
    line('message', {
      message: {
        role: 'assistant',
        content: `Checking step ${llm}.`,
        reasoning: `Round ${llm}: look at the next file and run the tests again.`,
        tool_calls: calls,
      },
      step: llm,
      model: 'fixture/model-large',
      latencyMs: latency,
      usage: { prompt_tokens: 1000 + llm * 3, completion_tokens: 40 + (llm % 200), cost: 0.0001, prompt_tokens_details: { cached_tokens: 800 } },
    }),
  ]
  rows += 3 + calls.length
  for (const c of calls) {
    const ms = 5 + ((call * 13) % 900)
    clock += ms
    const failed = call % 41 === 0
    const body = failed ? `Error: exit code 1\n${'stack line\n'.repeat(5)}` : `${c.function.name} ok\n${'output line\n'.repeat(1 + (call % 30))}`
    out.push(line('message', { message: { role: 'tool', tool_call_id: c.id, content: body }, durationMs: ms, isError: failed }))
  }
  return out
}

const head = [
  line('session', { cwd, argv: ['-p', `fixture with ${target} rows`] }),
  line('message', { message: { role: 'system', content: 'You are shrek, a fixture.' } }),
  line('message', { message: { role: 'user', content: `Synthetic run with about ${target} rows` } }),
]
rows += 2
const body: string[] = []
while (rows < target) body.push(...round())
writeFileSync(file, `${[...head, ...body].join('\n')}\n`)
console.log(`${file}: ${rows} rows, ${uuid} lines`)

if (live) {
  console.log('appending a round every 200 ms, ctrl-c to stop')
  setInterval(() => appendFileSync(file, `${round().join('\n')}\n`), 200)
}
