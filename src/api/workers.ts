import { apiRequest } from './client'

export type CourseWorkerType = 'regular' | 'contract'

export type CourseWorker = {
  id: string
  course_id: string
  name: string
  worker_type: CourseWorkerType
  active: boolean
  created_at: string
  updated_at: string
}

export type CourseWorkerDay = {
  id: string | null
  course_id: string
  work_date: string
  temp_worker_count: number
  start_time: string | null
  end_time: string | null
  notes: string | null
  present_worker_ids: string[]
  named_present_count: number
  total_workers: number
  updated_at: string | null
}

export type WorkerHubCourseRow = {
  course_id: string
  course_name: string
  course_name_ko: string
  named_present_count: number
  temp_worker_count: number
  total_workers: number
  start_time: string | null
  end_time: string | null
}

export type WorkerHub = {
  work_date: string
  courses: WorkerHubCourseRow[]
  grand_total: number
  named_total: number
  temp_total: number
}

export function listCourseWorkers(params?: {
  course_id?: string
  include_inactive?: boolean
}) {
  const q = new URLSearchParams()
  if (params?.course_id) q.set('course_id', params.course_id)
  if (params?.include_inactive) q.set('include_inactive', 'true')
  const qs = q.toString()
  return apiRequest<{ workers: CourseWorker[] }>(
    qs ? `/workers/?${qs}` : '/workers/',
  )
}

export function createCourseWorker(body: {
  course_id: string
  name: string
  worker_type: CourseWorkerType
}) {
  return apiRequest<CourseWorker>('/workers/', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function updateCourseWorker(
  workerId: string,
  body: {
    name?: string
    worker_type?: CourseWorkerType
    active?: boolean
  },
) {
  return apiRequest<CourseWorker>(`/workers/${workerId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export function deleteCourseWorker(workerId: string) {
  return apiRequest<Record<string, never>>(`/workers/${workerId}`, {
    method: 'DELETE',
  })
}

export function getWorkerDay(workDate: string, courseId: string) {
  return apiRequest<CourseWorkerDay>(
    `/workers/days/${workDate}?course_id=${encodeURIComponent(courseId)}`,
  )
}

export function upsertWorkerDay(
  workDate: string,
  body: {
    course_id: string
    temp_worker_count: number
    start_time?: string | null
    end_time?: string | null
    notes?: string | null
    present_worker_ids: string[]
  },
) {
  return apiRequest<CourseWorkerDay>(`/workers/days/${workDate}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export function getWorkerHub(workDate: string) {
  return apiRequest<WorkerHub>(
    `/workers/hub?work_date=${encodeURIComponent(workDate)}`,
  )
}
