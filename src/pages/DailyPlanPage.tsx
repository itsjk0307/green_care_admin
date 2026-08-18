import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { ArrowPathIcon, PlusIcon } from '@heroicons/react/24/outline'
import { fetchCourses } from '../api/courses'
import { ApiError } from '../api/client'
import {
  fetchCourseWeather,
  type CourseWeather,
} from '../api/weather'
import { WeatherOptionChips } from '../components/plan/WeatherOptionChips'
import { WorkReportMediaSection } from '../components/plan/WorkReportMediaSection'
import { ZoneTaskRow } from '../components/plan/ZoneTaskRow'
import { Button } from '../components/ui/Button'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import {
  PRIMARY_ZONES,
  buildZoneTaskNotes,
  createEmptyZoneTask,
  createPrimaryZoneTemplates,
  dedupeZoneTasksByZone,
  formatPlanHeader,
  parseZoneTaskNotes,
  todayLocalDate,
  type TaskKey,
  type ZoneKey,
  type ZoneTaskForm,
} from '../constants/dailyPlan'
import {
  addZoneTask,
  createPlan,
  getPlanDetail,
  getTodayPlanOrNull,
  TODAY_DRAFT_PLAN_QUERY_KEY,
  publishPlan,
  updatePlan,
  updateZoneTask as patchZoneTaskApi,
} from '../services/dailyPlanService'
import { useLanguageStore } from '../stores/languageStore'
import { courseDisplayName } from '../lib/courseName'
import { useCourseScope } from '../hooks/useCourseScope'
import type { DailyZoneTask } from '../types/api'

const COURSE_STORAGE_KEY = 'greencare-daily-plan-course-id'

const inputClass =
  'h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-all duration-150 focus:border-[#121820] focus:ring-2 focus:ring-[#121820]/20'

const labelClass = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400'

function mapZoneTaskFromApi(task: DailyZoneTask): ZoneTaskForm {
  const parsed = parseZoneTaskNotes(task.notes)
  return {
    clientId: task.id,
    serverId: task.id,
    zone: task.zone as ZoneKey,
    task_types: task.task_types as TaskKey[],
    mowing_height_mm:
      task.mowing_height_mm != null ? String(task.mowing_height_mm) : '',
    assigned_worker_ids: [],
    assignee_name: parsed.assignee_name,
    notes: parsed.rest,
    fungicide_targets: parsed.fungicide_targets,
    fertilizer_mode: parsed.fertilizer_mode,
  }
}

function isZoneTaskValid(task: ZoneTaskForm): boolean {
  return Boolean(task.zone) && task.task_types.length > 0
}

function isPrimaryZone(zone: string): boolean {
  return PRIMARY_ZONES.some((z) => z.key === zone)
}

