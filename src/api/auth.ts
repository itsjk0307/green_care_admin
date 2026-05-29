import { API_BASE_URL } from '../config'
import { devTerminalLog } from '../lib/devLog'
import type { ApiResponse } from '../types/api'

export type LoginResult = {
  access_token: string
  refresh_token: string
  token_type: string
  user: {
    id: string
    name: string
    email: string
    role: string
    is_active: boolean
  }
}

export async function loginRequest(
  email: string,
  password: string,
): Promise<LoginResult> {
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
  let payload: ApiResponse<LoginResult> | null = null

  try {
    payload = rawText ? (JSON.parse(rawText) as ApiResponse<LoginResult>) : null
  } catch {
    devTerminalLog('error', `Login invalid JSON — HTTP ${response.status} (${ms}ms)`, {
      url,
      bodyPreview: rawText.slice(0, 200),
    })
    throw new Error(`서버 응답 형식 오류 (HTTP ${response.status})`)
  }

  if (!response.ok || !payload?.success) {
    let detailMsg: string | undefined
    if (rawText) {
      try {
        const errBody = JSON.parse(rawText) as {
          message?: string
          detail?: string | { msg?: string }[]
        }
        if (typeof errBody.detail === 'string') {
          detailMsg = errBody.detail
        } else if (Array.isArray(errBody.detail) && errBody.detail[0]?.msg) {
          detailMsg = errBody.detail[0].msg
        } else if (errBody.message) {
          detailMsg = errBody.message
        }
      } catch {
        /* not JSON */
      }
    }

    const msg =
      payload?.message ??
      detailMsg ??
      (response.status === 401
        ? '이메일 또는 비밀번호가 올바르지 않습니다.'
        : `Login failed (HTTP ${response.status})`)

    devTerminalLog('error', `Login rejected — HTTP ${response.status} (${ms}ms)`, {
      url,
      message: msg,
      success: payload?.success,
    })
    throw new Error(msg)
  }

  devTerminalLog('info', `Login success (${ms}ms)`, {
    email: payload.data.user.email,
    role: payload.data.user.role,
  })
  return payload.data
}
