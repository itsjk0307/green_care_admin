import {
  PRIMARY_ZONES,
  formatPlanHeader,
  mmFieldLabelKey,
  parseZoneTaskNotes,
  taskLabel,
  zoneLabel,
  type FertilizerMode,
  type TaskKey,
} from '../constants/dailyPlan'
import type { Language, TranslationKey } from '../i18n/translations'
import { translations } from '../i18n/translations'
import type { DailyWorkPlan, DailyZoneTask } from '../types/api'

export type ZoneWorkDisplay = {
  id: string
  zone: string
  zoneLabel: string
  taskLabels: string[]
  mowingHeightMm: number | null
  mmLabelKey: TranslationKey | null
  assigneeName: string
  fertilizerMode: FertilizerMode
  fungicideTargets: string[]
  memo: string
  status: string
}

function apiZoneScore(task: DailyZoneTask): number {
  const parsed = parseZoneTaskNotes(task.notes)
  return (
    (task.task_types?.length ?? 0) * 10 +
    (parsed.assignee_name.trim() ? 5 : 0) +
    (parsed.rest.trim() ? 1 : 0)
  )
}

/** One row per zone (richest wins), primary zones first. */
export function dedupeApiZoneTasks(tasks: DailyZoneTask[]): DailyZoneTask[] {
  const byZone = new Map<string, DailyZoneTask>()
  const noZone: DailyZoneTask[] = []

  for (const task of tasks) {
    if (!task.zone) {
      noZone.push(task)
      continue
    }
    const existing = byZone.get(task.zone)
    if (!existing || apiZoneScore(task) >= apiZoneScore(existing)) {
      byZone.set(task.zone, task)
    }
  }

  const primary = PRIMARY_ZONES.map((z) => byZone.get(z.key)).filter(
    (z): z is DailyZoneTask => Boolean(z),
  )
  const rest = [...byZone.entries()]
    .filter(([key]) => !PRIMARY_ZONES.some((z) => z.key === key))
    .map(([, task]) => task)

  return [...primary, ...rest, ...noZone]
}

export function toZoneWorkDisplay(
  task: DailyZoneTask,
  language: Language,
): ZoneWorkDisplay {
  const parsed = parseZoneTaskNotes(task.notes)
  const taskTypes = (task.task_types ?? []) as TaskKey[]
  const hasMm =
    task.mowing_height_mm != null &&
    taskTypes.some((t) =>
      ['mowing', 'hollow_tine', 'solid_tine'].includes(t),
    )

  return {
    id: task.id,
    zone: task.zone,
    zoneLabel: zoneLabel(task.zone, language),
    taskLabels: taskTypes.map((t) => taskLabel(t, language)),
    mowingHeightMm: hasMm ? task.mowing_height_mm : null,
    mmLabelKey: hasMm ? mmFieldLabelKey(taskTypes) : null,
    assigneeName: parsed.assignee_name,
    fertilizerMode: parsed.fertilizer_mode,
    fungicideTargets: parsed.fungicide_targets,
    memo: parsed.rest,
    status: task.status,
  }
}

export function planZoneDisplays(
  plan: DailyWorkPlan,
  language: Language,
): ZoneWorkDisplay[] {
  return dedupeApiZoneTasks(plan.zone_tasks ?? []).map((z) =>
    toZoneWorkDisplay(z, language),
  )
}

export function planZoneChipLabels(
  plan: DailyWorkPlan,
  language: Language,
): string[] {
  return planZoneDisplays(plan, language).map((z) => z.zoneLabel)
}

export function formatPlanDate(
  planDate: string,
  language: Language,
): string {
  const [y, m, d] = planDate.split('-').map(Number)
  if (!y || !m || !d) return planDate
  return formatPlanHeader(language, new Date(y, m - 1, d))
}

export function formatPlanListTitle(
  plan: DailyWorkPlan,
  language: Language,
): string {
  const datePart = formatPlanDate(plan.plan_date, language)
  const created = new Date(plan.created_at)
  if (Number.isNaN(created.getTime())) return datePart
  const time = created.toLocaleTimeString(
    language === 'ko' ? 'ko-KR' : 'en-US',
    { hour: '2-digit', minute: '2-digit', hour12: false },
  )
  return `${datePart} · ${time}`
}

export function fertilizerModeLabel(
  mode: FertilizerMode,
  language: Language,
): string {
  if (mode === 'partial') return translations[language].fertPartial
  if (mode === 'full') return translations[language].fertFull
  return ''
}
