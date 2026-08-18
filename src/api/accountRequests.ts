import { apiRequest } from './client'
import type { SignupRole } from './auth'

export type AccountRequest = {
  id: string
  name: string
  email: string
  role: SignupRole | 'admin' | 'manager'
  account_status: string
  assigned_course_id: string | null
  course_name: string | null
  course_name_ko: string | null
  created_at: string
  reviewed_by: string | null
  reviewed_at: string | null
}

export type ApproveAccountPayload = {
  role?: SignupRole
  course_id?: string
}

export function fetchPendingAccountRequests(): Promise<AccountRequest[]> {
  return apiRequest<AccountRequest[]>('/account-requests/pending')
}

export function approveAccountRequest(
  userId: string,
  payload: ApproveAccountPayload = {},
): Promise<AccountRequest> {
  return apiRequest<AccountRequest>(`/account-requests/${userId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function rejectAccountRequest(
  userId: string,
  reason?: string,
): Promise<AccountRequest> {
  return apiRequest<AccountRequest>(`/account-requests/${userId}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reason ? { reason } : {}),
  })
}
