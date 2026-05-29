import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import {
  TASK_LABEL_BY_KEY,
  ZONE_LABEL_BY_KEY,
} from '../../constants/dailyPlan'
import { getPlanDetail, getPlanWorkers } from '../../services/dailyPlanService'
import { fetchUsers } from '../../api/users'
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

function formatUpdatedAt(date: Date): string {
  return date.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  })
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

function statusLabel(status: DailyZoneTask['status']): string {
  if (status === 'done') return '완료'
  if (status === 'in_progress') return '진행중'
  return '대기'
}

function taskIcon(status: DailyZoneTask['status']): string {
  if (status === 'done') return '✅'
  if (status === 'in_progress') return '⏳'
  return '⬜'
}

export function PlanStatusBoard({ planId }: Props) {
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
    const done = tasks.filter((t) => t.status === 'done').length
    return Math.round((done / tasks.length) * 100)
  }, [planQuery.data?.zone_tasks])

  if (!planId) {
    return (
      <EmptyState
        icon={<span className="text-4xl">📋</span>}
        title="실시간 현황"
        description="계획을 저장하거나 발행하면 현황이 표시됩니다."
      />
    )
  }

  if (planQuery.isLoading) {
    return <LoadingSpinner message="현황 불러오는 중…" />
  }

  if (planQuery.isError || !planQuery.data) {
    return (
      <p className="text-sm text-[#DC2626]">
        현황을 불러오지 못했습니다.
      </p>
    )
  }

  const plan = planQuery.data
  const locations = locationsQuery.data ?? []

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-[#111827]">실시간 현황</h2>
        <span className="text-xs text-[#6B7280]">
          🔄 방금 전 업데이트 · {formatUpdatedAt(lastUpdated)}
        </span>
      </div>

      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-bold text-[#374151]">전체 진행률</span>
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
            등록된 구역 작업이 없습니다
          </p>
        ) : (
          plan.zone_tasks.map((task) => (
            <article
              key={task.id}
              className={`rounded-2xl border bg-white p-4 shadow-[var(--shadow-gc-card)] ${zoneBorderClass(task.status)}`}
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold text-[#111827]">
                  {ZONE_LABEL_BY_KEY[task.zone] ?? task.zone}
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
                {task.task_types.map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <span aria-hidden>{taskIcon(task.status)}</span>
                    {TASK_LABEL_BY_KEY[t] ?? t}
                  </li>
                ))}
              </ul>

              {task.status === 'done' && task.completed_at ? (
                <p className="mt-2 text-xs text-[#6B7280]">
                  완료: {new Date(task.completed_at).toLocaleString('ko-KR')}
                </p>
              ) : null}
            </article>
          ))
        )}
      </div>

      <div className="mt-6 border-t border-[#F3F4F6] pt-4">
        <h3 className="mb-2 text-sm font-bold text-[#111827]">
          작업자 위치
        </h3>
        {locationsQuery.isLoading ? (
          <p className="text-xs text-[#6B7280]">불러오는 중…</p>
        ) : locations.length === 0 ? (
          <p className="text-xs text-[#9CA3AF]">위치 정보 없음</p>
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
                    ZONE_LABEL_BY_KEY[loc.zone ?? ''] ??
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
