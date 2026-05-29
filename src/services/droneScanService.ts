import { apiRequest } from '../api/client'
import { apiOrigin } from '../config'
import type { GolfCourse } from '../types/api'
import type { DroneScanDetail, DroneScanSummary } from '../types/droneScan'

const STORAGE_PREFIX = '/storage/drone_scans/'

export function getDroneStorageImageUrl(
  imagePath: string | null | undefined,
): string {
  if (!imagePath) return ''
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath
  }

  const origin =
    apiOrigin() ||
    (import.meta.env.DEV ? '' : 'http://192.168.0.61:8010')

  const normalized = imagePath.replace(/^\//, '')
  if (normalized.startsWith('storage/')) {
    return `${origin}/${normalized}`
  }
  return `${origin}${STORAGE_PREFIX}${normalized}`
}

export function uploadDroneScan(formData: FormData) {
  return apiRequest<DroneScanDetail>('/drone-scans/', {
    method: 'POST',
    body: formData,
  })
}

export function analyzeScan(scanId: string) {
  return apiRequest<DroneScanDetail>(`/drone-scans/${scanId}/analyze`, {
    method: 'POST',
  })
}

export function getDroneScans(courseId: string) {
  const params = new URLSearchParams({ course_id: courseId })
  return apiRequest<DroneScanSummary[]>(`/drone-scans/?${params}`)
}

export function getLatestScan(courseId: string) {
  const params = new URLSearchParams({ course_id: courseId })
  return apiRequest<DroneScanDetail | null>(`/drone-scans/latest?${params}`)
}

export function getScanDetail(scanId: string) {
  return apiRequest<DroneScanDetail>(`/drone-scans/${scanId}`)
}

export async function getGolfCourses() {
  try {
    return await apiRequest<GolfCourse[]>('/golf-courses/')
  } catch {
    return apiRequest<GolfCourse[]>('/courses/')
  }
}
