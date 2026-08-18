import { apiRequest } from '../api/client'
import { apiOrigin } from '../config'

export type MapReportApiRecord = {
  id: string
  worker_id: string
  course_id: string
  work_date: string
  marks: Array<Record<string, unknown>>
  mark_count: number
  map_image_url: string | null
  pdf_url: string | null
  client_id: string
  created_at: string
}

type MapReportListPayload = {
  reports: MapReportApiRecord[]
  total: number
  page: number
  limit: number
}

export function resolveMapReportFileUrl(path: string | null | undefined): string {
  if (!path) return ''
  if (path.startsWith('http://') || path.startsWith('https://')) return path

  const origin =
    apiOrigin() ||
    (import.meta.env.DEV ? '' : 'http://192.168.0.61:8010')
  const normalized = path.replace(/^\//, '')
  return `${origin}/${normalized}`
}

export function createMapReport(formData: FormData) {
  return apiRequest<MapReportApiRecord>('/map-reports/', {
    method: 'POST',
    body: formData,
  })
}

export function getMapReports(courseId?: string): Promise<MapReportListPayload> {
  const params = new URLSearchParams({ limit: '100' })
  if (courseId) params.set('course_id', courseId)
  return apiRequest<MapReportListPayload>(`/map-reports/?${params}`)
}

export function deleteMapReportRemote(id: string) {
  return apiRequest<null>(`/map-reports/${id}`, { method: 'DELETE' })
}
