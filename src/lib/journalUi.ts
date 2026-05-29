import type { JournalZoneTask } from '../types/journal'

const weekdays = ['일', '월', '화', '수', '목', '금', '토']

export function formatKoreanJournalDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return iso
  const date = new Date(y, m - 1, d)
  return `${y}년 ${m}월 ${d}일 (${weekdays[date.getDay()]})`
}

export function weatherEmoji(weather: string | null | undefined): string {
  if (!weather) return '🌤️'
  if (weather.includes('맑')) return '☀️'
  if (weather.includes('흐')) return '☁️'
  if (weather.includes('비')) return '🌧️'
  if (weather.includes('바람')) return '💨'
  if (weather.includes('눈')) return '❄️'
  return '🌤️'
}

export function completionDotClass(percent: number, hasPlan: boolean): string {
  if (!hasPlan) return ''
  if (percent > 80) return 'bg-[#10B981]'
  if (percent >= 40) return 'bg-[#F59E0B]'
  return 'bg-[#EF4444]'
}

export function zoneStatusBadge(status: JournalZoneTask['status']): string {
  if (status === 'done') {
    return 'bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0]'
  }
  if (status === 'in_progress') {
    return 'bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]'
  }
  return 'bg-[#F3F4F6] text-[#6B7280] border border-[#E5E7EB]'
}

export function zoneStatusLabel(status: JournalZoneTask['status']): string {
  if (status === 'done') return '완료'
  if (status === 'in_progress') return '진행중'
  return '대기'
}

export function attendanceStatusLabel(
  status: 'present' | 'absent' | 'overtime',
): string {
  if (status === 'present') return '출근'
  if (status === 'absent') return '결근'
  return '연장'
}

export function attendanceStatusClass(
  status: 'present' | 'absent' | 'overtime',
): string {
  if (status === 'present') {
    return 'bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0]'
  }
  if (status === 'absent') {
    return 'bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]'
  }
  return 'bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]'
}

export function monthKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export function formatMonthLabel(monthKeyStr: string): string {
  const [y, m] = monthKeyStr.split('-').map(Number)
  return `${y}년 ${m}월`
}
