import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  MinusIcon,
  PlusIcon,
  TrashIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'
import {
  createCourseWorker,
  deleteCourseWorker,
  getWorkerDay,
  listCourseWorkers,
  upsertWorkerDay,
  type CourseWorker,
  type CourseWorkerType,
} from '../api/workers'
import { fetchCourses } from '../api/courses'
import { ApiError } from '../api/client'
import { Button } from '../components/ui/Button'
import { DatePicker } from '../components/ui/DatePicker'
import { EmptyState } from '../components/ui/EmptyState'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { todayLocalDate } from '../constants/dailyPlan'
import { useCourseScope } from '../hooks/useCourseScope'
import { courseDisplayName } from '../lib/courseName'
import { useLanguageStore } from '../stores/languageStore'

const COURSE_STORAGE_KEY = 'greencare-workers-course-id'

const inputClass =
  'h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-900 outline-none transition focus:border-[#121820] focus:ring-2 focus:ring-[#121820]/15'

function toTimeInput(value: string | null | undefined): string {
  if (!value) return ''
  return value.slice(0, 5)
}

function fromTimeInput(value: string): string | null {
  const v = value.trim()
  return v ? `${v}:00`.slice(0, 8) : null
}

function formatShift(start: string, end: string, emptyLabel: string): string {
  if (!start && !end) return emptyLabel
  if (start && end) return `${start}–${end}`
  return start || end
}

