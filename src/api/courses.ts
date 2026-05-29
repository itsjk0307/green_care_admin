import { apiRequest } from './client'
import type { GolfCourse } from '../types/api'

function normalizeCourse(raw: Record<string, unknown>): GolfCourse | null {
  const id = raw.id ?? raw.course_id
  if (id == null || id === '') return null

  const name = String(raw.name ?? '')
  const nameKo = String(raw.name_ko ?? name)

  return {
    id: String(id),
    name,
    name_ko: nameKo,
    address: String(raw.address ?? ''),
    address_ko: String(raw.address_ko ?? raw.address ?? ''),
    total_area_sqm:
      raw.total_area_sqm != null ? Number(raw.total_area_sqm) : null,
    map_image_path:
      raw.map_image_path != null ? String(raw.map_image_path) : null,
    is_active: raw.is_active !== false,
    created_at: String(raw.created_at ?? ''),
  }
}

export function normalizeCoursesList(data: unknown): GolfCourse[] {
  if (Array.isArray(data)) {
    return data
      .map((item) =>
        normalizeCourse(item as Record<string, unknown>),
      )
      .filter((c): c is GolfCourse => c != null)
  }

  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>
    if (Array.isArray(record.items)) {
      return normalizeCoursesList(record.items)
    }
    return Object.values(record)
      .map((item) =>
        normalizeCourse(item as Record<string, unknown>),
      )
      .filter((c): c is GolfCourse => c != null)
  }

  return []
}

async function fetchCoursesFromPath(path: string): Promise<GolfCourse[]> {
  const data = await apiRequest<unknown>(path)
  return normalizeCoursesList(data)
}

/** Loads golf courses; tries `/courses/` then `/golf-courses/`. */
export async function fetchCourses(): Promise<GolfCourse[]> {
  const paths = ['/courses/', '/golf-courses/']
  let lastError: unknown

  for (const path of paths) {
    try {
      const courses = await fetchCoursesFromPath(path)
      if (courses.length > 0) return courses
    } catch (err) {
      lastError = err
    }
  }

  if (lastError) throw lastError
  return []
}
