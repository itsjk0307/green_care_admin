export type IssueType =
  | 'disease'
  | 'equipment'
  | 'irrigation'
  | 'turf_damage'
  | 'other'

export type IssuePriority = 'critical' | 'high' | 'medium' | 'low'

export type IssueStatus = 'open' | 'in_progress' | 'resolved'

export type Issue = {
  id: string
  course_id: string
  title: string
  issue_type: IssueType
  priority: IssuePriority
  status: IssueStatus
  pin_x: number
  pin_y: number
  hole_number?: number | null
  description?: string | null
  image_path?: string | null
  assigned_to?: string | null
  assigned_to_name?: string | null
  reporter_id?: string | null
  reporter_name?: string | null
  created_at: string
  updated_at?: string
}

export type IssueFilters = {
  status?: IssueStatus | null
  issue_type?: IssueType | null
}

export type PinPosition = {
  pin_x: number
  pin_y: number
}

export type UpdateIssueBody = {
  title?: string
  issue_type?: IssueType
  priority?: IssuePriority
  status?: IssueStatus
  hole_number?: number | null
  description?: string | null
  assigned_to?: string | null
  pin_x?: number
  pin_y?: number
}
