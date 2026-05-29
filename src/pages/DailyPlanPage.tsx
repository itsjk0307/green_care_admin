import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { PlusIcon } from '@heroicons/react/24/outline'
import { fetchCourses } from '../api/courses'
import { ApiError } from '../api/client'
import { PlanStatusBoard } from '../components/plan/PlanStatusBoard'
import { WorkerAttendanceSection } from '../components/plan/WorkerAttendanceSection'
import { ZoneTaskRow } from '../components/plan/ZoneTaskRow'
import { Button } from '../components/ui/Button'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import {
  WEATHER_OPTIONS,
  createEmptyZoneTask,
  formatKoreanPlanHeader,
  todayLocalDate,
  type TaskKey,
  type ZoneKey,
  type ZoneTaskForm,
} from '../constants/dailyPlan'
import {
  addZoneTask,
  createPlan,
  getTodayPlanOrNull,
  getWorkers,
  publishPlan,
} from '../services/dailyPlanService'
import type { DailyZoneTask } from '../types/api'

const COURSE_STORAGE_KEY = 'greencare-daily-plan-course-id'

const inputClass =
  'h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-all duration-150 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'

const labelClass = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400'

function mapZoneTaskFromApi(task: DailyZoneTask): ZoneTaskForm {
  return {
    clientId: task.id,
    serverId: task.id,
    zone: task.zone as ZoneKey,
    task_types: task.task_types as TaskKey[],
    mowing_height_mm:
      task.mowing_height_mm != null ? String(task.mowing_height_mm) : '',
    assigned_worker_ids: task.assigned_worker_ids,
    notes: task.notes ?? '',
  }
}

function isZoneTaskValid(task: ZoneTaskForm): boolean {
  return Boolean(task.zone) && task.task_types.length > 0
}

