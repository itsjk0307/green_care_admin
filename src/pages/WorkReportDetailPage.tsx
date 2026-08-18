import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeftIcon,
  CloudIcon,
  DocumentTextIcon,
  MapIcon,
  PhotoIcon,
  TrashIcon,
  UserIcon,
  UsersIcon,
} from '@heroicons/react/24/outline'
import { CloudRain, Thermometer } from 'lucide-react'
import toast from 'react-hot-toast'
import { courseDisplayName } from '../lib/courseName'
import { ApiError } from '../api/client'
import { fetchCourses } from '../api/courses'
import {
  listPlanMedia,
  planMediaPreviewUrl,
} from '../services/planMediaService'
import { deletePlan, getPlanDetail, TODAY_DRAFT_PLAN_QUERY_KEY } from '../services/dailyPlanService'
import {
  fertilizerModeLabel,
  formatPlanDate,
  planZoneDisplays,
} from '../lib/workReportDisplay'
import { FUNGICIDE_TARGETS } from '../constants/dailyPlan'
import { useLanguageStore } from '../stores/languageStore'
import type { TranslationKey } from '../i18n/translations'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'

function diseaseDisplayName(
  id: string,
  t: (key: TranslationKey) => string,
): string {
  const found = FUNGICIDE_TARGETS.find((d) => d.id === id)
  if (!found) return id
  return t(found.labelKey)
}

