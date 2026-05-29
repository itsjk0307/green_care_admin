import type { NotificationReferenceType, NotificationType } from '../types/notification'

export const NOTIFICATION_DOT_COLORS: Record<string, string> = {
  plan_published: 'bg-[#10B981]',
  task_assigned: 'bg-[#3B82F6]',
  issue_flagged: 'bg-[#F97316]',
  issue_resolved: 'bg-[#10B981]',
  issue_assigned: 'bg-[#F97316]',
  ai_result_ready: 'bg-[#8B5CF6]',
  report_approved: 'bg-[#10B981]',
  report_rejected: 'bg-[#EF4444]',
}

export function notificationDotColor(type: NotificationType): string {
  return NOTIFICATION_DOT_COLORS[type] ?? 'bg-[#9CA3AF]'
}

export function notificationTargetPath(
  referenceType: NotificationReferenceType | null | undefined,
): string | null {
  switch (referenceType) {
    case 'daily_plan':
      return '/daily-plans'
    case 'issue':
      return '/issues'
    case 'drone_scan':
      return '/drone-scans'
    case 'work_report':
      return '/work-reports'
    default:
      return null
  }
}
