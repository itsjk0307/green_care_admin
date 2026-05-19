import { API_BASE_URL } from '../config'
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
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  const payload = (await response.json()) as ApiResponse<LoginResult>
  if (!response.ok || !payload.success) {
    throw new Error(payload.message ?? 'Login failed')
  }
  return payload.data
}
