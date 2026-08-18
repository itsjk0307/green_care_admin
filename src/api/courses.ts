import { apiRequest } from './client'
import type { GolfCourse } from '../types/api'

/** Safely converts any value to a finite float, or null. */
function toNum(val: unknown): number | null {
  if (val == null) return null
  const n = Number(val)
  return Number.isFinite(n) ? n : null
}

function normalizeCourse(raw: Record<string, unknown>): GolfCourse | null {
  const id = raw.id ?? raw.course_id
  if (id == null || id === '') return null

  const name = String(raw.name ?? '')
  const nameKo = String(raw.name_ko ?? name)
  const nameEn =
    raw.name_en != null && String(raw.name_en).trim() !== ''
      ? String(raw.name_en)
      : null

  return {
    id: String(id),
    name,
    name_ko: nameKo,
    name_en: nameEn,
    address: String(raw.address ?? ''),
    address_ko: String(raw.address_ko ?? raw.address ?? ''),
    total_area_sqm: toNum(raw.total_area_sqm),
    map_image_path: raw.map_image_path != null ? String(raw.map_image_path) : null,
    is_active: raw.is_active !== false,
    created_at: String(raw.created_at ?? ''),
    // GPS fields — all returned as floats directly on the course object
    center_lat: toNum(raw.center_lat),
    center_lng: toNum(raw.center_lng),
    default_zoom: toNum(raw.default_zoom),
    bound_north: toNum(raw.bound_north),
    bound_south: toNum(raw.bound_south),
    bound_east: toNum(raw.bound_east),
    bound_west: toNum(raw.bound_west),
  }
}

export function normalizeCoursesList(data: unknown): GolfCourse[] {
  // Direct array — the normal case after apiRequest unwraps payload.data
  if (Array.isArray(data)) {
    return data
      .map((item) => normalizeCourse(item as Record<string, unknown>))
      .filter((c): c is GolfCourse => c != null)
  }

  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>

    // { data: [...] } — handles the full API envelope leaking through
    if (Array.isArray(record.data)) {
      return normalizeCoursesList(record.data)
    }
    // { items: [...] } — alternative pagination wrapper
    if (Array.isArray(record.items)) {
      return normalizeCoursesList(record.items)
    }
    // { results: [...] } — DRF-style pagination wrapper
    if (Array.isArray(record.results)) {
      return normalizeCoursesList(record.results)
    }

    // Last resort: treat object values as course records
    return Object.values(record)
      .map((item) => normalizeCourse(item as Record<string, unknown>))
      .filter((c): c is GolfCourse => c != null)
  }

  return []
}

export async function fetchCourses(): Promise<GolfCourse[]> {
  const raw = await apiRequest<unknown>('/courses/')
  console.log('[fetchCourses] raw API response:', raw)
  const courses = normalizeCoursesList(raw)
  console.log('[fetchCourses] normalized courses:', courses)
  return courses
}
