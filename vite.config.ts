import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { handleApi } from './server/api.ts'

/** Serves `/api/*` from the Vite dev server, so `bun run dev` is one process. */
function api(): Plugin {
  return {
    name: 'steptrace-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const result = await handleApi(new URL(req.url ?? '/', 'http://localhost'))
        if (!result) return next()
        res.statusCode = result.status
        res.setHeader('content-type', result.type)
        res.end(result.body)
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), api()],
  server: { host: '127.0.0.1' },
})
