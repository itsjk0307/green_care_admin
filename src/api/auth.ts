import { API_BASE_URL } from '../config'
import { devTerminalLog } from '../lib/devLog'
import type { ApiResponse } from '../types/api'

/** Verified backend login error codes (403 detail object). */
export const LOGIN_ERROR_CODES = {
  pending: 'account_pending',
  rejected: 'account_rejected',
  inactive: 'account_inactive',
} as const

export type LoginUser = {
  id: string
  name: string
  email: string
  role: string
  is_active: boolean
  account_status: string
  assigned_course_id: string | null
}

export type LoginSuccess = {
  kind: 'success'
  access_token: string
  refresh_token: string
  token_type: string
  user: LoginUser
}

export type LoginPending = {
  kind: 'pending'
  message?: string
}

export type LoginRejected = {
  kind: 'rejected'
  message?: string
}

export type LoginOutcome = LoginSuccess | LoginPending | LoginRejected

export type SignupRole = 'worker' | 'course_manager'

export type SignupCourseOption = {
  id: string
  name: string
  name_ko: string
}

export type SignupPayload = {
  name: string
  email: string
  password: string
  role: SignupRole
  course_id: string
}

export type SignupResult = {
  id: string
  name: string
  email: string
  role: SignupRole
  account_status: string
  assigned_course_id: string
  created_at: string
}

export class LoginPendingError extends Error {
  readonly code = LOGIN_ERROR_CODES.pending

  constructor(message: string) {
    super(message)
    this.name = 'LoginPendingError'
  }
}

export class LoginRejectedError extends Error {
  readonly code = LOGIN_ERROR_CODES.rejected

  constructor(message: string) {
    super(message)
    this.name = 'LoginRejectedError'
  }
}

