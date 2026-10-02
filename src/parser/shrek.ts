import type { Effect, Session, Step, StepStatus, Usage } from './types'

type Line = Record<string, unknown>
type NewStep = Omit<Step, 'index'>

const READ_TOOLS = new Set(['Read', 'Grep', 'Glob'])
const MUTATE_TOOLS = new Set(['Write', 'Edit', 'Bash'])
const NAME_MAX = 120

/** Unknown tools are `meta`, never guessed into read or mutate. */
export function effectOfTool(name: string): Effect {
  if (READ_TOOLS.has(name)) return 'read'
  if (MUTATE_TOOLS.has(name)) return 'mutate'
  return 'meta'
}

function isObject(value: unknown): value is Line {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

/** OpenAI content is a string or an array of parts. */
function contentText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content.map((part) => (isObject(part) ? (str(part.text) ?? '') : '')).join('')
  }
  return ''
}

function oneLine(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > NAME_MAX ? `${flat.slice(0, NAME_MAX)}…` : flat
}

const encoder = new TextEncoder()
function byteLength(text: string): number {
  return encoder.encode(text).length
}

function relativePath(path: string, cwd: string | null): string {
  if (cwd && path.startsWith(`${cwd}/`)) return path.slice(cwd.length + 1)
  return path
}

function primaryArg(tool: string, input: unknown, cwd: string | null): string {
  if (!isObject(input)) return ''
  if (tool === 'Bash') return str(input.command) ?? ''
  if (tool === 'Read' || tool === 'Write' || tool === 'Edit') {
    const path = str(input.file_path)
    return path ? relativePath(path, cwd) : ''
  }
  for (const value of Object.values(input)) if (typeof value === 'string') return value
  return ''
}

function readUsage(value: unknown): Usage | undefined {
  if (!isObject(value)) return undefined
  const completion = isObject(value.completion_tokens_details) ? value.completion_tokens_details : {}
  const prompt = isObject(value.prompt_tokens_details) ? value.prompt_tokens_details : {}
  return {
    in: num(value.prompt_tokens) ?? 0,
    out: num(value.completion_tokens) ?? 0,
    reasoning: num(completion.reasoning_tokens) ?? 0,
    cached: num(prompt.cached_tokens) ?? 0,
    cost: num(value.cost) ?? null,
  }
}

/** `arguments` is a JSON string the model wrote, so it can be anything. */
function parseArgs(raw: unknown): { input?: unknown; badArgs?: string } {
  if (typeof raw !== 'string') return { input: raw }
  try {
    return { input: JSON.parse(raw || '{}') }
  } catch {
    return { badArgs: raw }
  }
}

