import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CalendarDaysIcon,
  CloudIcon,
  PhotoIcon,
  TrashIcon,
  UsersIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { fetchCourses } from '../../api/courses'
import { ApiError } from '../../api/client'
import { listPlanMedia, planMediaPreviewUrl } from '../../services/planMediaService'
import { deletePlan, listDailyPlans, TODAY_DRAFT_PLAN_QUERY_KEY } from '../../services/dailyPlanService'
import { courseDisplayName } from '../../lib/courseName'
import {
  formatPlanDate,
  formatPlanListTitle,
  planZoneChipLabels,
} from '../../lib/workReportDisplay'
import { useLanguageStore } from '../../stores/languageStore'
import type { DailyWorkPlan } from '../../types/api'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { EmptyState } from '../ui/EmptyState'

const selectClass =
  'h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-all duration-150 focus:border-[#121820] focus:ring-2 focus:ring-[#121820]/20'

const inputClass =
  'h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-all duration-150 focus:border-[#121820] focus:ring-2 focus:ring-[#121820]/20'

type Props = {
  onOpenPlan?: (plan: DailyWorkPlan) => void
  onCreateToday?: () => void
  /** Hide title / local filters when used inside Report History tabs */
  embedded?: boolean
  courseId?: string
  fromDate?: string
  toDate?: string
  searchQuery?: string
}

function daysAgoIso(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function todayIso(): string {
  return daysAgoIso(0)
}

function statusBadge(status: string, draftLabel: string, publishedLabel: string) {
  const s = status.toLowerCase()
  if (s === 'published' || s === 'done' || s === 'completed') {
    return <Badge variant="approved">{publishedLabel}</Badge>
  }
  if (s === 'draft') {
    return <Badge variant="pending">{draftLabel}</Badge>
  }
  return <Badge variant="info">{status}</Badge>
}

function PlanMediaThumbs({ planId }: { planId: string }) {
  const mediaQuery = useQuery({
    queryKey: ['plan-media', planId],
    queryFn: () => listPlanMedia(planId),
    staleTime: 60_000,
    retry: 0,
  })
  const items = (mediaQuery.data ?? []).slice(0, 4)
  if (mediaQuery.isLoading) {
    return <p className="text-[11px] text-slate-400">…</p>
  }
  if (items.length === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
        <PhotoIcon className="h-3.5 w-3.5" />0
      </span>
    )
  }
  return (
    <div className="flex items-center gap-1">
      {items.map((m) => {
        const url = planMediaPreviewUrl(m)
        return (
          <div
            key={m.id}
            className="h-10 w-10 overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
          >
            {m.media_type === 'video' ? (
              <div className="flex h-full w-full items-center justify-center bg-slate-800 text-[10px] text-white">
                ▶
              </div>
            ) : url ? (
              <img src={url} alt="" className="h-full w-full object-cover" />
            ) : null}
          </div>
        )
      })}
      {(mediaQuery.data?.length ?? 0) > 4 ? (
        <span className="text-[11px] font-medium text-slate-500">
          +{(mediaQuery.data?.length ?? 0) - 4}
        </span>
      ) : null}
    </div>
  )
}