type LoginDetailError = {
  code?: string
  message?: string
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

/** 403: `{ detail: { code, message } }` */
function extractLoginDetail(parsed: unknown): LoginDetailError | null {
  const body = asRecord(parsed)
  if (!body) return null
  const detail = asRecord(body.detail)
  if (!detail) return null
  return {
    code: typeof detail.code === 'string' ? detail.code : undefined,
    message: typeof detail.message === 'string' ? detail.message : undefined,
  }
}

/** 401: `{ detail: "Invalid email or password." }` (string) */
function extractLoginFailureMessage(
  parsed: unknown,
  status: number,
): string {
  const body = asRecord(parsed)
  if (body) {
    const detail = body.detail
    if (typeof detail === 'string' && detail.trim()) return detail
    const detailObj = extractLoginDetail(parsed)
    if (detailObj?.message) return detailObj.message
    if (typeof body.message === 'string' && body.message.trim()) {
      return body.message
    }
  }
  if (status === 401) return '이메일 또는 비밀번호가 올바르지 않습니다.'
  return `Login failed (HTTP ${status})`
}

function normalizeLoginUser(raw: unknown): LoginUser | null {
  const u = asRecord(raw)
  if (!u || u.id == null || typeof u.email !== 'string') return null

  return {
    id: String(u.id),
    name: String(u.name ?? ''),
    email: u.email,
    role: String(u.role ?? ''),
    is_active: u.is_active !== false,
    account_status: String(u.account_status ?? 'approved'),
    assigned_course_id:
      typeof u.assigned_course_id === 'string' ? u.assigned_course_id : null,
  }
}

function parseLoginSuccess(parsed: unknown): Omit<LoginSuccess, 'kind'> | null {
  const body = asRecord(parsed)
  if (!body || body.success !== true) return null

  const data = asRecord(body.data)
  if (!data || typeof data.access_token !== 'string') return null

  const user = normalizeLoginUser(data.user)
  if (!user) return null

  return {
    access_token: data.access_token,
    refresh_token:
      typeof data.refresh_token === 'string' ? data.refresh_token : '',
    token_type: typeof data.token_type === 'string' ? data.token_type : 'bearer',
    user,
  }
}

export async function loginRequest(
  email: string,
  password: string,
): Promise<LoginOutcome> {
  const url = `${API_BASE_URL}/auth/login`
  devTerminalLog('info', `Login attempt → POST ${url}`, { email })

  const started = performance.now()
  let response: Response

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
  } catch (err) {
    const ms = Math.round(performance.now() - started)
    const message = err instanceof Error ? err.message : String(err)
    devTerminalLog('error', `Login network error (${ms}ms): ${message}`, {
      url,
      apiBase: API_BASE_URL,
    })
    throw new Error(
      `서버에 연결할 수 없습니다. API 주소(${API_BASE_URL})와 네트워크를 확인하세요.`,
    )
  }

  const ms = Math.round(performance.now() - started)
  const rawText = await response.text()

  let parsed: unknown = null
  try {
    parsed = rawText ? JSON.parse(rawText) : null
  } catch {
    devTerminalLog('error', `Login invalid JSON — HTTP ${response.status} (${ms}ms)`, {
      url,
      bodyPreview: rawText.slice(0, 200),
    })
    throw new Error(`서버 응답 형식 오류 (HTTP ${response.status})`)
  }

  if (response.status === 403) {
    const detail = extractLoginDetail(parsed)
    if (detail?.code === LOGIN_ERROR_CODES.pending) {
      devTerminalLog('info', `Login pending approval (${ms}ms)`, { email })
      return { kind: 'pending', message: detail.message }
    }
    if (detail?.code === LOGIN_ERROR_CODES.rejected) {
      devTerminalLog('info', `Login rejected (${ms}ms)`, { email })
      return { kind: 'rejected', message: detail.message }
    }
  }

  if (response.ok) {
    const loginData = parseLoginSuccess(parsed)
    if (loginData) {
      devTerminalLog('info', `Login success (${ms}ms)`, {
        email: loginData.user.email,
        role: loginData.user.role,
      })
      return { kind: 'success', ...loginData }
    }
  }

  const msg = extractLoginFailureMessage(parsed, response.status)
  devTerminalLog('error', `Login rejected — HTTP ${response.status} (${ms}ms)`, {
    url,
    message: msg,
  })
  throw new Error(msg)
}

export async function fetchSignupCourses(): Promise<SignupCourseOption[]> {
  const raw = await fetch(`${API_BASE_URL}/auth/signup/courses`)
  const parsed = (await raw.json()) as ApiResponse<SignupCourseOption[]>
  if (!raw.ok || !parsed.success || !Array.isArray(parsed.data)) {
    throw new Error(parsed.message ?? 'Failed to load courses.')
  }
  return parsed.data.map((c) => ({
    id: String(c.id),
    name: c.name,
    name_ko: c.name_ko,
  }))
}

export async function signupRequest(
  payload: SignupPayload,
): Promise<SignupResult> {
  const url = `${API_BASE_URL}/auth/signup`
  devTerminalLog('info', `Signup → POST ${url}`, { email: payload.email, role: payload.role })

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const parsed = (await response.json().catch(() => null)) as
    | ApiResponse<SignupResult>
    | { detail?: string | { msg?: string }[]; message?: string }
    | null

  if (!response.ok || !parsed || !('success' in parsed) || !parsed.success) {
    let msg = 'Signup failed.'
    if (parsed && typeof parsed === 'object') {
      if ('message' in parsed && typeof parsed.message === 'string') {
        msg = parsed.message
      } else if ('detail' in parsed) {
        const d = parsed.detail
        if (typeof d === 'string') msg = d
        else if (Array.isArray(d) && d[0]?.msg) msg = d[0].msg
      }
    }
    throw new Error(msg)
  }

  const data = parsed.data
  return {
    ...data,
    id: String(data.id),
    assigned_course_id: String(data.assigned_course_id),
  }
}
