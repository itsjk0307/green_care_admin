import { apiRequest } from '../api/client'
import { apiOrigin } from '../config'

export function resolveMediaUrl(path) {
  if (!path) return ''
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  const origin = apiOrigin() || (import.meta.env.DEV ? '' : 'http://192.168.0.61:8010')
  const normalized = path.replace(/^\//, '')
  if (normalized.startsWith('storage/')) return `${origin}/${normalized}`
  return `${origin}/storage/${normalized}`
}

export function getFieldPhotos(courseId) {
  return apiRequest(`/work-reports/field-photos?course_id=${courseId}`)
}

export function getCourse(courseId) {
  return apiRequest(`/golf-courses/${courseId}`)
}

export function getActiveWorkers(courseId) {
  return apiRequest(`/gps/active?course_id=${courseId}`)
}

export function updatePhotoStatus(photoId, status) {
  return apiRequest(`/work-reports/${photoId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}
