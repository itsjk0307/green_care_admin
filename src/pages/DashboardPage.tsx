import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  ArchiveBoxIcon,
  ArrowRightIcon,
  CalendarDaysIcon,
  ClipboardDocumentCheckIcon,
  ClipboardDocumentListIcon,
  ClockIcon,
  CloudIcon,
  ExclamationTriangleIcon,
  MapIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'
import type { ComponentType, SVGProps } from 'react'
import { useEffect } from 'react'
import { fetchCourses } from '../api/courses'
import { getWorkerHub } from '../api/workers'
import { Badge } from '../components/ui/Badge'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { EmptyState } from '../components/ui/EmptyState'
import { formatPlanHeader, todayLocalDate } from '../constants/dailyPlan'
import { courseDisplayName } from '../lib/courseName'
import { listDailyPlans } from '../services/dailyPlanService'
import { isLowStock, useInventoryStore } from '../stores/inventoryStore'
import { useLanguageStore } from '../stores/languageStore'
import { useMapReportStore } from '../stores/mapReportStore'
import type { Language } from '../i18n/translations'

type HeroIcon = ComponentType<SVGProps<SVGSVGElement> & { title?: string }>

function daysAgoIso(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function isDraft(status: string) {
  const s = status.toLowerCase()
  return s === 'draft' || s === 'pending'
}

function isPublished(status: string) {
  const s = status.toLowerCase()
  return s === 'published' || s === 'done' || s === 'completed'
}

function relativeDayLabel(planDate: string, language: Language, today: string) {
  if (planDate === today) {
    return language === 'en' ? 'Today' : '오늘'
  }
  const a = new Date(`${planDate}T12:00:00`)
  const b = new Date(`${today}T12:00:00`)
  const diff = Math.round((b.getTime() - a.getTime()) / 86_400_000)
  if (diff === 1) return language === 'en' ? 'Yesterday' : '어제'
  if (diff > 1 && diff < 14) {
    return language === 'en' ? `${diff}d ago` : `${diff}일 전`
  }
  return planDate
}

function StatCard({
  label,
  value,
  hint,
  accentBar,
  iconBg,
  iconColor,
  Icon,
}: {
  label: string
  value: number | string
  hint: string
  accentBar: string
  iconBg: string
  iconColor: string
  Icon: HeroIcon
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#e2e6ea] bg-white p-4 shadow-[var(--shadow-gc-card)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-gc-elevated)] sm:p-5">
      <div className={`absolute left-0 top-0 h-full w-1 ${accentBar}`} />
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          {label}
        </p>
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:h-10 sm:w-10 ${iconBg} ring-1 ring-black/[0.03]`}
        >
          <Icon className={`h-[18px] w-[18px] ${iconColor}`} />
        </div>
      </div>
      <p className="mt-3 text-[28px] font-semibold leading-none tracking-tight text-slate-900 sm:text-[32px]">
        {value}
      </p>
      <p className="mt-2.5 text-xs text-slate-400">{hint}</p>
    </div>
  )
}

function PlanStatusBadge({ status }: { status: string }) {
  const { t } = useLanguageStore()
  if (isPublished(status)) {
    return <Badge variant="approved">{t('statusPublished')}</Badge>
  }
  if (isDraft(status)) {
    return <Badge variant="pending">{t('statusDraft')}</Badge>
  }
  return <Badge variant="info">{status}</Badge>
}

export function DashboardPage() {
  const { t, language } = useLanguageStore()
  const today = todayLocalDate()
  const fromDate = daysAgoIso(30)
  const inventoryItems = useInventoryStore((s) => s.items)
  const mapReports = useMapReportStore((s) => s.reports)
  const fetchMapReports = useMapReportStore((s) => s.fetchReports)

  const coursesQuery = useQuery({ queryKey: ['courses'], queryFn: fetchCourses })
  const plansQuery = useQuery({
    queryKey: ['dashboard-plans', fromDate, today],
    queryFn: () => listDailyPlans({ from_date: fromDate, to_date: today }),
  })
  const workerHubQuery = useQuery({
    queryKey: ['worker-hub', today],
    queryFn: () => getWorkerHub(today),
  })

  const courses = coursesQuery.data ?? []
  const plans = plansQuery.data ?? []
  const workerHub = workerHubQuery.data

  const courseNameById = new Map(
    courses.map((c) => [c.id, courseDisplayName(c, language)]),
  )

  useEffect(() => {
    if (!courses.length) return
    void fetchMapReports(undefined, (id) => {
      const course = courses.find((c) => c.id === id)
      return course ? courseDisplayName(course, language) : id
    }).catch(() => {
      /* keep local cache */
    })
  }, [courses, fetchMapReports, language])

  const mapCountLast30 = mapReports.filter(
    (r) => r.workDate >= fromDate && r.workDate <= today,
  ).length
  const dailyCount = plans.length
  const reportsTotal = dailyCount + mapCountLast30

  const lowStockItems = inventoryItems.filter(isLowStock)
  const inventoryTotal = inventoryItems.length
  const lowStockPreview = [...lowStockItems]
    .sort((a, b) => a.quantity - b.quantity)
    .slice(0, 6)

  const sortedPlans = [...plans].sort((a, b) => {
    if (a.plan_date !== b.plan_date) {
      return a.plan_date < b.plan_date ? 1 : -1
    }
    return (a.updated_at ?? '') < (b.updated_at ?? '') ? 1 : -1
  })

  const recentPlans = sortedPlans.slice(0, 6)
  const draftCount = plans.filter((p) => isDraft(p.status)).length
  const loading = plansQuery.isLoading || coursesQuery.isLoading
  const failed = plansQuery.isError

  return (
    <div className="page-enter mx-auto flex max-w-[1440px] flex-col gap-4 sm:gap-5">
      {/* Header + quick actions */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            {t('dashboardGreeting')}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {formatPlanHeader(language)}
            <span className="mx-1.5 text-slate-300">·</span>
            {t('dashboardHint')}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap xl:grid-cols-4">
          <Link
            to="/daily-plans"
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#121820] px-4 text-sm font-medium text-white shadow-sm transition hover:bg-[#1c2630]"
          >
            <ClipboardDocumentListIcon className="h-4 w-4" />
            {t('quickWriteReport')}
          </Link>
          <Link
            to="/report-history"
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <ClockIcon className="h-4 w-4" />
            {t('quickReportHistory')}
          </Link>
          <Link
            to="/inventory"
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <ArchiveBoxIcon className="h-4 w-4" />
            {t('quickInventory')}
          </Link>
          <Link
            to="/course-map"
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <MapIcon className="h-4 w-4" />
            {t('courseMap')}
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
        <div className="relative overflow-hidden rounded-2xl border border-[#e2e6ea] bg-white p-4 shadow-[var(--shadow-gc-card)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-gc-elevated)] sm:p-5">
          <div className="absolute left-0 top-0 h-full w-1 bg-[#121820]" />
          <div className="flex items-start justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              {t('totalReports')}
            </p>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f4f5f7] ring-1 ring-black/[0.03] sm:h-10 sm:w-10">
              <ClipboardDocumentCheckIcon className="h-[18px] w-[18px] text-[#121820]" />
            </div>
          </div>
          <p className="mt-3 text-[28px] font-semibold leading-none tracking-tight text-slate-900 sm:text-[32px]">
            {loading ? '—' : reportsTotal}
          </p>
          <p className="mt-2.5 text-xs text-slate-400">{t('last30Days')}</p>
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
            <div className="min-w-0 rounded-xl bg-[#f4f5f7] px-3 py-2.5">
              <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {t('reportHistoryTabDaily')}
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
                {loading ? '—' : dailyCount}
              </p>
            </div>
            <div className="min-w-0 rounded-xl bg-[#f4f5f7] px-3 py-2.5">
              <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {t('reportHistoryTabMap')}
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
                {mapCountLast30}
              </p>
            </div>
          </div>
        </div>
        <StatCard
          label={t('pendingApproval')}
          value={loading ? '—' : draftCount}
          hint={t('statusDraft')}
          accentBar="bg-amber-400"
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
          Icon={ClipboardDocumentListIcon}
        />
        <StatCard
          label={t('dashboardLowStockStat')}
          value={lowStockItems.length}
          hint={t('dashboardTotalStockStat') + `: ${inventoryTotal}`}
          accentBar={lowStockItems.length > 0 ? 'bg-amber-500' : 'bg-[#2a3441]'}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
          Icon={ArchiveBoxIcon}
        />
      </div>

      {/* Worker hub */}
      <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900">
              {t('workersHubTitle')}
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">{t('workersHubHint')}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden rounded-xl bg-[#121820] px-3 py-1.5 text-center text-white sm:block">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-white/60">
                {t('workersTotal')}
              </p>
              <p className="text-base font-semibold tabular-nums leading-tight">
                {workerHubQuery.isLoading ? '—' : (workerHub?.grand_total ?? 0)}
              </p>
            </div>
            <Link
              to="/workers"
              className="flex shrink-0 items-center gap-1 text-xs font-medium text-[#121820] transition-colors hover:text-[#1c2630]"
            >
              {t('workersHubOpen')}
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        <div className="border-t border-slate-100 px-4 py-4 sm:px-6">
          {workerHubQuery.isLoading ? (
            <LoadingSpinner message={t('workersLoading')} />
          ) : !workerHub || workerHub.courses.length === 0 ? (
            <EmptyState
              icon={<UserGroupIcon className="h-10 w-10 text-slate-300" />}
              title={t('workersHubEmpty')}
              description={t('workersEmptyHint')}
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {workerHub.courses.map((row) => {
                const name =
                  language === 'ko' ? row.course_name_ko || row.course_name : row.course_name
                const shift =
                  row.start_time || row.end_time
                    ? `${(row.start_time ?? '—').slice(0, 5)} – ${(row.end_time ?? '—').slice(0, 5)}`
                    : null
                return (
                  <li
                    key={row.course_id}
                    className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f4f5f7] text-[#121820]">
                      <UserGroupIcon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {name}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {t('workersHubNamed')} {row.named_present_count}
                        <span className="mx-1.5 text-slate-300">·</span>
                        {t('workersHubTemp')} {row.temp_worker_count}
                        {shift ? (
                          <>
                            <span className="mx-1.5 text-slate-300">·</span>
                            {t('workersHubShift')} {shift}
                          </>
                        ) : null}
                      </p>
                    </div>
                    <span className="rounded-full bg-[#f4f5f7] px-2.5 py-1 text-sm font-semibold tabular-nums text-[#121820]">
                      {row.total_workers}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </section>

      {/* Recent reports */}
      <section className="flex min-h-[280px] flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900">
              {t('recentWorkReports')}
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">{t('recentSubmitted')}</p>
          </div>
          <Link
            to="/report-history"
            className="flex shrink-0 items-center gap-1 text-xs font-medium text-[#121820] transition-colors hover:text-[#1c2630]"
          >
            {t('viewAll')}
            <ArrowRightIcon className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-3 sm:px-3 sm:pb-4">
          {loading ? (
            <LoadingSpinner message={t('reportListLoading')} />
          ) : failed ? (
            <div className="mx-2 rounded-xl border border-red-100 bg-red-50 px-4 py-6 text-center text-sm text-red-700 sm:mx-3">
              {t('dashboardLoadFailed')}
            </div>
          ) : recentPlans.length === 0 ? (
            <EmptyState
              icon={<CalendarDaysIcon className="h-10 w-10 text-slate-300" />}
              title={t('noRecentReports')}
              description={t('noRecentReportsHint')}
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentPlans.map((plan, i) => (
                <li key={plan.id}>
                  <Link
                    to="/report-history"
                    className={`flex items-center gap-3 rounded-xl px-2 py-3.5 transition-colors hover:bg-[#f4f5f7] sm:px-3 ${
                      i % 2 === 1 ? 'bg-slate-50/40' : ''
                    }`}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#121820] text-[11px] font-bold text-white">
                      {(courseNameById.get(plan.course_id) ?? '?')
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {courseNameById.get(plan.course_id) ?? plan.course_id}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDaysIcon className="h-3.5 w-3.5" />
                          {plan.plan_date}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <CloudIcon className="h-3.5 w-3.5" />
                          {plan.weather}
                          {plan.temperature_max != null
                            ? ` · ${plan.temperature_max}°C`
                            : ''}
                        </span>
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <PlanStatusBadge status={plan.status} />
                      <span className="text-[11px] text-slate-400">
                        {relativeDayLabel(plan.plan_date, language, today)}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Inventory */}
      <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900">
              {t('dashboardInventory')}
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              {t('dashboardInventoryHint')}
            </p>
          </div>
          <Link
            to="/inventory"
            className="flex shrink-0 items-center gap-1 text-xs font-medium text-[#121820] transition-colors hover:text-[#1c2630]"
          >
            {t('dashboardInventoryAll')}
            <ArrowRightIcon className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="border-t border-slate-100 px-4 py-4 sm:px-6">
          {inventoryTotal === 0 ? (
            <EmptyState
              icon={<ArchiveBoxIcon className="h-10 w-10 text-slate-300" />}
              title={t('dashboardInventoryEmpty')}
              description={t('dashboardInventoryEmptyHint')}
            />
          ) : lowStockPreview.length === 0 ? (
            <div className="flex items-center gap-3 rounded-xl bg-[#f4f5f7] px-4 py-3 text-sm text-[#121820]">
              <ArchiveBoxIcon className="h-5 w-5 shrink-0" />
              <p>
                {t('dashboardInventoryOk')}
                <span className="ml-1 text-slate-500">
                  · {t('inventoryCount', { count: inventoryTotal })}
                </span>
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {lowStockPreview.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                    <ExclamationTriangleIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {item.name}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-400">
                      {item.courseId
                        ? (courseNameById.get(item.courseId) ?? item.courseId)
                        : '—'}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                      {item.quantity} {item.unit}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {t('inventoryAlertWhen', {
                        n: item.lowThreshold,
                        unit: item.unit,
                      })}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}
