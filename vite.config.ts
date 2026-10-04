import type { IncomingMessage, ServerResponse } from 'node:http'
import { fileURLToPath, URL } from 'node:url'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { handleApi } from './server/api.ts'

type Middleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => Promise<void>

const serveApi: Middleware = async (req, res, next) => {
  const result = await handleApi(new URL(req.url ?? '/', 'http://localhost'))
  if (!result) return next()
  res.statusCode = result.status
  for (const [key, value] of Object.entries(result.headers)) res.setHeader(key, value)
  res.end(result.body)
}

function api(): Plugin {
  return {
    name: 'steptrace-api',
    configureServer: (server) => void server.middlewares.use(serveApi),
    configurePreviewServer: (server) => void server.middlewares.use(serveApi),
  }
}

export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] }), tailwindcss(), api()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { host: '127.0.0.1' },
  preview: { host: '127.0.0.1' },
})