export function WorkReportDetailPage() {
  const { planId = '' } = useParams<{ planId: string }>()
  const navigate = useNavigate()
  const { t, language } = useLanguageStore()
  const queryClient = useQueryClient()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const planQuery = useQuery({
    queryKey: ['daily-plan', planId],
    queryFn: () => getPlanDetail(planId),
    enabled: Boolean(planId),
  })

  const coursesQuery = useQuery({ queryKey: ['courses'], queryFn: fetchCourses })
  const mediaQuery = useQuery({
    queryKey: ['plan-media', planId],
    queryFn: () => listPlanMedia(planId),
    enabled: Boolean(planId),
  })

  const plan = planQuery.data
  const course = coursesQuery.data?.find((c) => c.id === plan?.course_id)
  const courseName = course
    ? courseDisplayName(course, language)
    : (plan?.course_id ?? '')
  const media = mediaQuery.data ?? []
  const zones = useMemo(
    () => (plan ? planZoneDisplays(plan, language) : []),
    [plan, language],
  )

  const deleteReportMutation = useMutation({
    mutationFn: () => deletePlan(planId),
    onSuccess: async () => {
      toast.success(t('reportDeleted'), { className: 'gc-toast-success' })
      await queryClient.invalidateQueries({ queryKey: ['daily-plans-list'] })
      await queryClient.invalidateQueries({ queryKey: [TODAY_DRAFT_PLAN_QUERY_KEY] })
      await queryClient.invalidateQueries({ queryKey: ['daily-plan-today'] })
      await queryClient.invalidateQueries({ queryKey: ['plan-media', planId] })
      navigate('/report-history', { replace: true })
    },
    onError: (err) => {
      toast.error(
        err instanceof ApiError ? err.message : t('reportDeleteFailed'),
        { className: 'gc-toast-error' },
      )
    },
  })

  if (planQuery.isLoading) {
    return <LoadingSpinner message={t('reportListLoading')} />
  }

  if (planQuery.isError || !plan) {
    return (
      <div className="page-enter mx-auto max-w-3xl rounded-2xl border border-red-100 bg-red-50 p-8 text-center">
        <p className="text-sm font-medium text-red-700">
          {planQuery.error instanceof ApiError
            ? planQuery.error.message
            : t('reportListFailed')}
        </p>
        <Link
          to="/report-history"
          className="mt-4 inline-flex h-10 items-center rounded-xl bg-white px-4 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-200"
        >
          {t('reportBackToList')}
        </Link>
      </div>
    )
  }

  const status = plan.status.toLowerCase()
  const headcount = plan.total_workers ?? plan.attendance?.length ?? 0
  const isPublished =
    status === 'published' || status === 'done' || status === 'completed'

  return (
    <div className="page-enter mx-auto max-w-5xl pb-10 sm:px-1">
      <Link
        to="/report-history"
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-800"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        {t('reportBackToList')}
      </Link>

      <article className="overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white shadow-[var(--shadow-gc-elevated)]">
        {/* Card header */}
        <header className="border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white px-5 py-5 sm:px-7 sm:py-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {formatPlanDate(plan.plan_date, language)}
              </h1>
              <Badge variant={isPublished ? 'approved' : 'pending'}>
                {isPublished
                  ? t('statusPublished')
                  : status === 'draft'
                    ? t('statusDraft')
                    : plan.status}
              </Badge>
            </div>
            <p className="mt-1.5 text-sm font-medium text-slate-600">{courseName}</p>
          </div>
        </header>

        <div className="space-y-5 px-5 py-5 sm:space-y-6 sm:px-7 sm:py-6">
          {/* Field conditions */}
          <section className="rounded-2xl border border-slate-200/90 bg-[#f8faf8] p-4 sm:p-5">
            <p className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <CloudIcon className="h-3.5 w-3.5 shrink-0 text-slate-500" />
              {t('reportFieldConditions')}
            </p>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
              <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  <CloudIcon className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                  {t('weatherLabel')}
                </p>
                <p className="mt-1.5 text-sm font-semibold text-slate-800">
                  {plan.weather || '—'}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  <Thermometer
                    className="h-3.5 w-3.5 shrink-0 text-slate-500"
                    strokeWidth={2}
                  />
                  {t('temperature')}
                </p>
                <p className="mt-1.5 text-sm font-semibold text-slate-800">
                  {plan.temperature_max != null
                    ? `${plan.temperature_max}°C`
                    : plan.temperature_min != null
                      ? `${plan.temperature_min}°C`
                      : '—'}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  <CloudRain
                    className="h-3.5 w-3.5 shrink-0 text-slate-500"
                    strokeWidth={2}
                  />
                  {t('rainfall')}
                </p>
                <p className="mt-1.5 text-sm font-semibold text-slate-800">
                  {plan.rainfall_mm != null ? `${plan.rainfall_mm} mm` : '—'}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  <UsersIcon className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                  {t('headcount')}
                </p>
                <p className="mt-1.5 text-sm font-semibold text-slate-800">
                  {headcount}
                  {t('peopleUnit') ? ` ${t('peopleUnit')}` : ''}
                </p>
              </div>
            </div>
          </section>

          {plan.special_notes?.trim() ? (
            <section className="rounded-2xl border border-amber-200/90 bg-amber-50/70 px-4 py-3.5 sm:px-5">
              <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800/80">
                <DocumentTextIcon className="h-3.5 w-3.5 shrink-0" />
                {t('specialNotes')}
              </p>
              <p className="text-sm leading-relaxed text-slate-700">
                {plan.special_notes}
              </p>
            </section>
          ) : null}

          {/* Zones */}
          <section className="rounded-2xl border border-slate-200/90 bg-[#f8faf8] p-4 sm:p-5">
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <MapIcon className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                {t('reportZoneWork')}
              </p>
              {zones.length > 0 ? (
                <p className="text-[11px] font-medium text-slate-400">
                  {t('reportZonesCount', { count: zones.length })}
                </p>
              ) : null}
            </div>

            {zones.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-400">
                {t('reportNoZones')}
              </p>
            ) : (
              <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {zones.map((z) => {
                  const fertLabel = fertilizerModeLabel(z.fertilizerMode, language)
                  return (
                    <li
                      key={z.id}
                      className="overflow-hidden rounded-xl border border-slate-200 border-l-[3px] border-l-[#121820] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
                    >
                      <div className="px-4 py-3.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="text-[15px] font-bold text-slate-900">
                            {z.zoneLabel}
                          </h3>
                          {z.assigneeName ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                              <UserIcon className="h-3.5 w-3.5" />
                              {z.assigneeName}
                            </span>
                          ) : null}
                        </div>

                        {z.taskLabels.length > 0 ? (
                          <div className="mt-2.5 flex flex-wrap gap-1.5">
                            {z.taskLabels.map((label) => (
                              <span
                                key={label}
                                className="rounded-md border border-[#121820]/20 bg-[#121820]/8 px-2 py-0.5 text-[11px] font-semibold text-[#121820]"
                              >
                                {label}
                              </span>
                            ))}
                          </div>
                        ) : null}

                        <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                          {z.mowingHeightMm != null && z.mmLabelKey ? (
                            <span>
                              {t(z.mmLabelKey)}{' '}
                              <strong className="font-semibold text-slate-700">
                                {z.mowingHeightMm} mm
                              </strong>
                            </span>
                          ) : null}
                          {fertLabel ? (
                            <span>
                              {t('taskFertilizing')}{' '}
                              <strong className="font-semibold text-slate-700">
                                {fertLabel}
                              </strong>
                            </span>
                          ) : null}
                        </div>

                        {z.fungicideTargets.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {z.fungicideTargets.map((id) => (
                              <span
                                key={id}
                                className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800"
                              >
                                {diseaseDisplayName(id, t)}
                              </span>
                            ))}
                          </div>
                        ) : null}

                        {z.memo ? (
                          <p className="mt-2.5 border-t border-slate-200 pt-2 text-xs leading-relaxed text-slate-500">
                            <span className="font-semibold text-slate-400">
                              {t('reportMemo')}:{' '}
                            </span>
                            {z.memo}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {/* Photos */}
          <section className="rounded-2xl border border-slate-200/90 bg-[#f8faf8] p-4 sm:p-5">
            <p className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <PhotoIcon className="h-3.5 w-3.5 shrink-0 text-slate-500" />
              {t('reportPhotos')}
            </p>
            {mediaQuery.isLoading ? (
              <LoadingSpinner message={t('mediaLoading')} />
            ) : media.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-5 text-center text-sm text-slate-400">
                {t('mediaEmpty')}
              </p>
            ) : (
              <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                {media.map((m) => {
                  const url = planMediaPreviewUrl(m)
                  return (
                    <li
                      key={m.id}
                      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
                    >
                      <div className="aspect-[4/3] bg-slate-100">
                        {m.media_type === 'video' ? (
                          <video
                            src={url}
                            controls
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <img
                            src={url}
                            alt={m.file_name ?? ''}
                            className="h-full w-full object-cover"
                          />
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>

        <footer className="flex justify-end border-t border-slate-200 bg-slate-50/60 px-5 py-4 sm:px-7">
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 transition hover:text-red-600"
          >
            <TrashIcon className="h-4 w-4" />
            {t('reportDelete')}
          </button>
        </footer>
      </article>

      {confirmDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/35 backdrop-blur-[1px]"
            aria-label={t('cancel')}
            onClick={() => setConfirmDelete(false)}
            disabled={deleteReportMutation.isPending}
          />
          <div
            className="relative w-full max-w-sm rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[var(--shadow-gc-modal)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-delete-title"
          >
            <h3
              id="report-delete-title"
              className="text-base font-semibold text-slate-900"
            >
              {t('reportDeleteConfirmTitle')}
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              {t('reportDeleteConfirmBody')}
            </p>
            <p className="mt-2 text-xs font-medium text-slate-500">
              {formatPlanDate(plan.plan_date, language)}
              {' · '}
              {courseName}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setConfirmDelete(false)}
                disabled={deleteReportMutation.isPending}
              >
                {t('cancel')}
              </Button>
              <Button
                variant="danger"
                size="sm"
                loading={deleteReportMutation.isPending}
                onClick={() => deleteReportMutation.mutate()}
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