/** Parse one shrek transcript (`~/.shrek/projects/<slug>/<id>.jsonl`). Never throws. */
export function parseShrek(text: string, file = ''): Session {
  const session: Session = {
    file,
    sessionId: null,
    cwd: null,
    argv: [],
    startedAt: null,
    endedAt: null,
    turn: null,
    lines: [],
    steps: [],
    warnings: [],
  }

  const rawLines = text.split('\n')
  const lastNonEmpty = rawLines.findLastIndex((l) => l.trim() !== '')
  rawLines.forEach((raw, i) => {
    if (!raw.trim()) return
    try {
      session.lines.push(JSON.parse(raw))
    } catch {
      const why = i === lastNonEmpty ? 'truncated last line' : 'invalid JSON'
      session.warnings.push(`line ${i + 1}: ${why}, skipped`)
    }
  })

  const steps = session.steps
  const toolsByCallId = new Map<string, Step>()
  const stepsById = new Map<string, Step>()
  /** What caused the next LLM call: the prompt, then the latest tool result. */
  let cause: string | null = null
  let prevTs: number | null = null
  let llmCalls = 0
  let lastLlmId: string | null = null

  function push(step: NewStep): Step {
    const full = { ...step, index: steps.length }
    steps.push(full)
    stepsById.set(full.id, full)
    return full
  }

  function systemStep(id: string, i: number, ts: number, label: string, name: string, extra: Partial<NewStep> = {}) {
    return push({
      id,
      kind: 'system',
      effect: 'meta',
      status: 'none',
      label,
      name,
      type: 'system',
      depth: 0,
      parentId: null,
      childCount: 0,
      childErrors: 0,
      tsStart: ts,
      tsEnd: null,
      durationMs: null,
      initiatorId: null,
      bytes: null,
      rawLines: [i],
      ...extra,
    })
  }

  session.lines.forEach((value, i) => {
    if (!isObject(value)) {
      session.warnings.push(`record ${i}: not an object, skipped`)
      return
    }
    const line = value
    const parsedTs = Date.parse(str(line.timestamp) ?? '')
    const ts = Number.isNaN(parsedTs) ? (prevTs ?? 0) : parsedTs
    const uuid = str(line.uuid) ?? `record${i}`
    session.startedAt ??= ts
    session.endedAt = ts

    if (line.type === 'session') {
      session.sessionId = str(line.sessionId) ?? null
      session.cwd = str(line.cwd) ?? null
      session.argv = Array.isArray(line.argv) ? line.argv.filter((a) => typeof a === 'string') : []
    } else if (line.type === 'message' && isObject(line.message)) {
      readMessage(line, line.message, uuid, i, ts)
    } else if (line.type === 'turn.complete') {
      const reason = str(line.reason) ?? 'unknown'
      const answer = str(line.answer) ?? ''
      const durationMs = num(line.durationMs) ?? null
      const ok = reason === 'answer'
      session.turn = { reason, durationMs, answer }
      systemStep(`${uuid}#end`, i, ts, ok ? 'Run finished' : 'Run stopped', ok ? 'with an answer' : `reason: ${reason}`, {
        status: ok ? 'ok' : 'error',
        text: answer,
        bytes: byteLength(answer),
        durationMs,
        initiatorId: lastLlmId,
      })
    } else {
      systemStep(`${uuid}#unknown`, i, ts, 'Unknown record', String(line.type))
    }
    prevTs = ts
  })

  function readMessage(line: Line, message: Line, uuid: string, i: number, ts: number) {
    const role = str(message.role)
    const content = contentText(message.content)

    if (role === 'system') {
      systemStep(`${uuid}#0`, i, ts, 'System prompt', oneLine(content), { text: content, bytes: byteLength(content) })
      return
    }

    if (role === 'user') {
      const step = push({
        id: `${uuid}#0`,
        kind: 'prompt',
        effect: 'model',
        status: 'none',
        label: 'Your request',
        name: oneLine(content) || '(empty)',
        type: 'request',
        depth: 0,
        parentId: null,
        childCount: 0,
        childErrors: 0,
        text: content,
        tsStart: ts,
        tsEnd: null,
        durationMs: null,
        initiatorId: null,
        bytes: byteLength(content),
        rawLines: [i],
      })
      cause = step.id
      return
    }

    if (role === 'assistant') {
      readAssistant(line, message, content, uuid, i, ts)
      return
    }

    if (role === 'tool') {
      const callId = str(message.tool_call_id) ?? ''
      const step = toolsByCallId.get(callId)
      if (!step) {
        session.warnings.push(`record ${i}: tool result for unknown call ${callId}`)
        systemStep(`${uuid}#orphan`, i, ts, 'Tool result without a call', callId, {
          text: content,
          bytes: byteLength(content),
        })
        return
      }
      const isError = typeof line.isError === 'boolean' ? line.isError : content.startsWith('Error:')
      const measured = num(line.durationMs)
      step.result = content
      step.resultPreview = oneLine(content.split('\n').find((l) => l.trim()) ?? '')
      step.bytes = byteLength(content)
      step.status = isError ? 'error' : 'ok'
      const parent = step.parentId ? stepsById.get(step.parentId) : undefined
      if (parent && isError) parent.childErrors += 1
      step.tsEnd = ts
      if (measured !== undefined) step.tsStart = ts - measured
      step.durationMs = measured ?? ts - step.tsStart
      step.rawLines.push(i)
      cause = step.id
      return
    }

    systemStep(`${uuid}#role`, i, ts, 'Unknown message', String(role))
  }

  function readAssistant(line: Line, message: Line, content: string, uuid: string, i: number, ts: number) {
    llmCalls += 1
    const latency = num(line.latencyMs) ?? (prevTs !== null ? ts - prevTs : null)
    const model = str(line.model)
    const llmStep = num(line.step) ?? llmCalls
    const usage = readUsage(line.usage)
    const calls = (Array.isArray(message.tool_calls) ? message.tool_calls : []).filter(isObject)
    const reasoning = str(message.reasoning) ?? ''
    const toolNames = calls.map((c) => (isObject(c.function) ? str(c.function.name) : undefined) ?? '?')

    const llm = push({
      id: `${uuid}#llm`,
      kind: 'llm',
      effect: 'model',
      status: 'ok',
      label: `LLM response ${llmCalls}`,
      name:
        toolNames.length > 0
          ? `asked to run ${toolNames.join(', ')}`
          : content.trim()
            ? 'answered'
            : 'returned nothing',
      type: 'llm',
      depth: 0,
      parentId: null,
      childCount: 0,
      childErrors: 0,
      tsStart: latency !== null ? ts - latency : ts,
      tsEnd: ts,
      durationMs: latency,
      initiatorId: cause,
      bytes: null,
      usage,
      model,
      llmStep,
      rawLines: [i],
    })
    lastLlmId = llm.id

    const child = (step: Omit<NewStep, 'depth' | 'parentId' | 'childCount' | 'childErrors' | 'initiatorId' | 'llmStep' | 'rawLines'>) => {
      llm.childCount += 1
      return push({ ...step, depth: 1, parentId: llm.id, childCount: 0, childErrors: 0, initiatorId: llm.id, llmStep, rawLines: [i] })
    }

    if (reasoning.trim()) {
      child({
        id: `${uuid}#thinking`,
        kind: 'thinking',
        effect: 'model',
        status: 'none',
        label: 'Reasoning',
        name: oneLine(reasoning),
        type: 'reasoning',
        text: reasoning,
        tsStart: ts,
        tsEnd: null,
        durationMs: null,
        bytes: byteLength(reasoning),
      })
    }

    if (content.trim()) {
      child({
        id: `${uuid}#text`,
        kind: 'text',
        effect: 'model',
        status: 'none',
        label: calls.length > 0 ? 'Message' : 'Answer',
        name: oneLine(content),
        type: calls.length > 0 ? 'message' : 'answer',
        text: content,
        tsStart: ts,
        tsEnd: null,
        durationMs: null,
        bytes: byteLength(content),
      })
    }

    calls.forEach((call, k) => {
      const fn = isObject(call.function) ? call.function : {}
      const toolName = str(fn.name) ?? '(unnamed)'
      const { input, badArgs } = parseArgs(fn.arguments)
      const step = child({
        id: `${uuid}#tool${k}`,
        kind: 'tool',
        effect: effectOfTool(toolName),
        status: 'pending' satisfies StepStatus,
        label: toolName,
        name: oneLine(primaryArg(toolName, input, session.cwd)),
        type: 'tool',
        toolName,
        toolCallId: str(call.id),
        input,
        badArgs,
        tsStart: ts,
        tsEnd: null,
        durationMs: null,
        bytes: null,
      })
      if (step.toolCallId) toolsByCallId.set(step.toolCallId, step)
    })
  }

  return session
}
