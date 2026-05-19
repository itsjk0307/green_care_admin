export const WEATHER_OPTIONS = [
  { value: '맑음', emoji: '☀️', label: '맑음' },
  { value: '흐림', emoji: '⛅', label: '흐림' },
  { value: '비', emoji: '🌧️', label: '비' },
  { value: '눈', emoji: '❄️', label: '눈' },
] as const

export const ZONES = [
  { key: 'green', label: '그린' },
  { key: 'tee', label: '티' },
  { key: 'fairway', label: '페어웨이' },
  { key: 'rough', label: '러프' },
  { key: 'bunker', label: '벙커' },
  { key: 'landscaping', label: '조경' },
  { key: 'other', label: '기타' },
] as const

export const TASK_TYPES = [
  { key: 'mowing', label: '예지작업' },
  { key: 'watering', label: '관수' },
  { key: 'fertilizing', label: '시비' },
  { key: 'pesticide', label: '시약' },
  { key: 'top_dressing', label: '배토' },
  { key: 'renovation', label: '갱신' },
  { key: 'hole_setting', label: '홀세팅' },
  { key: 'other', label: '기타' },
] as const

export type ZoneKey = (typeof ZONES)[number]['key']
export type TaskKey = (typeof TASK_TYPES)[number]['key']

export type ZoneFormState = {
  tasks: Set<TaskKey>
  mowingHeight: string
  workerIds: string[]
  notes: string
}

export function createEmptyZoneState(): Record<ZoneKey, ZoneFormState> {
  const state = {} as Record<ZoneKey, ZoneFormState>
  for (const z of ZONES) {
    state[z.key] = {
      tasks: new Set<TaskKey>(),
      mowingHeight: '',
      workerIds: [],
      notes: '',
    }
  }
  return state
}

export function todayLocalDate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const ZONE_STATUS_CYCLE = ['pending', 'in_progress', 'done'] as const
export type ZoneStatusKey = (typeof ZONE_STATUS_CYCLE)[number]

export const ZONE_STATUS_META: Record<
  ZoneStatusKey,
  { label: string; badge: 'pending' | 'info' | 'approved' }
> = {
  pending: { label: '대기중', badge: 'pending' },
  in_progress: { label: '진행중', badge: 'info' },
  done: { label: '완료', badge: 'approved' },
}

export const ATTENDANCE_STATUS_META = {
  present: { label: '출근', badge: 'approved' as const },
  absent: { label: '결근', badge: 'rejected' as const },
  overtime: { label: '연장', badge: 'info' as const },
}

export const TASK_LABEL_BY_KEY = Object.fromEntries(
  TASK_TYPES.map((t) => [t.key, t.label]),
) as Record<string, string>

export const ZONE_LABEL_BY_KEY = Object.fromEntries(
  ZONES.map((z) => [z.key, z.label]),
) as Record<string, string>

/** Safety counter start date (hardcoded until dedicated API exists). */
export const SAFETY_COUNTER_START = new Date(2025, 0, 1)

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
