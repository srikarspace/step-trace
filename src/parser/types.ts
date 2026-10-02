/** One row in the table. Derived from transcript lines, never one-to-one with them. */
export type StepKind = 'prompt' | 'llm' | 'thinking' | 'text' | 'tool' | 'system'
export type StepStatus = 'ok' | 'error' | 'pending' | 'none'
/** Drives colour. Tool identity is carried by the label, never by hue. */
export type Effect = 'model' | 'read' | 'mutate' | 'meta'

export type Usage = {
  in: number
  out: number
  reasoning: number
  cached: number
  cost: number | null
}

export type Step = {
  /** `${lineUuid}#${part}`, stable across reloads, used in `?step=`. */
  id: string
  index: number
  kind: StepKind
  effect: Effect
  status: StepStatus
  /** What this row is, in the user's words: `Your request`, `LLM response 2`, `Bash`. */
  label: string
  /** The detail after the label: prompt text, command, file path. */
  name: string
  type: string
  /** 0 = top level; 1 = part of an LLM response (reasoning, message, tool call). */
  depth: 0 | 1
  /** The LLM response this row belongs to. */
  parentId: string | null
  /** Number of rows grouped under this one. */
  childCount: number
  /** Grouped rows that failed, so a collapsed response still shows trouble. */
  childErrors: number

  toolName?: string
  toolCallId?: string
  input?: unknown
  /** The `arguments` string as the model sent it, when it was not valid JSON. */
  badArgs?: string
  result?: string
  /** First line of the result, for the table. */
  resultPreview?: string
  text?: string

  tsStart: number
  tsEnd: number | null
  durationMs: number | null
  initiatorId: string | null

  bytes: number | null
  usage?: Usage
  model?: string
  llmStep?: number

  /** Indexes into `Session.lines`, for the Raw tab. */
  rawLines: number[]
}

export type TurnEnd = {
  reason: string
  durationMs: number | null
  answer: string
}

export type Session = {
  file: string
  sessionId: string | null
  cwd: string | null
  argv: string[]
  startedAt: number | null
  endedAt: number | null
  turn: TurnEnd | null
  lines: unknown[]
  steps: Step[]
  warnings: string[]
}
