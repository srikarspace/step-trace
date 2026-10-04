import { describe, expect, test } from 'bun:test'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readFrom } from './api'

const file = (text: string) => {
  const path = join(mkdtempSync(join(tmpdir(), 'steptrace-')), 's.jsonl')
  writeFileSync(path, text)
  return path
}

describe('readFrom', () => {
  test('given a half-written last line, when read, then only complete lines are returned', async () => {
    const chunk = await readFrom(file('{"a":1}\n{"b":'), 0)
    expect(chunk).toEqual({ start: 0, end: 8, text: '{"a":1}\n' })
  })

  test('given a complete last line without a newline, when read, then it is included', async () => {
    const chunk = await readFrom(file('{"a":1}\n{"b":2}'), 0)
    expect(chunk.text).toBe('{"a":1}\n{"b":2}')
  })

  test('given an offset, when read, then only bytes after it are returned', async () => {
    const chunk = await readFrom(file('{"a":1}\n{"é":2}\n'), 8)
    expect(chunk).toEqual({ start: 8, end: 17, text: '{"é":2}\n' })
  })

  test('given an offset past the end of a replaced file, when read, then it restarts at 0', async () => {
    const chunk = await readFrom(file('{"a":1}\n'), 500)
    expect(chunk.start).toBe(0)
  })
})