export function WorkersPage() {
  const { t, language } = useLanguageStore()
  const { isScoped, lockedCourseId } = useCourseScope()
  const queryClient = useQueryClient()

  const [courseId, setCourseId] = useState(
    () => lockedCourseId || localStorage.getItem(COURSE_STORAGE_KEY) || '',
  )
  const [workDate, setWorkDate] = useState(() => todayLocalDate())
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<CourseWorkerType>('regular')
  const [tempCount, setTempCount] = useState('0')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [presentIds, setPresentIds] = useState<Set<string>>(new Set())
  const [dirty, setDirty] = useState(false)

  const coursesQuery = useQuery({ queryKey: ['courses'], queryFn: fetchCourses })
  const courses = coursesQuery.data ?? []

  useEffect(() => {
    if (lockedCourseId) setCourseId(lockedCourseId)
  }, [lockedCourseId])

  useEffect(() => {
    if (courseId && !lockedCourseId) {
      localStorage.setItem(COURSE_STORAGE_KEY, courseId)
    }
  }, [courseId, lockedCourseId])

  useEffect(() => {
    if (!courseId && courses.length === 1) setCourseId(courses[0].id)
  }, [courseId, courses])

  const workersQuery = useQuery({
    queryKey: ['course-workers', courseId],
    queryFn: () => listCourseWorkers({ course_id: courseId }),
    enabled: Boolean(courseId),
  })

  const dayQuery = useQuery({
    queryKey: ['course-worker-day', courseId, workDate],
    queryFn: () => getWorkerDay(workDate, courseId),
    enabled: Boolean(courseId && workDate),
  })

  const workers = workersQuery.data?.workers ?? []

  useEffect(() => {
    const day = dayQuery.data
    if (!day || dirty) return
    setTempCount(String(day.temp_worker_count ?? 0))
    setStartTime(toTimeInput(day.start_time))
    setEndTime(toTimeInput(day.end_time))
    setPresentIds(new Set(day.present_worker_ids ?? []))
  }, [dayQuery.data, dirty])

  useEffect(() => {
    setDirty(false)
  }, [courseId, workDate])

  const namedPresent = presentIds.size
  const tempNum = Math.max(0, Number(tempCount) || 0)
  const total = namedPresent + tempNum
  const shiftText = formatShift(startTime, endTime, t('workersNoShift'))

  const selectedCourse = courses.find((c) => c.id === courseId)

  const createMutation = useMutation({
    mutationFn: () =>
      createCourseWorker({
        course_id: courseId,
        name: newName.trim(),
        worker_type: newType,
      }),
    onSuccess: async (created) => {
      setNewName('')
      // Newly added roster workers show as present for this day by default
      setPresentIds((prev) => new Set(prev).add(created.id))
      setDirty(true)
      toast.success(t('workersAdded'), { className: 'gc-toast-success' })
      await queryClient.invalidateQueries({ queryKey: ['course-workers', courseId] })
    },
    onError: (err) => {
      toast.error(
        err instanceof ApiError ? err.message : t('workersSaveFailed'),
        { className: 'gc-toast-error' },
      )
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCourseWorker(id),
    onSuccess: async (_data, id) => {
      setPresentIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      setDirty(true)
      toast.success(t('workersRemoved'), { className: 'gc-toast-success' })
      await queryClient.invalidateQueries({ queryKey: ['course-workers', courseId] })
    },
    onError: (err) => {
      toast.error(
        err instanceof ApiError ? err.message : t('workersSaveFailed'),
        { className: 'gc-toast-error' },
      )
    },
  })

  const saveDayMutation = useMutation({
    mutationFn: () =>
      upsertWorkerDay(workDate, {
        course_id: courseId,
        temp_worker_count: tempNum,
        start_time: fromTimeInput(startTime),
        end_time: fromTimeInput(endTime),
        present_worker_ids: [...presentIds],
      }),
    onSuccess: async (data) => {
      setDirty(false)
      queryClient.setQueryData(['course-worker-day', courseId, workDate], data)
      await queryClient.invalidateQueries({ queryKey: ['worker-hub'] })
      toast.success(t('workersDaySaved'), { className: 'gc-toast-success' })
    },
    onError: (err) => {
      toast.error(
        err instanceof ApiError ? err.message : t('workersSaveFailed'),
        { className: 'gc-toast-error' },
      )
    },
  })

  function handleAddWorker(e: FormEvent) {
    e.preventDefault()
    if (!courseId) {
      toast.error(t('workersSelectCourseFirst'), { className: 'gc-toast-error' })
      return
    }
    if (!newName.trim()) {
      toast.error(t('workersNameRequired'), { className: 'gc-toast-error' })
      return
    }
    createMutation.mutate()
  }

  function togglePresent(id: string) {
    setDirty(true)
    setPresentIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function bumpTemp(delta: number) {
    setDirty(true)
    setTempCount(String(Math.max(0, tempNum + delta)))
  }

  const regularWorkers = useMemo(
    () => workers.filter((w) => w.worker_type === 'regular'),
    [workers],
  )
  const contractWorkers = useMemo(
    () => workers.filter((w) => w.worker_type === 'contract'),
    [workers],
  )

  if (coursesQuery.isLoading) {
    return <LoadingSpinner message={t('loadingCourses')} />
  }

  return (
    <div className="page-enter mx-auto max-w-3xl space-y-3 pb-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            {t('workers')}
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">{t('workersHint')}</p>
        </div>
        <div className="grid w-full grid-cols-1 gap-2 sm:max-w-sm sm:grid-cols-2">
          <div className="min-w-0">
            <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              {t('course')}
            </label>
            {isScoped && selectedCourse ? (
              <div
                className={`${inputClass} flex items-center bg-slate-50 font-semibold text-slate-800`}
              >
                {courseDisplayName(selectedCourse, language)}
              </div>
            ) : (
              <select
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                className={inputClass}
              >
                <option value="" disabled>
                  {t('selectCourse')}
                </option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {courseDisplayName(c, language)}
                  </option>
                ))}
              </select>
            )}
          </div>
          <DatePicker value={workDate} onChange={setWorkDate} label={t('workersWorkDate')} />
        </div>
      </div>

      {!courseId ? (
        <EmptyState
          icon={<UserGroupIcon className="h-10 w-10 text-slate-300" />}
          title={t('workersSelectCourseFirst')}
          description={t('workersSelectCourseHint')}
        />
      ) : (
        <>
          {/* Compact day bar: daily count + shift + totals + save */}
          <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-md bg-slate-100 px-2 py-1 font-semibold tabular-nums text-slate-800">
                  {t('workersNamedPresent')} {namedPresent}
                </span>
                <span className="rounded-md bg-slate-100 px-2 py-1 font-semibold tabular-nums text-slate-800">
                  {t('workersTempCount')} {tempNum}
                </span>
                <span className="rounded-md bg-[#121820] px-2 py-1 font-semibold tabular-nums text-white">
                  {t('workersTotal')} {total}
                </span>
              </div>
              <Button
                type="button"
                size="sm"
                loading={saveDayMutation.isPending}
                disabled={saveDayMutation.isPending}
                onClick={() => saveDayMutation.mutate()}
              >
                {t('workersSaveDay')}
                {dirty ? ' *' : ''}
              </Button>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1.2fr_1fr_1fr]">
              <div>
                <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  {t('workersDailyOnly')}
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => bumpTemp(-1)}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                    aria-label="−"
                  >
                    <MinusIcon className="h-4 w-4" />
                  </button>
                  <input
                    type="number"
                    min={0}
                    value={tempCount}
                    onChange={(e) => {
                      setDirty(true)
                      setTempCount(e.target.value)
                    }}
                    className={`${inputClass} text-center font-semibold tabular-nums`}
                  />
                  <button
                    type="button"
                    onClick={() => bumpTemp(1)}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                    aria-label="+"
                  >
                    <PlusIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  {t('workersStartTime')}
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => {
                    setDirty(true)
                    setStartTime(e.target.value)
                  }}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  {t('workersEndTime')}
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => {
                    setDirty(true)
                    setEndTime(e.target.value)
                  }}
                  className={inputClass}
                />
              </div>
            </div>
          </section>

          {/* Roster: add + compact list with shift times */}
          <section className="rounded-xl border border-slate-100 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-2 border-b border-slate-50 px-3 py-2">
              <h2 className="text-sm font-semibold text-slate-900">
                {t('workersRosterTitle')}
              </h2>
              <span className="text-[11px] text-slate-400">
                {t('workersShiftLabel')}: {shiftText}
              </span>
            </div>

            <form
              onSubmit={handleAddWorker}
              className="grid grid-cols-[minmax(0,1fr)_7.5rem_auto] gap-1.5 border-b border-slate-50 px-3 py-2"
            >
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className={inputClass}
                placeholder={t('workersNamePh')}
                aria-label={t('workersName')}
              />
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as CourseWorkerType)}
                className={inputClass}
                aria-label={t('workersType')}
              >
                <option value="regular">{t('workersTypeRegular')}</option>
                <option value="contract">{t('workersTypeContract')}</option>
              </select>
              <Button
                type="submit"
                size="sm"
                loading={createMutation.isPending}
                icon={<PlusIcon className="h-4 w-4" />}
              >
                {t('workersAddBtn')}
              </Button>
            </form>

            {workersQuery.isLoading || dayQuery.isLoading ? (
              <div className="px-3 py-6">
                <LoadingSpinner message={t('workersLoading')} />
              </div>
            ) : workers.length === 0 ? (
              <div className="px-3 py-6">
                <EmptyState
                  icon={<UserGroupIcon className="h-8 w-8 text-slate-300" />}
                  title={t('workersEmpty')}
                  description={t('workersEmptyHint')}
                />
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {(
                  [
                    { title: t('workersTypeRegular'), list: regularWorkers },
                    { title: t('workersTypeContract'), list: contractWorkers },
                  ] as { title: string; list: CourseWorker[] }[]
                ).map((group) =>
                  group.list.length === 0 ? null : (
                    <div key={group.title}>
                      <p className="bg-slate-50/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        {group.title} · {group.list.length}
                      </p>
                      <ul>
                        {group.list.map((w) => {
                          const on = presentIds.has(w.id)
                          return (
                            <li
                              key={w.id}
                              className={`flex items-center gap-2 px-3 py-1.5 ${
                                on ? 'bg-[#121820]/[0.03]' : ''
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => togglePresent(w.id)}
                                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[11px] font-bold transition ${
                                  on
                                    ? 'border-[#121820] bg-[#121820] text-white'
                                    : 'border-slate-300 bg-white text-transparent'
                                }`}
                                aria-pressed={on}
                                title={t('workersMarkPresent')}
                              >
                                ✓
                              </button>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[13px] font-medium text-slate-900">
                                  {w.name}
                                </p>
                              </div>
                              <span
                                className={`shrink-0 text-[11px] tabular-nums ${
                                  on
                                    ? 'font-medium text-[#121820]'
                                    : 'text-slate-300'
                                }`}
                                title={t('workersShiftLabel')}
                              >
                                {on ? shiftText : t('workersAbsent')}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  if (!window.confirm(t('workersRemoveConfirm')))
                                    return
                                  deleteMutation.mutate(w.id)
                                }}
                                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-red-400 hover:bg-red-50 hover:text-red-500"
                                aria-label={t('workersRemove')}
                                title={t('workersRemove')}
                              >
                                <TrashIcon className="h-3.5 w-3.5" />
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  ),
                )}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
