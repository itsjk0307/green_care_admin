import { apiRequest, ApiError } from '../api/client'
import type { AppUser, DailyWorkPlan } from '../types/api'
import type {
  AddZoneTaskBody,
  AttendanceItem,
  CreatePlanBody,
  PlanWorkerLocation,
  UpdateZoneTaskBody,
} from '../types/dailyPlan'

export function getTodayPlan(courseId: string) {
  const params = new URLSearchParams({ course_id: courseId })
  return apiRequest<DailyWorkPlan>(`/daily-plans/today?${params}`)
}

export async function getTodayPlanOrNull(courseId: string) {
  try {
    return await getTodayPlan(courseId)
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}

export function getPlanDetail(planId: string) {
  return apiRequest<DailyWorkPlan>(`/daily-plans/${planId}`)
}

export function createPlan(body: CreatePlanBody) {
  return apiRequest<DailyWorkPlan>('/daily-plans/', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function addZoneTask(planId: string, body: AddZoneTaskBody) {
  return apiRequest<unknown>(`/daily-plans/${planId}/zones`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function updateZoneTask(zoneTaskId: string, body: UpdateZoneTaskBody) {
  return apiRequest<unknown>(`/daily-plans/zones/${zoneTaskId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export function saveAttendance(planId: string, attendanceList: AttendanceItem[]) {
  return apiRequest<DailyWorkPlan>(`/daily-plans/${planId}/attendance`, {
    method: 'POST',
    body: JSON.stringify(attendanceList),
  })
}

export function publishPlan(planId: string) {
  return apiRequest<DailyWorkPlan>(`/daily-plans/${planId}/publish`, {
    method: 'POST',
  })
}

export function getPlanWorkers(planId: string) {
  return apiRequest<PlanWorkerLocation[]>(`/daily-plans/${planId}/workers`)
}

export function getWorkers(courseId: string) {
  const params = new URLSearchParams({
    role: 'worker',
    course_id: courseId,
  })
  return apiRequest<AppUser[]>(`/users/?${params}`)
}
