/**
 * API base URL (includes `/api/v1`).
 *
 * Mobile (Expo Android emulator): EXPO_PUBLIC_API_URL=http://10.0.2.2:8000
 * Admin web (browser on PC): use localhost:8000 — not 10.0.2.2 (emulator-only).
 *
 * In dev, if VITE_API_BASE_URL is unset, requests use `/api/v1` and Vite proxies to :8000.
 */
function resolveApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL as string | undefined
  if (fromEnv?.trim()) {
    return fromEnv.trim().replace(/\/$/, '')
  }
  if (import.meta.env.DEV) {
    return '/api/v1'
  }
  return 'http://192.168.0.61:8010/api/v1'
}

export const API_BASE_URL = resolveApiBaseUrl()

/** Backend origin for media URLs (no /api/v1 suffix). */
export function apiOrigin(): string {
  if (API_BASE_URL.startsWith('http')) {
    return API_BASE_URL.replace(/\/api\/v1\/?$/, '')
  }
  return ''
}

export const TOKEN_STORAGE_KEY = 'access_token'