export function DailyPlanPage() {
  const queryClient = useQueryClient()
  const [courseId, setCourseId] = useState(
    () => localStorage.getItem(COURSE_STORAGE_KEY) ?? '',
  )
  const [planId, setPlanId] = useState<string | null>(null)
  const [weather, setWeather] = useState('맑음')
  const [tempMin, setTempMin] = useState('')
  const [tempMax, setTempMax] = useState('')
  const [rainfall, setRainfall] = useState('')
  const [specialNotes, setSpecialNotes] = useState('')
  const [zoneTasks, setZoneTasks] = useState<ZoneTaskForm[]>([])

  const coursesQuery = useQuery({ queryKey: ['courses'], queryFn: fetchCourses })
  const workersQuery = useQuery({
    queryKey: ['workers', courseId],
    queryFn: () => getWorkers(courseId),
    enabled: Boolean(courseId),
  })
  const todayPlanQuery = useQuery({
    queryKey: ['daily-plan-today', courseId],
    queryFn: () => getTodayPlanOrNull(courseId),
    enabled: Boolean(courseId),
  })

  const courses = coursesQuery.data ?? []
  const workers = workersQuery.data ?? []
  const selectedCourse = courses.find((c) => c.id === courseId)

  useEffect(() => {
    if (!courses.length) return
    if (!courseId || !courses.some((c) => c.id === courseId)) {
      const active = courses.find((c) => c.is_active) ?? courses[0]
      setCourseId(active.id)
    }
  }, [courses, courseId])

  useEffect(() => {
    if (coursesQuery.isError) {
      const message =
        coursesQuery.error instanceof ApiError
          ? coursesQuery.error.message
          : '골프장 목록을 불러오지 못했습니다.'
      toast.error(message, { className: 'gc-toast-error' })
    }
  }, [coursesQuery.isError, coursesQuery.error])

  useEffect(() => {
    if (courseId) localStorage.setItem(COURSE_STORAGE_KEY, courseId)
  }, [courseId])

  const hydrateFromPlan = useCallback(
    (plan: NonNullable<Awaited<ReturnType<typeof getTodayPlanOrNull>>>) => {
      setPlanId(plan.id)
      setWeather(plan.weather)
      setTempMin(plan.temperature_min != null ? String(plan.temperature_min) : '')
      setTempMax(plan.temperature_max != null ? String(plan.temperature_max) : '')
      setRainfall(plan.rainfall_mm != null ? String(plan.rainfall_mm) : '')
      setSpecialNotes(plan.special_notes ?? '')
      setZoneTasks(plan.zone_tasks.length > 0 ? plan.zone_tasks.map(mapZoneTaskFromApi) : [])
    },
    [],
  )

  useEffect(() => {
    if (todayPlanQuery.data) {
      hydrateFromPlan(todayPlanQuery.data)
    } else if (todayPlanQuery.data === null && !todayPlanQuery.isLoading) {
      setPlanId(null)
      setWeather('맑음')
      setTempMin('')
      setTempMax('')
      setRainfall('')
      setSpecialNotes('')
      setZoneTasks([])
    }
  }, [todayPlanQuery.data, todayPlanQuery.isLoading, hydrateFromPlan])

  const attendanceInitial = useMemo(() => {
    const rows = todayPlanQuery.data?.attendance ?? []
    return rows.map((r) => ({
      worker_id: r.worker_id,
      status: r.status,
      start_time: r.start_time ?? '08:00',
      end_time: r.end_time ?? '19:00',
      working_hours: r.working_hours,
    }))
  }, [todayPlanQuery.data?.attendance])

  const validZoneTasks = zoneTasks.filter(isZoneTaskValid)
  const canPublish = validZoneTasks.length > 0

  async function ensurePlan(): Promise<string> {
    if (planId) return planId
    if (!courseId || !selectedCourse) {
      throw new ApiError('골프장을 선택하세요.', 400)
    }
    const plan = await createPlan({
      course_id: courseId,
      plan_date: todayLocalDate(),
      weather,
      temperature_min: tempMin ? Number(tempMin) : null,
      temperature_max: tempMax ? Number(tempMax) : null,
      rainfall_mm: rainfall ? Number(rainfall) : null,
      special_notes: specialNotes.trim() || null,
    })
    setPlanId(plan.id)
    return plan.id
  }

  async function syncZoneTasks(id: string) {
    const unsaved = zoneTasks.filter((z) => isZoneTaskValid(z) && !z.serverId)
    for (const task of unsaved) {
      await addZoneTask(id, {
        zone: task.zone,
        task_types: task.task_types,
        mowing_height_mm:
          task.task_types.includes('mowing') && task.mowing_height_mm
            ? Number(task.mowing_height_mm)
            : null,
        assigned_worker_ids: task.assigned_worker_ids,
        notes: task.notes.trim() || null,
      })
    }
  }

  const draftMutation = useMutation({
    mutationFn: async () => {
      const id = await ensurePlan()
      await syncZoneTasks(id)
    },
    onSuccess: async () => {
      toast.success('임시저장되었습니다.', { className: 'gc-toast-success' })
      await queryClient.invalidateQueries({ queryKey: ['daily-plan-today', courseId] })
      await queryClient.invalidateQueries({ queryKey: ['daily-plan', planId] })
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : '저장에 실패했습니다.', {
        className: 'gc-toast-error',
      })
    },
  })

  const publishMutation = useMutation({
    mutationFn: async () => {
      const id = await ensurePlan()
      await syncZoneTasks(id)
      return publishPlan(id)
    },
    onSuccess: async () => {
      toast.success('계획이 발행되었습니다.', { className: 'gc-toast-success' })
      await queryClient.invalidateQueries({ queryKey: ['daily-plan-today', courseId] })
      await queryClient.invalidateQueries({ queryKey: ['daily-plan'] })
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : '발행에 실패했습니다.', {
        className: 'gc-toast-error',
      })
    },
  })

  function updateZoneTask(clientId: string, patch: Partial<ZoneTaskForm>) {
    setZoneTasks((prev) =>
      prev.map((z) => (z.clientId === clientId ? { ...z, ...patch } : z)),
    )
  }

  function deleteZoneTask(clientId: string) {
    setZoneTasks((prev) => prev.filter((z) => z.clientId !== clientId))
  }

  function addZone() {
    setZoneTasks((prev) => [...prev, createEmptyZoneTask()])
  }

  if (coursesQuery.isLoading) {
    return <LoadingSpinner message="골프장 목록 불러오는 중…" />
  }

  if (coursesQuery.isError) {
    return (
      <div className="page-enter rounded-2xl border border-red-100 bg-red-50 p-8 text-center">
        <p className="text-sm font-medium text-red-700">
          골프장 목록을 불러오지 못했습니다.
        </p>
        <p className="mt-2 text-xs text-red-600">
          {coursesQuery.error instanceof ApiError
            ? coursesQuery.error.message
            : '네트워크 또는 로그인 상태를 확인하세요.'}
        </p>
        <Button
          className="mt-4"
          variant="secondary"
          onClick={() => void coursesQuery.refetch()}
        >
          다시 시도
        </Button>
      </div>
    )
  }

  if (!courses.length) {
    return (
      <div className="page-enter rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-medium text-slate-700">
          등록된 골프장이 없습니다.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          백엔드에서 골프장 데이터를 먼저 등록해 주세요.
        </p>
      </div>
    )
  }

  return (
    <div className="page-enter flex h-[calc(100vh-7rem)] min-h-[640px] flex-col gap-4">
      <div className="flex min-h-0 flex-1 gap-4">
        {/* ── Left panel ── */}
        <aside className="flex w-[380px] shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="flex-1 overflow-y-auto px-5 py-5">
            <h1 className="text-lg font-bold text-slate-900">일일 작업 계획</h1>
            <p className="mt-0.5 text-sm text-slate-400">{formatKoreanPlanHeader()}</p>

            <div className="mt-4">
              <label className={labelClass}>골프장</label>
              <select
                value={courseId}
                onChange={(e) => {
                  setCourseId(e.target.value)
                  setPlanId(null)
                }}
                className={`${inputClass} w-full`}
              >
                {!courseId ? (
                  <option value="" disabled>
                    골프장을 선택하세요
                  </option>
                ) : null}
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name_ko || c.name || `골프장 ${c.id}`}
                  </option>
                ))}
              </select>
              {selectedCourse ? (
                <p className="mt-1 text-xs text-slate-500">
                  선택됨: {selectedCourse.name_ko || selectedCourse.name}
                </p>
              ) : null}
            </div>

            <hr className="my-5 border-slate-100" />

            {/* Weather section */}
            <section>
              <p className="mb-2.5 text-sm font-semibold text-slate-700">날씨</p>
              <div className="flex flex-wrap gap-2">
                {WEATHER_OPTIONS.map((w) => {
                  const active = weather === w.value
                  return (
                    <button
                      key={w.value}
                      type="button"
                      onClick={() => setWeather(w.value)}
                      className={`rounded-xl border px-3 py-2 text-sm font-medium transition-all duration-150 ${
                        active
                          ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-200 hover:bg-emerald-50'
                      }`}
                    >
                      {w.emoji} {w.label}
                    </button>
                  )
                })}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>최저</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      value={tempMin}
                      onChange={(e) => setTempMin(e.target.value)}
                      className={`${inputClass} w-full`}
                    />
                    <span className="text-xs text-slate-400">°C</span>
                  </div>
                </div>
                <div>
                  <label className={labelClass}>최고</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      value={tempMax}
                      onChange={(e) => setTempMax(e.target.value)}
                      className={`${inputClass} w-full`}
                    />
                    <span className="text-xs text-slate-400">°C</span>
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <label className={labelClass}>강수량</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    value={rainfall}
                    onChange={(e) => setRainfall(e.target.value)}
                    className={`${inputClass} w-full`}
                  />
                  <span className="text-xs text-slate-400">mm</span>
                </div>
              </div>

              <div className="mt-3">
                <label className={labelClass}>전달사항</label>
                <textarea
                  rows={3}
                  value={specialNotes}
                  onChange={(e) => setSpecialNotes(e.target.value)}
                  placeholder="전달사항을 입력하세요"
                  className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-150 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            </section>

            <hr className="my-5 border-slate-100" />

            {/* Zone tasks */}
            <section>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">구역별 작업</p>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<PlusIcon className="h-4 w-4" />}
                  onClick={addZone}
                >
                  구역 추가
                </Button>
              </div>

              {workersQuery.isLoading ? (
                <LoadingSpinner message="작업자 불러오는 중…" />
              ) : zoneTasks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 py-6 text-center">
                  <p className="text-sm text-slate-400">
                    [+ 구역 추가]로 작업을 등록하세요
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {zoneTasks.map((task, index) => (
                    <ZoneTaskRow
                      key={task.clientId}
                      index={index}
                      zoneTask={task}
                      workers={workers}
                      onUpdate={updateZoneTask}
                      onDelete={deleteZoneTask}
                    />
                  ))}
                </div>
              )}
            </section>

            <hr className="my-5 border-slate-100" />

            <WorkerAttendanceSection
              planId={planId}
              courseId={courseId}
              initialRows={attendanceInitial}
              onSave={() => {
                void queryClient.invalidateQueries({
                  queryKey: ['daily-plan-today', courseId],
                })
              }}
            />
          </div>

          {/* Footer actions */}
          <div className="flex shrink-0 gap-2 border-t border-slate-100 bg-slate-50/60 p-4">
            <Button
              variant="secondary"
              className="flex-1"
              loading={draftMutation.isPending}
              disabled={!courseId || !selectedCourse}
              onClick={() => draftMutation.mutate()}
            >
              임시저장
            </Button>
            <Button
              className="flex-1"
              loading={publishMutation.isPending}
              disabled={!canPublish || !courseId || !selectedCourse}
              onClick={() => publishMutation.mutate()}
            >
              계획 발행 →
            </Button>
          </div>
        </aside>

        {/* ── Right panel ── */}
        <main className="min-w-0 flex-1 overflow-hidden rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          {todayPlanQuery.isLoading ? (
            <LoadingSpinner message="오늘 계획 불러오는 중…" />
          ) : (
            <PlanStatusBoard planId={planId} />
          )}
        </main>
      </div>
    </div>
  )
}
