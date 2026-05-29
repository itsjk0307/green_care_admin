export const WEATHER_OPTIONS = [
  { value: '맑음', emoji: '☀️', label: '맑음' },
  { value: '흐림', emoji: '☁️', label: '흐림' },
  { value: '비', emoji: '🌧️', label: '비' },
  { value: '바람', emoji: '💨', label: '바람' },
] as const

export const ZONES = [
  { key: 'green', label: '그린 (GREEN)' },
  { key: 'tee', label: '티 (TEE)' },
  { key: 'fairway', label: '페어웨이 (FAIRWAY)' },
  { key: 'rough', label: '러프 (ROUGH)' },
  { key: 'bunker', label: '벙커 (BUNKER)' },
  { key: 'landscaping', label: '조경 (LANDSCAPING)' },
  { key: 'other', label: '기타' },
] as const

export const TASK_TYPES = [
  { key: 'mowing', label: '깎기' },
  { key: 'watering', label: '관수' },
  { key: 'fertilizing', label: '시비' },
  { key: 'pesticide', label: '약품' },
  { key: 'top_dressing', label: '배토' },
  { key: 'repair', label: '보수' },
  { key: 'hole_setting', label: '홀세팅' },
  { key: 'snow_removal', label: '제설' },
  { key: 'admin', label: '행정' },
  { key: 'other', label: '기타' },
] as const

export type ZoneKey = (typeof ZONES)[number]['key']
export type TaskKey = (typeof TASK_TYPES)[number]['key']

export type ZoneTaskForm = {
  clientId: string
  serverId?: string
  zone: ZoneKey | ''
  task_types: TaskKey[]
  mowing_height_mm: string
  assigned_worker_ids: string[]
  notes: string
}

export function createEmptyZoneTask(): ZoneTaskForm {
  return {
    clientId: crypto.randomUUID(),
    zone: '',
    task_types: [],
    mowing_height_mm: '',
    assigned_worker_ids: [],
    notes: '',
  }
}

export function todayLocalDate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatKoreanPlanHeader(d: Date = new Date()): string {
  const weekdays = ['일', '월', '화', '수', '목', '금', '토']
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${weekdays[d.getDay()]})`
}

export const TASK_LABEL_BY_KEY = Object.fromEntries(
  TASK_TYPES.map((t) => [t.key, t.label]),
) as Record<string, string>

export const ZONE_LABEL_BY_KEY = Object.fromEntries(
  ZONES.map((z) => [z.key, z.label]),
) as Record<string, string>

export function calcWorkingHours(
  start: string,
  end: string,
): number | null {
  const parse = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    if (Number.isNaN(h) || Number.isNaN(m)) return null
    return h * 60 + m
  }
  const s = parse(start)
  const e = parse(end)
  if (s === null || e === null || e < s) return null
  return Math.round(((e - s) / 60) * 10) / 10
}