export function WorkReportList({
  onOpenPlan,
  onCreateToday,
  embedded = false,
  courseId: courseIdProp,
  fromDate: fromDateProp,
  toDate: toDateProp,
  searchQuery = '',
}: Props) {
  const navigate = useNavigate()
  const { t, language } = useLanguageStore()
  const queryClient = useQueryClient()
  const [courseIdLocal, setCourseIdLocal] = useState('')
  const [fromDateLocal, setFromDateLocal] = useState(() => daysAgoIso(14))
  const [toDateLocal, setToDateLocal] = useState(() => todayIso())
  const [pendingDelete, setPendingDelete] = useState<DailyWorkPlan | null>(null)

  const courseId = courseIdProp ?? courseIdLocal
  const fromDate = fromDateProp ?? fromDateLocal
  const toDate = toDateProp ?? toDateLocal

  function openPlan(plan: DailyWorkPlan) {
    if (onOpenPlan) {
      onOpenPlan(plan)
      return
    }
    navigate(`/report-history/${plan.id}`)
  }

  const coursesQuery = useQuery({ queryKey: ['courses'], queryFn: fetchCourses })
  const courses = coursesQuery.data ?? []

  const plansQuery = useQuery({
    queryKey: ['daily-plans-list', courseId, fromDate, toDate],
    queryFn: () =>
      listDailyPlans({
        course_id: courseId || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
      }),
    refetchOnMount: 'always',
  })

  const deleteMutation = useMutation({
    mutationFn: (planId: string) => deletePlan(planId),
    onSuccess: async (_data, planId) => {
      toast.success(t('reportDeleted'), { className: 'gc-toast-success' })
      setPendingDelete(null)
      await queryClient.invalidateQueries({ queryKey: ['daily-plans-list'] })
      await queryClient.invalidateQueries({ queryKey: [TODAY_DRAFT_PLAN_QUERY_KEY] })
      await queryClient.invalidateQueries({ queryKey: ['daily-plan-today'] })
      await queryClient.invalidateQueries({ queryKey: ['plan-media', planId] })
    },
    onError: (err) => {
      toast.error(
        err instanceof ApiError ? err.message : t('reportDeleteFailed'),
        { className: 'gc-toast-error' },
      )
    },
  })

  const courseNameById = useMemo(() => {
    const map = new Map<string, string>()
    courses.forEach((c) => map.set(c.id, courseDisplayName(c, language)))
    return map
  }, [courses, language])

  const plans = useMemo(() => {
    const list = [...(plansQuery.data ?? [])]
    list.sort((a, b) => {
      if (a.plan_date !== b.plan_date) {
        return a.plan_date < b.plan_date ? 1 : -1
      }
      return a.created_at < b.created_at ? 1 : -1
    })
    const q = searchQuery.trim().toLowerCase()
    if (!q) return list
    return list.filter((plan) => {
      const courseName = courseNameById.get(plan.course_id) ?? plan.course_id
      const zones = planZoneChipLabels(plan, language).join(' ')
      const hay = [
        courseName,
        plan.plan_date,
        formatPlanDate(plan.plan_date, language),
        plan.status,
        plan.weather,
        plan.special_notes ?? '',
        zones,
      ]
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [plansQuery.data, searchQuery, courseNameById, language])

  return (
    <div className="space-y-4">
      {embedded ? null : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-900 sm:text-lg">
                {t('reportListTitle')}
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">{t('reportListHint')}</p>
            </div>
            {onCreateToday ? (
              <button
                type="button"
                onClick={onCreateToday}
                className="h-10 w-full rounded-xl bg-[#121820] px-4 text-sm font-medium text-white shadow-sm transition hover:bg-[#1c2630] sm:w-auto"
              >
                {t('reportCreateToday')}
              </button>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-2.5 rounded-2xl border border-slate-100 bg-white px-3 py-3 shadow-sm sm:grid-cols-2 sm:px-4 sm:py-3.5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <div className="min-w-0">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {t('course')}
              </label>
              <select
                value={courseIdLocal}
                onChange={(e) => setCourseIdLocal(e.target.value)}
                className={`${selectClass} w-full`}
              >
                <option value="">{t('allCourses')}</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {courseDisplayName(c, language)}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-0">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {t('dateFrom')}
              </label>
              <input
                type="date"
                value={fromDateLocal}
                onChange={(e) => setFromDateLocal(e.target.value)}
                className={`${inputClass} w-full`}
              />
            </div>
            <div className="min-w-0 sm:col-span-2 lg:col-span-1">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {t('dateTo')}
              </label>
              <input
                type="date"
                value={toDateLocal}
                onChange={(e) => setToDateLocal(e.target.value)}
                className={`${inputClass} w-full`}
              />
            </div>
          </div>
        </>
      )}

      {plansQuery.isLoading || coursesQuery.isLoading ? (
        <LoadingSpinner message={t('reportListLoading')} />
      ) : plansQuery.isError ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-center text-sm text-red-700">
          {plansQuery.error instanceof ApiError
            ? plansQuery.error.message
            : t('reportListFailed')}
        </div>
      ) : plans.length === 0 ? (
        <EmptyState
          icon={<CalendarDaysIcon className="h-10 w-10 text-slate-300" />}
          title={t('reportListEmpty')}
          description={t('reportListEmptyHint')}
        />
      ) : (
        <ul className="space-y-3">
          {plans.map((plan) => {
            const zoneChips = planZoneChipLabels(plan, language)
            const headcount =
              plan.total_workers ?? plan.attendance?.length ?? 0

            return (
              <li key={plan.id}>
                <div className="group relative flex w-full flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-[var(--shadow-gc-card)] transition hover:border-[#121820]/20 hover:bg-[#f4f5f7] sm:flex-row sm:items-stretch sm:justify-between">
                  <button
                    type="button"
                    onClick={() => openPlan(plan)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-bold tracking-tight text-slate-900 sm:text-[17px]">
                        {formatPlanListTitle(plan, language)}
                      </p>
                      {statusBadge(
                        plan.status,
                        t('statusDraft'),
                        t('statusPublished'),
                      )}
                    </div>
                    <p className="mt-1 truncate text-sm font-medium text-slate-600">
                      {courseNameById.get(plan.course_id) ?? plan.course_id}
                    </p>

                    <div className="mt-2.5 flex flex-wrap gap-x-3.5 gap-y-1 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <CloudIcon className="h-3.5 w-3.5 shrink-0" />
                        {plan.weather}
                        {plan.temperature_max != null
                          ? ` · ${plan.temperature_max}°C`
                          : ''}
                        {plan.rainfall_mm != null
                          ? ` · ${plan.rainfall_mm}mm`
                          : ''}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <UsersIcon className="h-3.5 w-3.5 shrink-0" />
                        {headcount}
                        {t('peopleUnit') ? ` ${t('peopleUnit')}` : ''}
                      </span>
                      {zoneChips.length > 0 ? (
                        <span className="inline-flex items-center gap-1 text-slate-400">
                          {t('reportZonesCount', { count: zoneChips.length })}
                        </span>
                      ) : null}
                    </div>

                    {zoneChips.length > 0 ? (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {zoneChips.map((label) => (
                          <span
                            key={label}
                            className="rounded-md bg-[#121820]/8 px-2 py-0.5 text-[11px] font-semibold text-[#121820]"
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </button>

                  <div className="flex shrink-0 items-center justify-between gap-3 sm:flex-col sm:items-end sm:justify-between">
                    <PlanMediaThumbs planId={plan.id} />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setPendingDelete(plan)
                        }}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-100 bg-red-50 text-red-600 transition hover:bg-red-100"
                        aria-label={t('reportDelete')}
                        title={t('reportDelete')}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                      <span className="hidden text-[11px] font-medium text-slate-400 sm:inline">
                        {t('reportDetail')} →
                      </span>
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {pendingDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/30"
            aria-label="Close"
            onClick={() => setPendingDelete(null)}
          />
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-[var(--shadow-gc-modal)]">
            <h3 className="text-base font-semibold text-slate-900">
              {t('reportDeleteConfirmTitle')}
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              {t('reportDeleteConfirmBody')}
            </p>
            <p className="mt-2 text-xs font-medium text-slate-500">
              {formatPlanDate(pendingDelete.plan_date, language)}
              {' · '}
              {courseNameById.get(pendingDelete.course_id) ??
                pendingDelete.course_id}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPendingDelete(null)}
                disabled={deleteMutation.isPending}
              >
                {t('cancel')}
              </Button>
              <Button
                variant="danger"
                size="sm"
                loading={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(pendingDelete.id)}
              >
                {t('reportDelete')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
