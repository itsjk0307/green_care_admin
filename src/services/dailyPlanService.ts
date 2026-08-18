import { apiRequest, ApiError } from '../api/client'
import type { AppUser, DailyWorkPlan, DailyZoneTask } from '../types/api'
import type {
  AddZoneTaskBody,
  AttendanceItem,
  CreatePlanBody,
  PlanWorkerLocation,
  UpdatePlanBody,
  UpdateZoneTaskBody,
} from '../types/dailyPlan'

/** React Query key for today's in-progress draft (composer only). */
export const TODAY_DRAFT_PLAN_QUERY_KEY = 'daily-plan-today-draft'

export function getTodayPlan(courseId: string, options?: { draftOnly?: boolean }) {
  const params = new URLSearchParams({ course_id: courseId })
  if (options?.draftOnly) params.set('draft_only', 'true')
  return apiRequest<DailyWorkPlan>(`/daily-plans/today?${params}`)
}

export async function getTodayPlanOrNull(
  courseId: string,
  options?: { draftOnly?: boolean },
) {
  try {
    const plan = await getTodayPlan(courseId, options)
    const status = (plan.status ?? '').toLowerCase()
    if (options?.draftOnly && status !== 'draft') {
      return null
    }
    if (status === 'published' || status === 'completed') {
      return null
    }
    return plan
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

export function updatePlan(planId: string, body: UpdatePlanBody) {
  return apiRequest<DailyWorkPlan>(`/daily-plans/${planId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export function addZoneTask(planId: string, body: AddZoneTaskBody) {
  return apiRequest<DailyZoneTask>(`/daily-plans/${planId}/zones`, {
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

export function deletePlan(planId: string) {
  return apiRequest<unknown>(`/daily-plans/${planId}`, {
    method: 'DELETE',
  })
}

export function getPlanWorkers(planId: string) {
  return apiRequest<PlanWorkerLocation[]>(`/daily-plans/${planId}/workers`)
}

export type ListDailyPlansParams = {
  course_id?: string
  from_date?: string
  to_date?: string
}

function normalizePlansList(data: unknown): DailyWorkPlan[] {
  if (Array.isArray(data)) return data as DailyWorkPlan[]
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>
    if (Array.isArray(record.items)) return record.items as DailyWorkPlan[]
    if (Array.isArray(record.results)) return record.results as DailyWorkPlan[]
    if (Array.isArray(record.data)) return record.data as DailyWorkPlan[]
    if (Array.isArray(record.plans)) return record.plans as DailyWorkPlan[]
  }
  return []
}

export async function listDailyPlans(params: ListDailyPlansParams = {}) {
  const search = new URLSearchParams()
  if (params.course_id) search.set('course_id', params.course_id)
  // Backend expects date_from / date_to (also send from_date aliases for older servers)
  if (params.from_date) {
    search.set('date_from', params.from_date)
    search.set('from_date', params.from_date)
  }
  if (params.to_date) {
    search.set('date_to', params.to_date)
    search.set('to_date', params.to_date)
  }

  const qs = search.toString()
  try {
    const data = await apiRequest<unknown>(
      qs ? `/daily-plans/?${qs}` : '/daily-plans/',
    )
    return normalizePlansList(data)
  } catch (err) {
    // Some backends omit trailing slash
    if (err instanceof ApiError && err.status === 404) {
      const data = await apiRequest<unknown>(
        qs ? `/daily-plans?${qs}` : '/daily-plans',
      )
      return normalizePlansList(data)
    }
    throw err
  }
}

export function getWorkers(courseId: string) {
  const params = new URLSearchParams({
    role: 'worker',
    course_id: courseId,
  })
  return apiRequest<AppUser[]>(`/users/?${params}`)
}
