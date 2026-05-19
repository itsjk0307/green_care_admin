import { API_BASE_URL, TOKEN_STORAGE_KEY } from '../config'
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
  const token = localStorage.getItem(TOKEN_STORAGE_KEY)
  const headers = new Headers(options.headers)

  if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  })

  const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null

  if (!response.ok) {
    const message =
      payload?.message ??
      (typeof payload === 'object' && payload !== null && 'detail' in payload
        ? String((payload as { detail: unknown }).detail)
        : `Request failed (${response.status})`)
    throw new ApiError(message, response.status)
  }

  if (!payload?.success) {
    throw new ApiError(payload?.message ?? 'Request failed.', response.status)
  }

  return payload.data
}
