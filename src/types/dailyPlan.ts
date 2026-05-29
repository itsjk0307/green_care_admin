import type { AppUser, DailyWorkPlan } from './api'

export type CreatePlanBody = {
  course_id: string
  plan_date: string
  weather: string
  temperature_min?: number | null
  temperature_max?: number | null
  rainfall_mm?: number | null
  special_notes?: string | null
}

export type AddZoneTaskBody = {
  zone: string
  task_types: string[]
  mowing_height_mm?: number | null
  assigned_worker_ids: string[]
  notes?: string | null
}

export type UpdateZoneTaskBody = {
  status?: 'pending' | 'in_progress' | 'done'
  completed_at?: string | null
}

export type AttendanceItem = {
  worker_id: string
  status: 'present' | 'absent' | 'overtime'
  start_time?: string | null
  end_time?: string | null
  working_hours?: number | null
}

export type PlanWorkerLocation = {
  worker_id: string
  name: string
  zone?: string | null
  zone_label?: string | null
  status?: string | null
}

export type { DailyWorkPlan, AppUser }
