import type { Connect } from 'vite'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function readBody(req: Connect.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

/** Prints browser API/auth logs in the Vite terminal during `npm run dev`. */
function devTerminalLogger(proxyTarget: string) {
  return {
    name: 'greencare-dev-terminal-logger',
    configureServer(server: { middlewares: Connect.Server }) {
      server.middlewares.use('/__dev-log', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end()
          return
        }

        try {
          const raw = await readBody(req)
          const payload = JSON.parse(raw) as {
            level?: string
            message?: string
            meta?: unknown
          }
          const level = payload.level ?? 'info'
          const stamp = new Date().toLocaleTimeString('ko-KR')
          const tag =
            level === 'error' ? 'ERROR' : level === 'warn' ? 'WARN ' : 'INFO '
          const line = `[${stamp}] [web/${tag}] ${payload.message ?? '(no message)'}`
          if (level === 'error') {
            console.error(line)
            if (payload.meta !== undefined) console.error('  meta:', payload.meta)
          } else if (level === 'warn') {
            console.warn(line)
            if (payload.meta !== undefined) console.warn('  meta:', payload.meta)
          } else {
            console.log(line)
            if (payload.meta !== undefined) console.log('  meta:', payload.meta)
          }
          res.statusCode = 204
          res.end()
        } catch (err) {
          console.error('[web/ERROR] Failed to parse dev log payload', err)
          res.statusCode = 400
          res.end()
        }
      })

      console.log('')
      console.log('[GreenCare] Dev terminal logging enabled — browser logs appear here.')
      console.log(`[GreenCare] API proxy: /api → ${proxyTarget}`)
      console.log('[GreenCare] Open http://localhost:5173/login and try signing in.')
      console.log('')
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiProxyTarget =
    env.VITE_API_PROXY_TARGET?.trim() || 'http://127.0.0.1:8000'

  return {
    plugins: [react(), tailwindcss(), devTerminalLogger(apiProxyTarget)],
    optimizeDeps: {
      include: ['leaflet'],
    },
    server: {
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
        },
        '/storage': {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
