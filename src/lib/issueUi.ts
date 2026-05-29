import type { Issue, IssuePriority, IssueStatus, IssueType } from '../types/issue'

export const ISSUE_TYPES: {
  key: IssueType | null
  label: string
  emoji: string
  chipClass: string
}[] = [
  { key: null, label: '전체', emoji: '', chipClass: 'bg-[#1B5E20] text-white border-[#1B5E20]' },
  {
    key: 'disease',
    label: '병해',
    emoji: '🔴',
    chipClass: 'bg-white text-[#EF4444] border-[#FECACA]',
  },
  {
    key: 'equipment',
    label: '장비',
    emoji: '🔵',
    chipClass: 'bg-white text-[#3B82F6] border-[#BFDBFE]',
  },
  {
    key: 'irrigation',
    label: '관수',
    emoji: '💧',
    chipClass: 'bg-white text-[#06B6D4] border-[#A5F3FC]',
  },
  {
    key: 'turf_damage',
    label: '잔디',
    emoji: '🟠',
    chipClass: 'bg-white text-[#F97316] border-[#FDBA74]',
  },
  {
    key: 'other',
    label: '기타',
    emoji: '⚫',
    chipClass: 'bg-white text-[#6B7280] border-[#E5E7EB]',
  },
]

export const ISSUE_TYPE_META: Record<
  IssueType,
  { label: string; emoji: string; color: string; badgeClass: string }
> = {
  disease: {
    label: '병해',
    emoji: '🔴',
    color: '#EF4444',
    badgeClass: 'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]',
  },
  equipment: {
    label: '장비',
    emoji: '🔵',
    color: '#3B82F6',
    badgeClass: 'bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]',
  },
  irrigation: {
    label: '관수',
    emoji: '💧',
    color: '#06B6D4',
    badgeClass: 'bg-[#ECFEFF] text-[#0891B2] border-[#A5F3FC]',
  },
  turf_damage: {
    label: '잔디',
    emoji: '🟠',
    color: '#F97316',
    badgeClass: 'bg-[#FFF7ED] text-[#EA580C] border-[#FDBA74]',
  },
  other: {
    label: '기타',
    emoji: '⚫',
    color: '#6B7280',
    badgeClass: 'bg-[#F3F4F6] text-[#6B7280] border-[#E5E7EB]',
  },
}

export const PRIORITY_META: Record<
  IssuePriority,
  { label: string; badgeClass: string }
> = {
  critical: { label: '심각', badgeClass: 'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]' },
  high: { label: '높음', badgeClass: 'bg-[#FFF7ED] text-[#EA580C] border-[#FDBA74]' },
  medium: { label: '보통', badgeClass: 'bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]' },
  low: { label: '낮음', badgeClass: 'bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]' },
}

export const STATUS_META: Record<IssueStatus, { label: string; badgeClass: string }> = {
  open: { label: '열림', badgeClass: 'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]' },
  in_progress: {
    label: '진행중',
    badgeClass: 'bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]',
  },
  resolved: {
    label: '해결됨',
    badgeClass: 'bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]',
  },
}

const PRIORITY_ORDER: Record<IssuePriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

const STATUS_ORDER: Record<IssueStatus, number> = {
  open: 0,
  in_progress: 1,
  resolved: 2,
}

export function sortIssues(issues: Issue[]): Issue[] {
  return [...issues].sort((a, b) => {
    const statusDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
    if (statusDiff !== 0) return statusDiff
    const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
    if (priorityDiff !== 0) return priorityDiff
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return '방금 전'
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}일 전`
  return new Date(iso).toLocaleDateString('ko-KR')
}

export function formatIssueDateTime(iso: string): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${y}.${m}.${day} ${h}:${min}`
}

export function pinPositionClass(x: number, y: number): string {
  const left = Math.max(0, Math.min(100, x))
  const top = Math.max(0, Math.min(100, y))
  return `absolute left-[${left}%] top-[${top}%] -translate-x-1/2 -translate-y-full`
}

export function pinSizeClass(priority: IssuePriority): string {
  if (priority === 'critical') return 'h-10 w-10'
  if (priority === 'high') return 'h-[34px] w-[34px]'
  if (priority === 'medium') return 'h-7 w-7'
  return 'h-[22px] w-[22px]'
}

export function nextStatus(current: IssueStatus): IssueStatus {
  if (current === 'open') return 'in_progress'
  if (current === 'in_progress') return 'resolved'
  return 'resolved'
}

export function truncateTitle(title: string, max = 20): string {
  if (title.length <= max) return title
  return `${title.slice(0, max)}…`
}