export function DailyPlanPage() {
  const { t, language } = useLanguageStore()
  const { isScoped, lockedCourseId } = useCourseScope()
  const queryClient = useQueryClient()
  const [courseId, setCourseId] = useState(
    () => localStorage.getItem(COURSE_STORAGE_KEY) ?? '',
  )
  const [planId, setPlanId] = useState<string | null>(null)
  const [weather, setWeather] = useState('맑음')
  const [tempMin, setTempMin] = useState('')
  const [tempMax, setTempMax] = useState('')
  const [rainfall, setRainfall] = useState('')
  const [rainChance, setRainChance] = useState('')
  const [specialNotes, setSpecialNotes] = useState('')
  const [workerCount, setWorkerCount] = useState('')
  const [zoneTasks, setZoneTasks] = useState<ZoneTaskForm[]>(() =>
    createPrimaryZoneTemplates(),
  )
  const [planStatus, setPlanStatus] = useState<string | null>(null)
  /** User started editing the composer (zones, weather, notes, etc.) */
  const [composerEngaged, setComposerEngaged] = useState(false)
  /** Load existing plan media from server (draft). False after publish for a clean composer. */
  const [includeRemoteMedia, setIncludeRemoteMedia] = useState(false)
  const [composerSessionKey, setComposerSessionKey] = useState(0)
  /** When true, live weather will not overwrite user / saved plan values */
  const [conditionsLocked, setConditionsLocked] = useState(false)
  /** Blocks server draft hydration until the user starts the next report */
  const blockAutoHydrateRef = useRef(false)

  function engageComposer() {
    blockAutoHydrateRef.current = false
    setComposerEngaged(true)
  }

  function resetComposerForNextEntry() {
    blockAutoHydrateRef.current = true
    setPlanId(null)
    setPlanStatus(null)
    setZoneTasks(createPrimaryZoneTemplates())
    setSpecialNotes('')
    setWorkerCount('')
    setConditionsLocked(false)
    setComposerEngaged(false)
    setIncludeRemoteMedia(false)
    setComposerSessionKey((k) => k + 1)
    if (weatherQuery.data) {
      applyCourseWeather(weatherQuery.data)
    } else {
      setWeather('맑음')
      setTempMin('')
      setTempMax('')
      setRainfall('')
      setRainChance('')
    }
  }

  const coursesQuery = useQuery({ queryKey: ['courses'], queryFn: fetchCourses })
  const todayPlanQuery = useQuery({
    queryKey: [TODAY_DRAFT_PLAN_QUERY_KEY, courseId],
    queryFn: () => getTodayPlanOrNull(courseId, { draftOnly: true }),
    enabled: Boolean(courseId),
    staleTime: 0,
  })

  const courses = coursesQuery.data ?? []
  const selectedCourse = courses.find((c) => c.id === courseId)
  const courseLat = selectedCourse?.center_lat ?? null
  const courseLng = selectedCourse?.center_lng ?? null
  const hasCourseGps = courseLat != null && courseLng != null

  const weatherQuery = useQuery({
    queryKey: ['course-weather', courseId, courseLat, courseLng],
    queryFn: () => fetchCourseWeather(courseLat!, courseLng!),
    enabled: Boolean(courseId && hasCourseGps),
    staleTime: 10 * 60 * 1000,
    retry: 1,
  })

  function applyCourseWeather(data: CourseWeather) {
    setWeather(data.weather)
    const temp =
      data.temperatureMax ?? data.temperatureMin ?? data.temperature
    setTempMax(String(temp))
    setTempMin(
      data.temperatureMin != null
        ? String(data.temperatureMin)
        : String(data.temperature),
    )
    setRainfall(String(data.rainfallMm))
    setRainChance(String(data.rainChancePct))
  }

  useEffect(() => {
    if (!courses.length) return
    if (lockedCourseId) {
      setCourseId(lockedCourseId)
      return
    }
    if (!courseId || !courses.some((c) => c.id === courseId)) {
      const active = courses.find((c) => c.is_active) ?? courses[0]
      setCourseId(active.id)
    }
  }, [courses, courseId, lockedCourseId])

  useEffect(() => {
    if (lockedCourseId) {
      localStorage.setItem(COURSE_STORAGE_KEY, lockedCourseId)
    }
  }, [lockedCourseId])

  useEffect(() => {
    if (coursesQuery.isError) {
      const message =
        coursesQuery.error instanceof ApiError
          ? coursesQuery.error.message
          : t('coursesLoadFailed')
      toast.error(message, { className: 'gc-toast-error' })
    }
  }, [coursesQuery.isError, coursesQuery.error, t])

  useEffect(() => {
    if (courseId) localStorage.setItem(COURSE_STORAGE_KEY, courseId)
  }, [courseId])

  const normalizePlanStatus = (status: string | null | undefined) =>
    (status ?? '').toLowerCase()

  const hydrateFromPlan = useCallback(
    (plan: NonNullable<Awaited<ReturnType<typeof getTodayPlanOrNull>>>) => {
      const status = normalizePlanStatus(plan.status)
      if (status === 'published' || status === 'completed') {
        return
      }

      setPlanId(plan.id)
      setPlanStatus(plan.status)

      setComposerEngaged(true)
      setIncludeRemoteMedia(true)

      setWeather(plan.weather)
      setTempMin(plan.temperature_min != null ? String(plan.temperature_min) : '')
      setTempMax(plan.temperature_max != null ? String(plan.temperature_max) : '')
      setRainfall(plan.rainfall_mm != null ? String(plan.rainfall_mm) : '')
      setRainChance('')
      setSpecialNotes(plan.special_notes ?? '')
      setWorkerCount(
        plan.total_workers != null ? String(plan.total_workers) : '',
      )
      setConditionsLocked(true)

      if (plan.zone_tasks.length > 0) {
        setZoneTasks(
          dedupeZoneTasksByZone(plan.zone_tasks.map(mapZoneTaskFromApi)),
        )
      } else {
        setZoneTasks(createPrimaryZoneTemplates())
      }
    },
    [],
  )

  useEffect(() => {
    if (blockAutoHydrateRef.current) return
    if (todayPlanQuery.isLoading) return

    if (todayPlanQuery.data) {
      const status = normalizePlanStatus(todayPlanQuery.data.status)
      if (status === 'published' || status === 'completed') {
        return
      }
      if (composerEngaged) return
      hydrateFromPlan(todayPlanQuery.data)
      return
    }

    if (todayPlanQuery.data === null) {
      if (composerEngaged) return
      setPlanId(null)
      setPlanStatus(null)
      setComposerEngaged(false)
      setIncludeRemoteMedia(false)
      setComposerSessionKey((k) => k + 1)
      setConditionsLocked(false)
      setSpecialNotes('')
      setWorkerCount('')
      setZoneTasks(createPrimaryZoneTemplates())
      if (!hasCourseGps) {
        setWeather('맑음')
        setTempMin('')
        setTempMax('')
        setRainfall('')
        setRainChance('')
      }
    }
  }, [
    todayPlanQuery.data,
    todayPlanQuery.isLoading,
    hydrateFromPlan,
    hasCourseGps,
    composerEngaged,
  ])

  // Auto-apply live weather for new / cleared forms (not locked draft values)
  useEffect(() => {
    if (!weatherQuery.data || conditionsLocked) return
    if (todayPlanQuery.isLoading) return
    const existing = todayPlanQuery.data
    const existingStatus = normalizePlanStatus(existing?.status)
    if (
      existing &&
      existingStatus !== 'published' &&
      existingStatus !== 'completed'
    ) {
      return
    }
    applyCourseWeather(weatherQuery.data)
  }, [
    weatherQuery.data,
    conditionsLocked,
    todayPlanQuery.isLoading,
    todayPlanQuery.data,
  ])

  useEffect(() => {
    if (weatherQuery.isError && hasCourseGps && !conditionsLocked) {
      toast.error(t('weatherFetchFailed'), { className: 'gc-toast-error' })
    }
  }, [weatherQuery.isError, hasCourseGps, conditionsLocked, t])

  function lockConditions() {
    setConditionsLocked(true)
  }

  async function refreshWeather() {
    if (!hasCourseGps) {
      toast.error(t('weatherNoGps'), { className: 'gc-toast-error' })
      return
    }
    try {
      const data = await weatherQuery.refetch()
      if (data.data) {
        applyCourseWeather(data.data)
        setConditionsLocked(false)
        toast.success(t('weatherUpdated'), { className: 'gc-toast-success' })
      } else {
        toast.error(t('weatherFetchFailed'), { className: 'gc-toast-error' })
      }
    } catch {
      toast.error(t('weatherFetchFailed'), { className: 'gc-toast-error' })
    }
  }

  const validZoneTasks = zoneTasks.filter(isZoneTaskValid)
  const hasAssignee = validZoneTasks.some((z) => z.assignee_name.trim().length > 0)
  const isPublished =
    Boolean(planId) &&
    (normalizePlanStatus(planStatus) === 'published' ||
      normalizePlanStatus(planStatus) === 'completed')
  const canPublish = validZoneTasks.length > 0 && hasAssignee

  async function ensurePlan(): Promise<string> {
    if (planId) return planId
    if (!courseId || !selectedCourse) {
      throw new ApiError(t('selectCourse'), 400)
    }
    const plan = await createPlan({
      course_id: courseId,
      plan_date: todayLocalDate(),
      weather,
      temperature_min: tempMin ? Number(tempMin) : null,
      temperature_max: tempMax ? Number(tempMax) : tempMin ? Number(tempMin) : null,
      rainfall_mm: rainfall ? Number(rainfall) : null,
      special_notes: specialNotes.trim() || null,
      total_workers: workerCount ? Number(workerCount) : null,
    })
    setPlanId(plan.id)
    setPlanStatus(plan.status)
    return plan.id
  }

  function zoneTaskPayload(task: ZoneTaskForm) {
    return {
      zone: task.zone,
      task_types: task.task_types,
      mowing_height_mm:
        task.task_types.some((t) =>
          ['mowing', 'hollow_tine', 'solid_tine'].includes(t),
        ) && task.mowing_height_mm
          ? Number(task.mowing_height_mm)
          : null,
      assigned_worker_ids: [] as string[],
      notes: buildZoneTaskNotes(task),
    }
  }

  function planMetadataPayload() {
    return {
      weather,
      temperature_min: tempMin ? Number(tempMin) : null,
      temperature_max: tempMax
        ? Number(tempMax)
        : tempMin
          ? Number(tempMin)
          : null,
      rainfall_mm: rainfall ? Number(rainfall) : null,
      special_notes: specialNotes.trim() || null,
    }
  }

  async function preparePlanForSave(attachZoneIdsLocally: boolean): Promise<string> {
    const id = await ensurePlan()
    await updatePlan(id, planMetadataPayload())
    await syncZoneTasks(id, attachZoneIdsLocally)
    return id
  }

  async function syncZoneTasks(id: string, attachZoneIdsLocally = true) {
    const valid = dedupeZoneTasksByZone(zoneTasks.filter(isZoneTaskValid))
    const plan = await getPlanDetail(id)
    const unusedServer = [...(plan.zone_tasks ?? [])]
    const nextIds = new Map<string, string>()

    for (const task of valid) {
      const body = zoneTaskPayload(task)
      let serverId = task.serverId

      if (serverId) {
        const idx = unusedServer.findIndex((z) => z.id === serverId)
        if (idx >= 0) unusedServer.splice(idx, 1)
      } else if (task.zone) {
        const idx = unusedServer.findIndex((z) => z.zone === task.zone)
        if (idx >= 0) {
          serverId = unusedServer[idx].id
          unusedServer.splice(idx, 1)
        }
      }

      if (serverId) {
        await patchZoneTaskApi(serverId, {
          task_types: body.task_types,
          mowing_height_mm: body.mowing_height_mm,
          assigned_worker_ids: body.assigned_worker_ids,
          notes: body.notes,
        })
        nextIds.set(task.clientId, serverId)
      } else {
        const created = await addZoneTask(id, body)
        nextIds.set(task.clientId, created.id)
      }
    }

    if (attachZoneIdsLocally && nextIds.size > 0) {
      setZoneTasks((prev) =>
        prev.map((z) => {
          const sid = nextIds.get(z.clientId)
          return sid ? { ...z, serverId: sid } : z
        }),
      )
    }
  }

  const draftMutation = useMutation({
    mutationFn: () => preparePlanForSave(true),
    onSuccess: async () => {
      toast.success(t('draftSaved'), { className: 'gc-toast-success' })
      await queryClient.invalidateQueries({ queryKey: [TODAY_DRAFT_PLAN_QUERY_KEY, courseId] })
      await queryClient.invalidateQueries({ queryKey: ['daily-plan', planId] })
      await queryClient.invalidateQueries({ queryKey: ['daily-plans-list'] })
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : t('saveFailed'), {
        className: 'gc-toast-error',
      })
    },
  })

  const publishMutation = useMutation({
    mutationFn: async () => {
      const id = await preparePlanForSave(false)
      return publishPlan(id)
    },
    onSuccess: async (published) => {
      toast.success(t('planPublished'), { className: 'gc-toast-success' })
      blockAutoHydrateRef.current = true
      resetComposerForNextEntry()
      queryClient.setQueryData([TODAY_DRAFT_PLAN_QUERY_KEY, courseId], null)
      await queryClient.removeQueries({ queryKey: [TODAY_DRAFT_PLAN_QUERY_KEY, courseId] })
      await queryClient.invalidateQueries({ queryKey: ['daily-plans-list'] })
      await queryClient.invalidateQueries({ queryKey: ['plan-media', published.id] })
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : t('publishFailed'), {
        className: 'gc-toast-error',
      })
    },
  })

  function updateZoneTask(clientId: string, patch: Partial<ZoneTaskForm>) {
    engageComposer()
    setZoneTasks((prev) =>
      prev.map((z) => (z.clientId === clientId ? { ...z, ...patch } : z)),
    )
  }

  function deleteZoneTask(clientId: string) {
    engageComposer()
    setZoneTasks((prev) => {
      const target = prev.find((z) => z.clientId === clientId)
      // Keep primary Green/Tee/Fairway rows — clear instead of remove
      if (target?.zone && isPrimaryZone(target.zone) && !target.serverId) {
        return prev.map((z) =>
          z.clientId === clientId
            ? { ...createEmptyZoneTask(target.zone as ZoneKey), clientId }
            : z,
        )
      }
      return prev.filter((z) => z.clientId !== clientId)
    })
  }

  function addZone() {
    engageComposer()
    setZoneTasks((prev) => [...prev, createEmptyZoneTask()])
  }

  if (coursesQuery.isLoading) {
    return <LoadingSpinner message={t('loadingCourses')} />
  }

  if (coursesQuery.isError) {
    const isAuthError =
      coursesQuery.error instanceof ApiError &&
      (coursesQuery.error.status === 401 ||
        /token|auth|login|인증|만료/i.test(coursesQuery.error.message))

    return (
      <div className="page-enter rounded-2xl border border-red-100 bg-red-50 p-8 text-center">
        <p className="text-sm font-medium text-red-700">
          {isAuthError
            ? t('authExpired')
            : t('coursesLoadFailed')}
        </p>
        <p className="mt-2 text-xs text-red-600">
          {isAuthError
            ? t('pleaseLoginAgain')
            : coursesQuery.error instanceof ApiError
              ? coursesQuery.error.message
              : t('checkNetworkOrLogin')}
        </p>
        <div className="mt-4 flex justify-center gap-2">
          {isAuthError ? (
            <Button
              variant="primary"
              onClick={() => {
                localStorage.removeItem('access_token')
                localStorage.removeItem('greencare-admin-user')
                window.location.assign('/login')
              }}
            >
              {t('goToLogin')}
            </Button>
          ) : (
            <Button
              variant="secondary"
              onClick={() => void coursesQuery.refetch()}
            >
              {t('retry')}
            </Button>
          )}
        </div>
      </div>
    )
  }

  if (!courses.length) {
    return (
      <div className="page-enter rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-medium text-slate-700">
          {t('noCourses')}
        </p>
        <p className="mt-2 text-xs text-slate-500">
          {t('registerCourseFirst')}
        </p>
      </div>
    )
  }

  return (
    <div className="page-enter mx-auto max-w-6xl space-y-4 pb-6 sm:space-y-6 sm:pb-8">
      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            {t('workReports')}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {formatPlanHeader(language)}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
          {isPublished ? (
            <span className="inline-flex h-10 items-center justify-center rounded-xl bg-[#f4f5f7] px-4 text-sm font-semibold text-[#121820]">
              {t('statusPublished')}
            </span>
          ) : null}
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <Button
              variant="secondary"
              loading={draftMutation.isPending}
              disabled={!courseId || !selectedCourse || draftMutation.isPending}
              onClick={() => draftMutation.mutate()}
              className="w-full sm:w-auto"
            >
              {t('saveDraft')}
            </Button>
            <Button
              loading={publishMutation.isPending}
              disabled={
                !canPublish ||
                !courseId ||
                !selectedCourse ||
                publishMutation.isPending
              }
              onClick={() => publishMutation.mutate()}
              className="w-full sm:w-auto"
            >
              {t('publishPlan')}
            </Button>
          </div>
        </div>
      </div>

      {/* Course + field conditions */}
      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5 md:p-6">
        <div className="grid items-start gap-4 sm:gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
          <div className="min-w-0">
            <div className="mb-1 flex h-5 items-center">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {t('course')}
              </label>
            </div>
            {isScoped && selectedCourse ? (
              <div className={`${inputClass} flex w-full items-center bg-slate-50 font-semibold text-slate-800`}>
                <span className="mr-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  {t('lockedCourseLabel')}
                </span>
                {courseDisplayName(selectedCourse, language)}
              </div>
            ) : (
              <select
                value={courseId}
                onChange={(e) => {
                  blockAutoHydrateRef.current = false
                  setCourseId(e.target.value)
                  setPlanId(null)
                  setPlanStatus(null)
                  setConditionsLocked(false)
                  setComposerEngaged(false)
                  setIncludeRemoteMedia(false)
                  setComposerSessionKey((k) => k + 1)
                }}
                className={`${inputClass} w-full`}
              >
                {!courseId ? (
                  <option value="" disabled>
                    {t('selectCourse')}
                  </option>
                ) : null}
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {courseDisplayName(c, language)}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="min-w-0">
            <div className="mb-1 flex h-5 items-center justify-between gap-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {t('fieldStatus')}
              </label>
              <button
                type="button"
                onClick={() => void refreshWeather()}
                disabled={!hasCourseGps || weatherQuery.isFetching}
                title={t('weatherRefresh')}
                aria-label={t('weatherRefresh')}
                className="inline-flex h-5 w-5 items-center justify-center rounded text-[#121820] transition-colors hover:bg-[#f4f5f7] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowPathIcon
                  className={`h-3.5 w-3.5 ${weatherQuery.isFetching ? 'animate-spin' : ''}`}
                />
              </button>
            </div>
            <WeatherOptionChips
              value={weather}
              onChange={(next) => {
                engageComposer()
                setWeather(next)
                lockConditions()
              }}
            />
            <p className="mt-1.5 text-[11px] leading-tight text-slate-400">
              {hasCourseGps ? t('weatherAutoHint') : t('weatherNoGps')}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:mt-5 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <label className={labelClass}>{t('temperature')}</label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                value={tempMax || tempMin}
                onChange={(e) => {
                  engageComposer()
                  setTempMax(e.target.value)
                  if (!tempMin) setTempMin(e.target.value)
                  lockConditions()
                }}
                className={`${inputClass} w-full`}
                placeholder="32"
              />
              <span className="shrink-0 text-xs text-slate-400">°C</span>
            </div>
          </div>
          <div>
            <label className={labelClass}>{t('rainfall')}</label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={0}
                value={rainfall}
                onChange={(e) => {
                  engageComposer()
                  setRainfall(e.target.value)
                  lockConditions()
                }}
                className={`${inputClass} w-full`}
                placeholder="0"
              />
              <span className="shrink-0 text-xs text-slate-400">mm</span>
            </div>
          </div>
          <div>
            <label className={labelClass}>{t('rainChance')}</label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={0}
                max={100}
                value={rainChance}
                onChange={(e) => {
                  engageComposer()
                  setRainChance(e.target.value)
                  lockConditions()
                }}
                className={`${inputClass} w-full`}
                placeholder="0"
              />
              <span className="shrink-0 text-xs text-slate-400">%</span>
            </div>
          </div>
          <div>
            <label className={labelClass}>{t('headcount')}</label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={0}
                value={workerCount}
                onChange={(e) => {
                  engageComposer()
                  setWorkerCount(e.target.value)
                }}
                className={`${inputClass} w-full`}
                placeholder="2"
              />
              {t('peopleUnit') ? (
                <span className="shrink-0 text-xs text-slate-400">
                  {t('peopleUnit')}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* Zone checklist */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-base font-semibold text-slate-900">
              {t('zoneTasks')}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">{t('zoneTasksHint')}</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            icon={<PlusIcon className="h-4 w-4" />}
            onClick={addZone}
          >
            {t('addZone')}
          </Button>
        </div>

        <div
          key={composerSessionKey}
          className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3"
        >
          {zoneTasks.map((task, index) => (
            <ZoneTaskRow
              key={`${composerSessionKey}-${task.clientId}`}
              index={index}
              zoneTask={task}
              onUpdate={updateZoneTask}
              onDelete={deleteZoneTask}
              lockZone={Boolean(task.zone && isPrimaryZone(task.zone))}
            />
          ))}
        </div>
      </section>

      {/* Site media — photos & videos */}
      <WorkReportMediaSection
        key={composerSessionKey}
        planId={planId}
        courseId={courseId}
        ensurePlan={ensurePlan}
        includeRemoteMedia={includeRemoteMedia}
        onEngage={engageComposer}
      />
    </div>
  )
}
