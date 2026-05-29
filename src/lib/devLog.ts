type LogLevel = 'info' | 'warn' | 'error'

type LogPayload = {
  level: LogLevel
  message: string
  meta?: unknown
}

/** Sends browser events to the Vite dev-server terminal (dev only). */
export function devTerminalLog(
  level: LogLevel,
  message: string,
  meta?: unknown,
): void {
  if (!import.meta.env.DEV) return

  const payload: LogPayload = { level, message, meta }

  if (meta !== undefined) {
    console[level](`[GreenCare] ${message}`, meta)
  } else {
    console[level](`[GreenCare] ${message}`)
  }

  void fetch('/__dev-log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {
    /* dev server not running or middleware unavailable */
  })
}

export async function devCheckApiHealth(baseUrl: string): Promise<void> {
  const url = `${baseUrl.replace(/\/$/, '')}/auth/login`
  devTerminalLog('info', `API health check → ${url}`)

  const started = performance.now()
  try {
    const response = await fetch(url, {
      method: 'OPTIONS',
      signal: AbortSignal.timeout(8000),
    }).catch(async () => {
      return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: '__health__', password: '__health__' }),
        signal: AbortSignal.timeout(8000),
      })
    })

    const ms = Math.round(performance.now() - started)
    devTerminalLog('info', `API reachable — HTTP ${response.status} (${ms}ms)`, {
      url,
      ok: response.ok,
    })
  } catch (err) {
    const ms = Math.round(performance.now() - started)
    const message = err instanceof Error ? err.message : String(err)
    devTerminalLog('error', `API unreachable (${ms}ms): ${message}`, {
      url,
      hint: 'Check backend is running, IP is correct, firewall/VPN, and CORS.',
    })
  }
}
