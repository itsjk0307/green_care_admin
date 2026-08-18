import type { Language, TranslationKey } from '../i18n/translations'
import { translations } from '../i18n/translations'

export type WeatherIconKey = 'sun' | 'cloud' | 'rain' | 'snow' | 'wind'

export const WEATHER_OPTIONS = [
  { value: '맑음', icon: 'sun' as const, labelKey: 'weatherClear' as const },
  { value: '흐림', icon: 'cloud' as const, labelKey: 'weatherCloudy' as const },
  { value: '비', icon: 'rain' as const, labelKey: 'weatherRain' as const },
  { value: '눈', icon: 'snow' as const, labelKey: 'weatherSnow' as const },
  { value: '바람', icon: 'wind' as const, labelKey: 'weatherWind' as const },
] as const

/** Primary locations from greenkeeper daily checklist */
export const PRIMARY_ZONES = [
  { key: 'green', labelKey: 'zoneGreen' as const },
  { key: 'tee', labelKey: 'zoneTee' as const },
  { key: 'fairway', labelKey: 'zoneFairway' as const },
] as const

export const ZONES = [
  ...PRIMARY_ZONES,
  { key: 'rough', labelKey: 'zoneRough' as const },
  { key: 'bunker', labelKey: 'zoneBunker' as const },
  { key: 'landscaping', labelKey: 'zoneLandscaping' as const },
  { key: 'other', labelKey: 'zoneOther' as const },
] as const

/** 주요작업 + 시약 — keys go to API task_types */
export const TASK_TYPES = [
  { key: 'mowing', labelKey: 'taskMowing' as const, group: 'work' },
  { key: 'rolling', labelKey: 'taskRolling' as const, group: 'work' },
  { key: 'hollow_tine', labelKey: 'taskHollowTine' as const, group: 'work' },
  { key: 'solid_tine', labelKey: 'taskSolidTine' as const, group: 'work' },
  { key: 'top_dressing', labelKey: 'taskTopDressing' as const, group: 'work' },
  { key: 'slicing', labelKey: 'taskSlicing' as const, group: 'work' },
  { key: 'verticutting', labelKey: 'taskVerticutting' as const, group: 'work' },
  { key: 'verti_drain', labelKey: 'taskVertiDrain' as const, group: 'work' },
  { key: 'overseeding', labelKey: 'taskOverseeding' as const, group: 'work' },
  { key: 'watering', labelKey: 'taskWatering' as const, group: 'work' },
  { key: 'fungicide', labelKey: 'taskFungicide' as const, group: 'chemical' },
  { key: 'insecticide', labelKey: 'taskInsecticide' as const, group: 'chemical' },
  { key: 'fertilizing', labelKey: 'taskFertilizing' as const, group: 'chemical' },
] as const

export type ZoneKey = (typeof ZONES)[number]['key']
export type TaskKey = (typeof TASK_TYPES)[number]['key']
export type FertilizerMode = 'partial' | 'full' | ''

export const DEFAULT_MOWING_HEIGHT_MM: Partial<Record<ZoneKey, number>> = {
  green: 3.5,
  tee: 21,
  fairway: 28,
}

export const DEFAULT_AERATION_MM = 8

export const MM_FIELD_TASKS = new Set<TaskKey>([
  'mowing',
  'hollow_tine',
  'solid_tine',
])

export function mmFieldLabelKey(taskTypes: TaskKey[]): TranslationKey {
  if (taskTypes.includes('mowing')) return 'mowingHeight'
  if (taskTypes.includes('hollow_tine') || taskTypes.includes('solid_tine')) {
    return 'aerationSize'
  }
  return 'sizeMm'
}

/** Stable KO ids stored in notes — display via diseaseLabelKey */
export const FUNGICIDE_TARGETS = [
  { id: '달라스팟', labelKey: 'diseaseDollarSpot' as const },
  { id: '도덜병', labelKey: 'diseaseTakeAll' as const },
  { id: '브라운패취', labelKey: 'diseaseBrownPatch' as const },
  { id: '라지패취', labelKey: 'diseaseLargePatch' as const },
  { id: '썸머패취', labelKey: 'diseaseSummerPatch' as const },
  { id: '옐고병', labelKey: 'diseaseYellowPatch' as const },
  { id: '조류', labelKey: 'diseaseAlgae' as const },
  { id: '탄저병', labelKey: 'diseaseAnthracnose' as const },
  { id: '페어리링', labelKey: 'diseaseFairyRing' as const },
  { id: '피시움', labelKey: 'diseasePythium' as const },
  { id: '준고병', labelKey: 'diseaseMeltingOut' as const },
] as const

export const FERTILIZER_MODES = [
  { key: 'partial' as const, labelKey: 'fertPartial' as const },
  { key: 'full' as const, labelKey: 'fertFull' as const },
]

export type ZoneTaskForm = {
  clientId: string
  serverId?: string
  zone: ZoneKey | ''
  task_types: TaskKey[]
  mowing_height_mm: string
  assigned_worker_ids: string[]
  assignee_name: string
  notes: string
  fungicide_targets: string[]
  fertilizer_mode: FertilizerMode
}

