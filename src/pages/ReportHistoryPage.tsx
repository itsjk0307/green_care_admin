import { useQuery } from '@tanstack/react-query'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { DatePicker } from '../components/ui/DatePicker'
import { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchCourses } from '../api/courses'
import { WorkReportList } from '../components/plan/WorkReportList'
import { MapWorkReportsSection } from '../components/plan/MapWorkReportsSection'
import { formatPlanHeader } from '../constants/dailyPlan'
import { courseDisplayName } from '../lib/courseName'
import { formatPlanDate, planZoneChipLabels } from '../lib/workReportDisplay'
import { useCourseScope } from '../hooks/useCourseScope'
import { listDailyPlans } from '../services/dailyPlanService'
import { useLanguageStore } from '../stores/languageStore'
import { useMapReportStore } from '../stores/mapReportStore'

type HistoryTab = 'daily' | 'map'

const selectClass =
  'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-all duration-150 focus:border-[#121820] focus:ring-2 focus:ring-[#121820]/20'

const inputClass =
  'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-all duration-150 focus:border-[#121820] focus:ring-2 focus:ring-[#121820]/20'

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

export function ReportHistoryPage() {
  const navigate = useNavigate()
  const { t, language } = useLanguageStore()
  const { isScoped, lockedCourseId } = useCourseScope()
  const [tab, setTab] = useState<HistoryTab>('daily')
  const [search, setSearch] = useState('')
  const [courseId, setCourseId] = useState('')
  const [fromDate, setFromDate] = useState(() => daysAgoIso(14))
  const [toDate, setToDate] = useState(() => todayIso())

  const mapReports = useMapReportStore((s) => s.reports)
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

  const lockedCourse = useMemo(
    () => courses.find((c) => c.id === lockedCourseId) ?? null,
    [courses, lockedCourseId],
  )

  useEffect(() => {
    if (lockedCourseId) setCourseId(lockedCourseId)
  }, [lockedCourseId])

  const courseNameById = useMemo(() => {
    const map = new Map<string, string>()
    courses.forEach((c) => map.set(c.id, courseDisplayName(c, language)))
    return map
  }, [courses, language])

  const dailyCount = useMemo(() => {
    const list = plansQuery.data ?? []
    const q = search.trim().toLowerCase()
    if (!q) return list.length
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
    }).length
  }, [plansQuery.data, search, courseNameById, language])

  const mapCount = useMemo(() => {
    const q = search.trim().toLowerCase()
    return mapReports.filter((r) => {
      if (courseId && r.courseId !== courseId) return false
      if (fromDate && r.workDate < fromDate) return false
      if (toDate && r.workDate > toDate) return false
      if (!q) return true
      const markText = r.marks
        .map((m) => `${m.title} ${m.titleKo ?? ''} ${m.titleEn ?? ''} ${m.note ?? ''}`)
        .join(' ')
      const hay = `${r.courseName} ${r.workDate} ${markText}`.toLowerCase()
      return hay.includes(q)
    }).length
  }, [mapReports, courseId, fromDate, toDate, search])

  const tabs: { id: HistoryTab; label: string; count?: number }[] = [
    { id: 'daily', label: t('reportHistoryTabDaily'), count: dailyCount },
    { id: 'map', label: t('reportHistoryTabMap'), count: mapCount },
  ]

  return (
    <div className="page-enter mx-auto max-w-6xl space-y-5 pb-6 sm:space-y-6 sm:pb-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            {t('reportHistory')}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {formatPlanHeader(language)}
            <span className="mx-1.5 text-slate-300">·</span>
            {t('reportHistoryHint')}
          </p>
        </div>
        {tab === 'daily' ? (
          <button
            type="button"
            onClick={() => navigate('/daily-plans')}
            className="h-10 w-full rounded-xl bg-[#121820] px-4 text-sm font-medium text-white shadow-sm transition hover:bg-[#1c2630] sm:w-auto"
          >
            {t('reportCreateToday')}
          </button>
        ) : null}
      </div>

      <div className="flex gap-1 rounded-xl bg-slate-100/90 p-1">
        {tabs.map((item) => {
          const active = tab === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`relative flex h-10 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition ${
                active
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {item.label}
              {item.count != null ? (
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${
                    active
                      ? 'bg-[#121820]/10 text-[#121820]'
                      : 'bg-slate-200/80 text-slate-500'
                  }`}
                >
                  {item.count}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-2.5 rounded-2xl border border-slate-100 bg-white px-3 py-3 shadow-sm sm:grid-cols-2 sm:px-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0 sm:col-span-2 lg:col-span-1">
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {t('reportHistorySearch')}
          </label>
          <div className="relative">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('reportHistorySearchPh')}
              className={`${inputClass} pl-9`}
            />
          </div>
        </div>
        <div className="min-w-0">
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {t('course')}
          </label>
          {isScoped && lockedCourse ? (
            <div className={`${selectClass} flex items-center bg-slate-50 font-semibold text-slate-800`}>
              {courseDisplayName(lockedCourse, language)}
            </div>
          ) : (
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className={selectClass}
            >
              <option value="">{t('allCourses')}</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {courseDisplayName(c, language)}
                </option>
              ))}
            </select>
          )}
        </div>
        <DatePicker value={fromDate} onChange={setFromDate} label={t('dateFrom')} />
        <DatePicker value={toDate} onChange={setToDate} label={t('dateTo')} />
      </div>

      {tab === 'daily' ? (
        <WorkReportList
          embedded
          courseId={courseId}
          fromDate={fromDate}
          toDate={toDate}
          searchQuery={search}
        />
      ) : (
        <MapWorkReportsSection
          embedded
          courseId={courseId}
          fromDate={fromDate}
          toDate={toDate}
          searchQuery={search}
        />
      )}
    </div>
  )
}
