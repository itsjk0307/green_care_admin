import { apiRequest } from '../api/client'
import { apiOrigin } from '../config'
import type {
  HolePhotoSummaryItem,
  PhotoFilters,
  PhotosPage,
  WorkPhoto,
} from '../types/photo'

export function resolvePhotoUrl(path: string | null | undefined): string {
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

export function photoThumbnail(photo: WorkPhoto): string {
  return resolvePhotoUrl(
    photo.thumbnail_url ??
      photo.thumbnail_path ??
      photo.image_url ??
      photo.image_path,
  )
}

export function photoFullUrl(photo: WorkPhoto): string {
  return resolvePhotoUrl(photo.image_url ?? photo.image_path)
}

function normalizePhotosPage(
  data: PhotosPage | WorkPhoto[],
  page: number,
): PhotosPage {
  if (Array.isArray(data)) {
    return {
      items: data,
      total: data.length,
      page,
      page_size: data.length || 20,
      total_pages: 1,
    }
  }
  return data
}

export function getPhotos(
  courseId: string,
  filters: PhotoFilters = {},
  page = 1,
) {
  const params = new URLSearchParams({
    course_id: courseId,
    page: String(page),
  })
  if (filters.from_date) params.set('from_date', filters.from_date)
  if (filters.to_date) params.set('to_date', filters.to_date)
  if (filters.hole_number != null) {
    params.set('hole_number', String(filters.hole_number))
  }
  if (filters.photo_type) params.set('photo_type', filters.photo_type)

  return apiRequest<PhotosPage | WorkPhoto[]>(`/photos/?${params}`).then((data) =>
    normalizePhotosPage(data, page),
  )
}

export async function getPhotosByHole(courseId: string) {
  const params = new URLSearchParams({ course_id: courseId })
  const data = await apiRequest<
    HolePhotoSummaryItem[] | Record<string, HolePhotoSummaryItem>
  >(`/photos/by-hole?${params}`)

  if (Array.isArray(data)) return data

  return Object.values(data).sort(
    (a, b) => a.hole_number - b.hole_number,
  )
}
