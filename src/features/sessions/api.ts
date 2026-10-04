import type { SessionEntry } from '../../../server/api'
import { createShrekParser, type ShrekParser } from '@/parser/shrek'
import type { Session } from '@/parser/types'

export type SessionList = { root: string; sessions: SessionEntry[] }

const OFFLINE = 'steptrace server is not running. Start it with bun run dev.'

async function request(url: string, signal?: AbortSignal): Promise<Response> {
  const res = await fetch(url, { signal }).catch((error: unknown) => {
    if (signal?.aborted) throw error
    throw new Error(OFFLINE)
  })
  if (res.ok) return res
  const body = (await res.json().catch(() => null)) as { error?: string } | null
  throw new Error(body?.error ?? `${url} failed (HTTP ${res.status})`)
}

export async function fetchSessions(signal?: AbortSignal): Promise<SessionList> {
  return (await request('/api/sessions', signal)).json()
}

type Tail = { parser: ShrekParser; end: number }

const tails = new Map<string, Tail>()

export function forgetSession(path: string) {
  tails.delete(path)
}

export async function loadSession(path: string, signal?: AbortSignal): Promise<Session> {
  let tail = tails.get(path)
  if (!tail) {
    tail = { parser: createShrekParser(path), end: 0 }
    tails.set(path, tail)
  }
  const res = await request(`/api/session?path=${encodeURIComponent(path)}&offset=${tail.end}`, signal)
  const text = await res.text()
  if (tails.get(path) !== tail) throw new Error('session was reloaded')
  const start = Number(res.headers.get('x-start'))
  if (start !== tail.end) {
    tail = { parser: createShrekParser(path), end: 0 }
    tails.set(path, tail)
  }
  tail.end = Number(res.headers.get('x-end'))
  return tail.parser.push(text)
}
