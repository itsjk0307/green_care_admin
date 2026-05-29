import { apiRequest } from '../api/client'
import { apiOrigin } from '../config'
import type { GolfCourse } from '../types/api'
import type { Issue, IssueFilters, UpdateIssueBody } from '../types/issue'

export function resolveStorageUrl(path: string | null | undefined): string {
  if (!path) return ''
  if (path.startsWith('http://') || path.startsWith('https://')) return path

  const origin =
    apiOrigin() ||
    (import.meta.env.DEV ? '' : 'http://192.168.0.61:8010')

  const normalized = path.replace(/^\//, '')
  if (normalized.startsWith('storage/')) {
    return `${origin}/${normalized}`
  }
  return `${origin}/storage/${normalized}`
}

export function getGolfCourse(courseId: string) {
  return apiRequest<GolfCourse>(`/golf-courses/${courseId}`)
}

export function getIssues(courseId: string, filters: IssueFilters = {}) {
  const params = new URLSearchParams({ course_id: courseId })
  if (filters.status) params.set('status', filters.status)
  if (filters.issue_type) params.set('issue_type', filters.issue_type)
  return apiRequest<Issue[]>(`/issues/?${params}`)
}

export function getIssueDetail(issueId: string) {
  return apiRequest<Issue>(`/issues/${issueId}`)
}

export function createIssue(formData: FormData) {
  return apiRequest<Issue>('/issues/', {
    method: 'POST',
    body: formData,
  })
}

export function updateIssue(issueId: string, body: UpdateIssueBody) {
  return apiRequest<Issue>(`/issues/${issueId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export function deleteIssue(issueId: string) {
  return apiRequest<void>(`/issues/${issueId}`, {
    method: 'DELETE',
  })
}
