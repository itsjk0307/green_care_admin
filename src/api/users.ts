import { apiRequest } from './client'
import type { AppUser } from '../types/api'

export function fetchUsers(role?: string) {
  const params = role ? `?role=${encodeURIComponent(role)}` : ''
  return apiRequest<AppUser[]>(`/users/${params}`)
}
