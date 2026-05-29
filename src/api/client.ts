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

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token =
    useAuthStore.getState().accessToken ??
    localStorage.getItem(TOKEN_STORAGE_KEY)
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
    devTerminalLog('error', `API HTTP ${response.status} — ${method} ${url}`, {
      message: payload?.message,
    })
    const message =
      payload?.message ??
      (typeof payload === 'object' && payload !== null && 'detail' in payload
        ? String((payload as { detail: unknown }).detail)
        : `Request failed (${response.status})`)
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
    useAuthStore.getState().accessToken ??
    localStorage.getItem(TOKEN_STORAGE_KEY)
  const headers = new Headers(options.headers)
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const url = `${API_BASE_URL}${path}`
  const response = await fetch(url, { ...options, headers })

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ApiResponse<unknown> | null
    throw new ApiError(
      payload?.message ?? `Download failed (${response.status})`,
      response.status,
    )
  }

  return response.blob()
}
