export type JournalZoneTask = {
  id?: string
  zone: string
  zone_label?: string | null
  task_types: string[]
  mowing_height_mm?: number | null
  assigned_worker_names?: string[]
  assigned_workers?: string[]
  status: 'pending' | 'in_progress' | 'done'
  completed_at?: string | null
}

export type JournalAttendance = {
  worker_id: string
  worker_name: string
  status: 'present' | 'absent' | 'overtime'
  start_time?: string | null
  end_time?: string | null
  working_hours?: number | null
}

export type JournalIssuesSummary = {
  new_count: number
  resolved_count: number
  photo_count: number
}

export type DailyJournal = {
  date: string
  weather?: string | null
  temperature_min?: number | null
  temperature_max?: number | null
  rainfall_mm?: number | null
  special_notes?: string | null
  zone_tasks?: JournalZoneTask[]
  attendance?: JournalAttendance[]
  issues_summary?: JournalIssuesSummary | null
}

export type MonthlyJournalDay = {
  date: string
  completion_percent: number
  has_plan: boolean
}

export type MonthlyJournal = {
  month: string
  days: MonthlyJournalDay[]
}
