import { apiRequest, ApiError } from '../api/client'
import { apiOrigin } from '../config'
import type { PlanMediaItem } from '../types/planMedia'
import { detectMediaType } from '../types/planMedia'

export function resolvePlanMediaUrl(path: string | null | undefined): string {
  if (!path) return ''
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('blob:')) {
    return path
  }

  const origin =
    apiOrigin() ||
    (import.meta.env.DEV ? '' : 'http://192.168.0.61:8010')

  const normalized = path.replace(/^\//, '')
  if (normalized.startsWith('storage/')) {
    return `${origin}/${normalized}`
  }
  return `${origin}/storage/${normalized}`
}

export function planMediaPreviewUrl(item: PlanMediaItem): string {
  return resolvePlanMediaUrl(
    item.thumbnail_url ??
      item.thumbnail_path ??
      item.file_url ??
      item.file_path,
  )
}

function normalizeList(data: unknown): PlanMediaItem[] {
  if (Array.isArray(data)) return data as PlanMediaItem[]
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>
    if (Array.isArray(record.items)) return record.items as PlanMediaItem[]
    if (Array.isArray(record.media)) return record.media as PlanMediaItem[]
    if (Array.isArray(record.data)) return record.data as PlanMediaItem[]
  }
  return []
}

export async function listPlanMedia(planId: string) {
  try {
    const data = await apiRequest<unknown>(`/daily-plans/${planId}/media`)
    return normalizeList(data)
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return []
    throw err
  }
}

export async function uploadPlanMedia(planId: string, file: File) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('media_type', detectMediaType(file))

  return apiRequest<PlanMediaItem>(`/daily-plans/${planId}/media`, {
    method: 'POST',
    body: formData,
  })
}

export function deletePlanMedia(planId: string, mediaId: string) {
  return apiRequest<unknown>(`/daily-plans/${planId}/media/${mediaId}`, {
    method: 'DELETE',
  })
}
