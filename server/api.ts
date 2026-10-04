import { open, readdir, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, resolve, sep } from 'node:path'

export type SessionEntry = {
  path: string
  project: string
  title: string
  mtimeMs: number
  size: number
}

export function projectsDir(): string {
  const override = process.env.SHREK_STATE_DIR?.trim()
  return join(override || join(homedir(), '.shrek'), 'projects')
}

const extraFiles = new Set<string>()
export function allowFile(path: string): string {
  const full = resolve(path)
  extraFiles.add(full)
  return full
}

function isReadable(path: string): boolean {
  const full = resolve(path)
  if (extraFiles.has(full)) return true
  return full.startsWith(projectsDir() + sep) && full.endsWith('.jsonl')
}

function titleOf(head: string): { title: string; project: string } {
  let title = ''
  let project = ''
  for (const raw of head.split('\n').slice(0, 10)) {
    try {
      const line = JSON.parse(raw)
      if (line.type === 'session') project = line.cwd ?? ''
      if (line.message?.role === 'user' && typeof line.message.content === 'string') {
        title = line.message.content
        break
      }
    } catch {}
  }
  return { title: title.replace(/\s+/g, ' ').slice(0, 140), project }
}

const HEAD_BYTES = 64 * 1024

async function readHead(path: string): Promise<string> {
  const handle = await open(path, 'r')
  try {
    const buffer = Buffer.alloc(HEAD_BYTES)
    const { bytesRead } = await handle.read(buffer, 0, HEAD_BYTES, 0)
    return buffer.toString('utf8', 0, bytesRead)
  } finally {
    await handle.close()
  }
}

async function entryFor(path: string): Promise<SessionEntry | null> {
  try {
    const [info, head] = await Promise.all([stat(path), readHead(path)])
    return { path, mtimeMs: info.mtimeMs, size: info.size, ...titleOf(head) }
  } catch {
    return null
  }
}

export async function listSessions(): Promise<SessionEntry[]> {
  const root = projectsDir()
  const projects = await readdir(root, { withFileTypes: true }).catch(() => [])
  const paths = new Set<string>()
  for (const dir of projects) {
    if (!dir.isDirectory()) continue
    const files = await readdir(join(root, dir.name)).catch(() => [])
    for (const name of files) if (name.endsWith('.jsonl')) paths.add(join(root, dir.name, name))
  }
  for (const path of extraFiles) paths.add(path)
  const entries = await Promise.all([...paths].map(entryFor))
  return entries.filter((e): e is SessionEntry => e !== null).sort((a, b) => b.mtimeMs - a.mtimeMs)
}

type ApiResponse = { status: number; type: string; headers: Record<string, string>; body: string }

const json = (status: number, value: unknown): ApiResponse => ({
  status,
  type: 'application/json',
  headers: {},
  body: JSON.stringify(value),
})

const NEWLINE = 0x0a

function isJson(text: string): boolean {
  try {
    JSON.parse(text)
    return true
  } catch {
    return false
  }
}

export async function readFrom(path: string, offset: number): Promise<{ start: number; end: number; text: string }> {
  const handle = await open(path, 'r')
  try {
    const { size } = await handle.stat()
    const start = offset >= 0 && offset <= size ? offset : 0
    const buffer = Buffer.alloc(size - start)
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, start)
    const lastNewline = buffer.lastIndexOf(NEWLINE, bytesRead - 1)
    const tail = buffer.toString('utf8', lastNewline + 1, bytesRead)
    const length = tail.trim() && isJson(tail) ? bytesRead : lastNewline + 1
    return { start, end: start + length, text: buffer.toString('utf8', 0, length) }
  } finally {
    await handle.close()
  }
}

export async function handleApi(url: URL): Promise<ApiResponse | null> {
  if (url.pathname === '/api/sessions') {
    return json(200, { root: projectsDir(), sessions: await listSessions() })
  }
  if (url.pathname === '/api/session') {
    const path = url.searchParams.get('path') ?? ''
    if (!isReadable(path)) return json(403, { error: `not a shrek session: ${path}` })
    const chunk = await readFrom(path, Number(url.searchParams.get('offset')) || 0).catch(() => null)
    if (chunk === null) return json(404, { error: `no such file: ${path}` })
    return {
      status: 200,
      type: 'text/plain; charset=utf-8',
      headers: { 'x-start': String(chunk.start), 'x-end': String(chunk.end) },
      body: chunk.text,
    }
  }
  return null
}
