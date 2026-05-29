export type NotificationType =
  | 'plan_published'
  | 'task_assigned'
  | 'issue_flagged'
  | 'issue_resolved'
  | 'issue_assigned'
  | 'ai_result_ready'
  | 'report_approved'
  | 'report_rejected'
  | string

export type NotificationReferenceType =
  | 'daily_plan'
  | 'issue'
  | 'drone_scan'
  | 'work_report'
  | string

export type AppNotification = {
  id: string
  type: NotificationType
  title_ko: string
  body_ko: string
  is_read: boolean
  reference_type: NotificationReferenceType | null
  reference_id: string | null
  created_at: string
}

export type UnreadCount = {
  count: number
}

export type NotificationsPage = {
  items: AppNotification[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export type NotificationReadFilter = 'all' | 'unread' | 'read'
