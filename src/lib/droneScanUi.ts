import type { DiseaseSeverity, DroneScanStatus } from '../types/droneScan'

export function diseaseDisplayName(result: {
  disease_type: string
  disease_name_ko?: string | null
  disease_name?: string | null
}): string {
  if (result.disease_type === 'healthy') return '정상'
  return result.disease_name_ko ?? result.disease_name ?? result.disease_type
}

export function holeLabel(result: {
  hole_number?: number | null
  hole_label?: string | null
}): string {
  if (result.hole_label) return result.hole_label
  if (result.hole_number != null) return `${result.hole_number}홀`
  return '—'
}

export function confidencePercent(value: number): number {
  return value <= 1 ? Math.round(value * 100) : Math.round(value)
}

export function affectedPercent(result: {
  affected_percent?: number | null
  affected_area_percent?: number | null
}): string {
  const v = result.affected_area_percent ?? result.affected_percent
  if (v == null) return '—'
  return `${v}%`
}

const PROGRESS_WIDTH: Record<number, string> = {
  0: 'w-0',
  5: 'w-[5%]',
  10: 'w-[10%]',
  15: 'w-[15%]',
  20: 'w-[20%]',
  25: 'w-1/4',
  30: 'w-[30%]',
  35: 'w-[35%]',
  40: 'w-2/5',
  45: 'w-[45%]',
  50: 'w-1/2',
  55: 'w-[55%]',
  60: 'w-3/5',
  65: 'w-[65%]',
  70: 'w-[70%]',
  75: 'w-3/4',
  80: 'w-4/5',
  85: 'w-[85%]',
  90: 'w-[90%]',
  95: 'w-[95%]',
  100: 'w-full',
}

export function confidenceWidthClass(percent: number): string {
  const rounded = Math.round(percent / 5) * 5
  return PROGRESS_WIDTH[rounded] ?? 'w-0'
}

export function severityBorderClass(severity: DiseaseSeverity): string {
  if (severity === 'critical' || severity === 'high') {
    return 'border-l-[#EF4444]'
  }
  if (severity === 'medium') return 'border-l-[#F59E0B]'
  return 'border-l-[#10B981]'
}

export function overlayBoxClass(severity: DiseaseSeverity): string {
  if (severity === 'critical') {
    return 'border-2 border-red-600 bg-red-500/25'
  }
  if (severity === 'high') {
    return 'border-2 border-red-400 bg-red-400/20'
  }
  if (severity === 'medium') {
    return 'border-2 border-yellow-400 bg-yellow-300/20'
  }
  return 'border-2 border-green-400 bg-green-400/15'
}

export function severityBadgeLabel(severity: DiseaseSeverity): string {
  const map: Record<DiseaseSeverity, string> = {
    critical: '심각',
    high: '높음',
    medium: '보통',
    low: '낮음',
    healthy: '양호',
  }
  return map[severity]
}

export function statusBadge(status: DroneScanStatus): {
  label: string
  className: string
  spinning?: boolean
} {
  if (status === 'uploaded' || status === 'pending') {
    return {
      label: '업로드됨',
      className: 'bg-[#F3F4F6] text-[#6B7280] border border-[#E5E7EB]',
    }
  }
  if (status === 'processing') {
    return {
      label: '분석 중...',
      className: 'bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]',
      spinning: true,
    }
  }
  if (status === 'completed') {
    return {
      label: '분석 완료',
      className: 'bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0]',
    }
  }
  return {
    label: '분석 실패',
    className: 'bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]',
  }
}

export function bboxPositionClass(
  x: number,
  y: number,
  w: number,
  h: number,
): string {
  const left = Math.max(0, Math.min(100, x))
  const top = Math.max(0, Math.min(100, y))
  const width = Math.max(0, Math.min(100 - left, w))
  const height = Math.max(0, Math.min(100 - top, h))
  return `absolute left-[${left}%] top-[${top}%] w-[${width}%] h-[${height}%]`
}
