import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import {
  taskLabel,
  zoneLabel,
} from '../../constants/dailyPlan'
import { getPlanDetail, getPlanWorkers } from '../../services/dailyPlanService'
import { fetchUsers } from '../../api/users'
import { useLanguageStore } from '../../stores/languageStore'
import { Badge } from '../ui/Badge'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { EmptyState } from '../ui/EmptyState'
import type { DailyZoneTask } from '../../types/api'

type Props = {
  planId: string | null
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

function progressWidthClass(percent: number): string {
  const rounded = Math.round(percent / 5) * 5
  return PROGRESS_WIDTH[rounded] ?? 'w-0'
}

function zoneBorderClass(status: DailyZoneTask['status']): string {
  if (status === 'done') return 'border-[#10B981]'
  if (status === 'in_progress')
    return 'border-[#F59E0B] border-l-4 animate-pulse'
  return 'border-[#E5E7EB]'
}

function statusBadgeVariant(
  status: DailyZoneTask['status'],
): 'pending' | 'info' | 'approved' {
  if (status === 'done') return 'approved'
  if (status === 'in_progress') return 'info'
  return 'pending'
}

function taskIcon(status: DailyZoneTask['status']): string {
  if (status === 'done') return '✅'
  if (status === 'in_progress') return '⏳'
  return '⬜'
}

export function PlanStatusBoard({ planId }: Props) {
  const { t, language } = useLanguageStore()
  const [lastUpdated, setLastUpdated] = useState(new Date())

  const planQuery = useQuery({
    queryKey: ['daily-plan', planId],
    queryFn: () => getPlanDetail(planId!),
    enabled: Boolean(planId),
    refetchInterval: 60_000,
  })

  const workersQuery = useQuery({
    queryKey: ['users', 'worker'],
    queryFn: () => fetchUsers('worker'),
  })

  const locationsQuery = useQuery({
    queryKey: ['daily-plan-workers', planId],
    queryFn: () => getPlanWorkers(planId!),
    enabled: Boolean(planId),
    refetchInterval: 60_000,
  })

  useEffect(() => {
    if (planQuery.dataUpdatedAt) {
      setLastUpdated(new Date(planQuery.dataUpdatedAt))
    }
  }, [planQuery.dataUpdatedAt])

  const workerNameById = useMemo(() => {
    const map = new Map<string, string>()
    ;(workersQuery.data ?? []).forEach((w) => map.set(w.id, w.name))
    return map
  }, [workersQuery.data])

  const progress = useMemo(() => {
    const tasks = planQuery.data?.zone_tasks ?? []
    if (tasks.length === 0) return 0
    const done = tasks.filter((task) => task.status === 'done').length
    return Math.round((done / tasks.length) * 100)
  }, [planQuery.data?.zone_tasks])

  function formatUpdatedAt(date: Date): string {
    return date.toLocaleTimeString(language === 'en' ? 'en-US' : 'ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  function statusLabel(status: DailyZoneTask['status']): string {
    if (status === 'done') return t('statusDone')
    if (status === 'in_progress') return t('statusInProgress')
    return t('statusWaiting')
  }

  if (!planId) {
    return (
      <EmptyState
        icon={<span className="text-4xl">📋</span>}
        title={t('liveStatus')}
        description={t('liveStatusEmpty')}
      />
    )
  }

  if (planQuery.isLoading) {
    return <LoadingSpinner message={t('loadingStatus')} />
  }

  if (planQuery.isError || !planQuery.data) {
    return (
      <p className="text-sm text-[#DC2626]">{t('statusLoadFailed')}</p>
    )
  }

  const plan = planQuery.data
  const locations = locationsQuery.data ?? []
  const locale = language === 'en' ? 'en-US' : 'ko-KR'

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-[#111827]">{t('liveStatus')}</h2>
        <span className="text-xs text-[#6B7280]">
          🔄 {t('updatedJustNow')} · {formatUpdatedAt(lastUpdated)}
        </span>
      </div>

      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-bold text-[#374151]">{t('overallProgress')}</span>
          <span className="font-bold text-[#1B5E20]">{progress}%</span>
        </div>
        <div
          className="h-3 w-full overflow-hidden rounded-full bg-[#E5E7EB]"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={`h-full rounded-full bg-[#1B5E20] transition-all duration-500 ${progressWidthClass(progress)}`}
          />
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto pr-1">
        {plan.zone_tasks.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[#E5E7EB] py-8 text-center text-sm text-[#6B7280]">
            {t('noZoneTasks')}
          </p>
        ) : (
          plan.zone_tasks.map((task) => (
            <article
              key={task.id}
              className={`rounded-2xl border bg-white p-4 shadow-[var(--shadow-gc-card)] ${zoneBorderClass(task.status)}`}
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold text-[#111827]">
                  {zoneLabel(task.zone, language)}
                </p>
                <Badge variant={statusBadgeVariant(task.status)}>
                  {statusLabel(task.status)}
                </Badge>
              </div>

              {task.assigned_worker_ids.length > 0 ? (
                <div className="mb-2 flex flex-wrap gap-1">
                  {task.assigned_worker_ids.map((wid) => (
                    <span
                      key={wid}
                      className="rounded-full border border-[#E5E7EB] bg-[#F9FAFB] px-2 py-0.5 text-[11px] font-medium text-[#374151]"
                    >
                      {workerNameById.get(wid) ?? wid.slice(0, 6)}
                    </span>
                  ))}
                </div>
              ) : null}

              <ul className="space-y-1 text-sm text-[#374151]">
                {task.task_types.map((taskType) => (
                  <li key={taskType} className="flex items-center gap-2">
                    <span aria-hidden>{taskIcon(task.status)}</span>
                    {taskLabel(taskType, language)}
                  </li>
                ))}
              </ul>

              {task.status === 'done' && task.completed_at ? (
                <p className="mt-2 text-xs text-[#6B7280]">
                  {t('completedAt')}:{' '}
                  {new Date(task.completed_at).toLocaleString(locale)}
                </p>
              ) : null}
            </article>
          ))
        )}
      </div>

      <div className="mt-6 border-t border-[#F3F4F6] pt-4">
        <h3 className="mb-2 text-sm font-bold text-[#111827]">
          {t('workerLocations')}
        </h3>
        {locationsQuery.isLoading ? (
          <p className="text-xs text-[#6B7280]">{t('loadingEllipsis')}</p>
        ) : locations.length === 0 ? (
          <p className="text-xs text-[#9CA3AF]">{t('noLocationInfo')}</p>
        ) : (
          <ul className="max-h-40 space-y-2 overflow-y-auto">
            {locations.map((loc) => (
              <li
                key={loc.worker_id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#F9FAFB] px-3 py-2 text-sm"
              >
                <span className="font-medium text-[#111827]">
                  {loc.name || workerNameById.get(loc.worker_id) || '—'}
                </span>
                <span className="text-xs text-[#6B7280]">
                  {loc.zone_label ??
                    (loc.zone ? zoneLabel(loc.zone, language) : null) ??
                    loc.zone ??
                    '—'}
                  {loc.status ? ` · ${loc.status}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
