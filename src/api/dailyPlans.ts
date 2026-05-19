import { apiRequest, ApiError } from './client'
import type { DailyWorkPlan } from '../types/api'

export type CreateDailyPlanPayload = {
  course_id: string
  plan_date: string
  weather: string
  temperature_min?: number | null
  temperature_max?: number | null
  rainfall_mm?: number | null
  special_notes?: string | null
}

export type CreateZoneTaskPayload = {
  zone: string
  task_types: string[]
  mowing_height_mm?: number | null
  assigned_worker_ids: string[]
  notes?: string | null
}

export type AttendanceItemPayload = {
  worker_id: string
  status: 'present' | 'absent' | 'overtime'
  start_time?: string | null
  end_time?: string | null
  working_hours?: number | null
}

export function createDailyPlan(payload: CreateDailyPlanPayload) {
  return apiRequest<DailyWorkPlan>('/daily-plans/', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function addZoneTask(planId: string, payload: CreateZoneTaskPayload) {
  return apiRequest<unknown>(`/daily-plans/${planId}/zones`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function saveAttendance(planId: string, items: AttendanceItemPayload[]) {
  return apiRequest<DailyWorkPlan>(`/daily-plans/${planId}/attendance`, {
    method: 'POST',
    body: JSON.stringify(items),
  })
}

export function fetchTodayPlan(courseId: string) {
  return apiRequest<DailyWorkPlan>(
    `/daily-plans/today?course_id=${encodeURIComponent(courseId)}`,
  )
}

export async function fetchTodayPlanOrNull(courseId: string) {
  try {
    return await fetchTodayPlan(courseId)
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}

export function updateDailyPlan(
  planId: string,
  payload: { special_notes?: string | null },
) {
  return apiRequest<DailyWorkPlan>(`/daily-plans/${planId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function updateZoneTaskStatus(
  zoneTaskId: string,
  status: 'pending' | 'in_progress' | 'done',
) {
  return apiRequest<unknown>(`/daily-plans/zones/${zoneTaskId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}
