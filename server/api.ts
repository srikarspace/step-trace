import { open, readdir, readFile, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, resolve, sep } from 'node:path'

export type SessionEntry = {
  path: string
  project: string
  title: string
  mtimeMs: number
  size: number
}

/** Same rule as shrek's `paths.ts`: `$SHREK_STATE_DIR` or `~/.shrek`. */
export function projectsDir(): string {
  const override = process.env.SHREK_STATE_DIR?.trim()
  return join(override || join(homedir(), '.shrek'), 'projects')
}

/** Files passed on the command line, readable even outside the projects dir. */
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

/** First user prompt, else the session's argv. Only the head of the file is read. */
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

/** Only the start of a file: the listing is polled every second and must not read whole transcripts. */
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

/** null when the file vanished between listing and reading, which happens while shrek writes. */
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

type ApiResponse = { status: number; type: string; body: string }

const json = (status: number, value: unknown): ApiResponse => ({
  status,
  type: 'application/json',
  body: JSON.stringify(value),
})

/** `GET /api/sessions` and `GET /api/session?path=`. Shared by Vite dev and the Bun server. */
export async function handleApi(url: URL): Promise<ApiResponse | null> {
  if (url.pathname === '/api/sessions') {
    return json(200, { root: projectsDir(), sessions: await listSessions() })
  }
  if (url.pathname === '/api/session') {
    const path = url.searchParams.get('path') ?? ''
    if (!isReadable(path)) return json(403, { error: `not a shrek session: ${path}` })
    const text = await readFile(path, 'utf8').catch(() => null)
    if (text === null) return json(404, { error: `no such file: ${path}` })
    return { status: 200, type: 'text/plain; charset=utf-8', body: text }
  }
  return null
}