export function createEmptyZoneTask(zone: ZoneKey | '' = ''): ZoneTaskForm {
  return {
    clientId: crypto.randomUUID(),
    zone,
    task_types: [],
    mowing_height_mm: '',
    assigned_worker_ids: [],
    assignee_name: '',
    notes: '',
    fungicide_targets: [],
    fertilizer_mode: '',
  }
}

/** Start a blank day with Green / Tee / Fairway rows ready to tap */
export function createPrimaryZoneTemplates(): ZoneTaskForm[] {
  return PRIMARY_ZONES.map((z) => createEmptyZoneTask(z.key))
}

function zoneTaskScore(task: ZoneTaskForm): number {
  return (
    task.task_types.length * 10 +
    (task.assignee_name.trim() ? 5 : 0) +
    (task.notes.trim() ? 1 : 0) +
    (task.serverId ? 2 : 0)
  )
}

/** One card per zone (keeps richest row). Empty-zone extras are kept as-is. */
export function dedupeZoneTasksByZone(tasks: ZoneTaskForm[]): ZoneTaskForm[] {
  const byZone = new Map<string, ZoneTaskForm>()
  const noZone: ZoneTaskForm[] = []

  for (const task of tasks) {
    if (!task.zone) {
      noZone.push(task)
      continue
    }
    const existing = byZone.get(task.zone)
    if (!existing || zoneTaskScore(task) >= zoneTaskScore(existing)) {
      byZone.set(task.zone, task)
    }
  }

  const primary = PRIMARY_ZONES.map((z) => byZone.get(z.key)).filter(
    (z): z is ZoneTaskForm => Boolean(z),
  )
  const rest = [...byZone.entries()]
    .filter(([key]) => !PRIMARY_ZONES.some((z) => z.key === key))
    .map(([, task]) => task)

  return [...primary, ...rest, ...noZone]
}

export function todayLocalDate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatPlanHeader(
  language: Language,
  d: Date = new Date(),
): string {
  if (language === 'en') {
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }
  const weekdays = ['일', '월', '화', '수', '목', '금', '토']
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${weekdays[d.getDay()]})`
}

/** @deprecated use formatPlanHeader */
export function formatKoreanPlanHeader(d: Date = new Date()): string {
  return formatPlanHeader('ko', d)
}

export function zoneLabel(zone: string, language: Language): string {
  const found = ZONES.find((z) => z.key === zone)
  if (!found) return zone
  return translations[language][found.labelKey]
}

export function taskLabel(task: string, language: Language): string {
  const found = TASK_TYPES.find((t) => t.key === task)
  if (!found) return task
  return translations[language][found.labelKey]
}

export const TASK_LABEL_BY_KEY = Object.fromEntries(
  TASK_TYPES.map((t) => [t.key, translations.ko[t.labelKey]]),
) as Record<string, string>

export const ZONE_LABEL_BY_KEY = Object.fromEntries(
  ZONES.map((z) => [z.key, translations.ko[z.labelKey]]),
) as Record<string, string>

export function buildZoneTaskNotes(task: ZoneTaskForm): string | null {
  const parts: string[] = []
  if (task.assignee_name.trim()) {
    parts.push(`담당자: ${task.assignee_name.trim()}`)
  }
  if (task.fungicide_targets.length > 0) {
    parts.push(`살균제 대상: ${task.fungicide_targets.join(', ')}`)
  }
  if (task.fertilizer_mode === 'partial') parts.push('시비: 부분시약')
  if (task.fertilizer_mode === 'full') parts.push('시비: 전면시약')
  if (task.notes.trim()) parts.push(task.notes.trim())
  return parts.length > 0 ? parts.join(' · ') : null
}

export function parseZoneTaskNotes(notes: string | null | undefined): {
  fungicide_targets: string[]
  fertilizer_mode: FertilizerMode
  assignee_name: string
  rest: string
} {
  if (!notes) {
    return {
      fungicide_targets: [],
      fertilizer_mode: '',
      assignee_name: '',
      rest: '',
    }
  }

  let rest = notes
  let fungicide_targets: string[] = []
  let fertilizer_mode: FertilizerMode = ''
  let assignee_name = ''

  const assigneeMatch = rest.match(/담당자:\s*([^·]+)/)
  if (assigneeMatch) {
    assignee_name = assigneeMatch[1].trim()
    rest = rest.replace(assigneeMatch[0], '').trim()
  }

  const fungicideMatch = rest.match(/살균제 대상:\s*([^·]+)/)
  if (fungicideMatch) {
    fungicide_targets = fungicideMatch[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    rest = rest.replace(fungicideMatch[0], '').trim()
  }

  if (/시비:\s*부분시약/.test(rest)) {
    fertilizer_mode = 'partial'
    rest = rest.replace(/시비:\s*부분시약/, '').trim()
  } else if (/시비:\s*전면시약/.test(rest)) {
    fertilizer_mode = 'full'
    rest = rest.replace(/시비:\s*전면시약/, '').trim()
  }

  rest = rest.replace(/^·\s*|·\s*$/g, '').replace(/\s*·\s*·\s*/g, ' · ').trim()

  return { fungicide_targets, fertilizer_mode, assignee_name, rest }
}

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
