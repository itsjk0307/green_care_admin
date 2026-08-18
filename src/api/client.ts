import { API_BASE_URL, TOKEN_STORAGE_KEY } from '../config'
import { useAuthStore } from '../stores/authStore'
import { devTerminalLog } from '../lib/devLog'
import type { ApiResponse } from '../types/api'

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

const USER_STORAGE_KEY = 'greencare-admin-user'

let redirectingToLogin = false

function handleUnauthorized(message: string) {
  if (redirectingToLogin) return
  redirectingToLogin = true

  localStorage.removeItem(TOKEN_STORAGE_KEY)
  localStorage.removeItem(USER_STORAGE_KEY)
  useAuthStore.getState().clearAuth()

  devTerminalLog('warn', 'Session expired — redirecting to login', { message })

  const loginPath = '/login'
  if (!window.location.pathname.startsWith(loginPath)) {
    window.location.assign(loginPath)
  } else {
    redirectingToLogin = false
  }
}

function extractErrorMessage(
  payload: ApiResponse<unknown> | null,
  status: number,
): string {
  if (payload?.message) return payload.message
  if (typeof payload === 'object' && payload !== null && 'detail' in payload) {
    return String((payload as { detail: unknown }).detail)
  }
  return `Request failed (${status})`
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  // Prefer localStorage so the token is available immediately after AuthContext
  // persists a successful login, even before setAccessToken propagates.
  const token =
    localStorage.getItem(TOKEN_STORAGE_KEY) ??
    useAuthStore.getState().accessToken

  const headers = new Headers(options.headers)

  if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const url = `${API_BASE_URL}${path}`
  const method = options.method ?? 'GET'
  let response: Response

  try {
    response = await fetch(url, {
      ...options,
      headers,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    devTerminalLog('error', `API network error — ${method} ${url}`, { message })
    throw new ApiError(
      `서버에 연결할 수 없습니다. (${API_BASE_URL})`,
      0,
    )
  }

  const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null

  if (!response.ok) {
    const message = extractErrorMessage(payload, response.status)
    devTerminalLog('error', `API HTTP ${response.status} — ${method} ${url}`, {
      message,
    })
    if (response.status === 401) {
      handleUnauthorized(message)
    }
    throw new ApiError(message, response.status)
  }

  if (!payload?.success) {
    devTerminalLog('error', `API success=false — ${method} ${url}`, {
      message: payload?.message,
    })
    throw new ApiError(payload?.message ?? 'Request failed.', response.status)
  }

  if (import.meta.env.DEV) {
    devTerminalLog('info', `API OK — ${method} ${url}`, { status: response.status })
  }

  return payload.data
}

export async function apiBlobRequest(
  path: string,
  options: RequestInit = {},
): Promise<Blob> {
  const token =
    localStorage.getItem(TOKEN_STORAGE_KEY) ??
    useAuthStore.getState().accessToken

  const headers = new Headers(options.headers)
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const url = `${API_BASE_URL}${path}`
  const response = await fetch(url, { ...options, headers })

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ApiResponse<unknown> | null
    const message =
      payload?.message ?? `Download failed (${response.status})`
    if (response.status === 401) {
      handleUnauthorized(message)
    }
    throw new ApiError(message, response.status)
  }

  return response.blob()
}
