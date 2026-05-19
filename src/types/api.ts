export type ApiResponse<T> = {
  success: boolean
  message: string
  data: T
}

export type GolfCourse = {
  id: string
  name: string
  name_ko: string
  address: string
  address_ko: string
  total_area_sqm: number | null
  map_image_path: string | null
  is_active: boolean
  created_at: string
}

export type AppUser = {
  id: string
  name: string
  email: string
  role: string
  is_active: boolean
  created_at: string
}

export type DailyZoneTask = {
  id: string
  plan_id: string
  zone: string
  task_types: string[]
  mowing_height_mm: number | null
  assigned_worker_ids: string[]
  notes: string | null
  status: 'pending' | 'in_progress' | 'done'
  completed_at: string | null
}

export type DailyWorkerAttendance = {
  id: string
  plan_id: string
  worker_id: string
  status: 'present' | 'absent' | 'overtime'
  start_time: string | null
  end_time: string | null
  working_hours: number | null
}

export type DailyWorkPlan = {
  id: string
  course_id: string
  created_by: string
  plan_date: string
  weather: string
  temperature_min: number | null
  temperature_max: number | null
  rainfall_mm: number | null
  special_notes: string | null
  total_workers: number | null
  status: string
  created_at: string
  updated_at: string
  zone_tasks: DailyZoneTask[]
  attendance: DailyWorkerAttendance[]
}
