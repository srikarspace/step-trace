import { join, resolve, sep } from 'node:path'
import { allowFile, handleApi } from './api'

const dist = resolve(import.meta.dir, '..', 'dist')
const arg = process.argv[2]
const file = arg ? allowFile(arg) : null

const server = Bun.serve({
  hostname: '127.0.0.1',
  port: Number(process.env.PORT) || 0,
  async fetch(req) {
    const url = new URL(req.url)
    // Only answer requests addressed to this machine, so a web page using DNS rebinding cannot read transcripts.
    const host = req.headers.get('host')?.replace(/:\d+$/, '')
    if (host !== '127.0.0.1' && host !== 'localhost') return new Response('Forbidden', { status: 403 })
    const api = await handleApi(url)
    if (api) return new Response(api.body, { status: api.status, headers: { ...api.headers, 'content-type': api.type } })
    const assetPath = resolve(dist, `.${decodeURIComponent(url.pathname)}`)
    const asset = Bun.file(assetPath)
    if (assetPath.startsWith(dist + sep) && (await asset.exists())) return new Response(asset)
    return new Response(Bun.file(join(dist, 'index.html')))
  },
})

const open = new URL(server.url)
if (file) open.searchParams.set('file', file)
console.log(`steptrace → ${open}`)
Bun.spawn(['open', open.toString()])
