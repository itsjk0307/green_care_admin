import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { fetchCourses } from '../../api/courses'
import {
  fetchTodayPlanOrNull,
  updateDailyPlan,
  updateZoneTaskStatus,
} from '../../api/dailyPlans'
import { fetchUsers } from '../../api/users'
import { ApiError } from '../../api/client'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { initials } from '../../lib/formatKoreanDate'
import {
  ATTENDANCE_STATUS_META,
  SAFETY_COUNTER_START,
  TASK_LABEL_BY_KEY,
  WEATHER_OPTIONS,
  ZONES,
  ZONE_STATUS_CYCLE,
  ZONE_STATUS_META,
  type ZoneStatusKey,
} from './constants'
import type { DailyZoneTask, DailyWorkPlan } from '../../types/api'

const COURSE_STORAGE_KEY = 'greencare-daily-plan-course-id'
const REFRESH_MS = 60_000

type Props = {
  onSwitchToCreate: () => void
}

function formatHeaderDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  return `${y}년 ${m}월 ${d}일`
}

function weatherEmoji(weather: string): string {
  return WEATHER_OPTIONS.find((w) => w.value === weather)?.emoji ?? '🌤️'
}

function formatTemperature(plan: DailyWorkPlan): string {
  const { temperature_min: min, temperature_max: max } = plan
  if (min != null && max != null) return `${min}°C ~ ${max}°C`
  if (min != null) return `${min}°C`
  if (max != null) return `${max}°C`
  return '—'
}

function safetyDays(): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(SAFETY_COUNTER_START)
  start.setHours(0, 0, 0, 0)
  const diff = today.getTime() - start.getTime()
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)))
}

function nextStatus(current: ZoneStatusKey): ZoneStatusKey {
  const i = ZONE_STATUS_CYCLE.indexOf(current)
  return ZONE_STATUS_CYCLE[(i + 1) % ZONE_STATUS_CYCLE.length]
}

export function StatusBoardTab({ onSwitchToCreate }: Props) {
  const queryClient = useQueryClient()
  const [courseId, setCourseId] = useState(() =>
    localStorage.getItem(COURSE_STORAGE_KEY) ?? '',
  )
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesDraft, setNotesDraft] = useState('')

  const coursesQuery = useQuery({
    queryKey: ['courses'],
    queryFn: fetchCourses,
  })

  const workersQuery = useQuery({
    queryKey: ['users', 'worker'],
    queryFn: () => fetchUsers('worker'),
  })

  useEffect(() => {
    const courses = coursesQuery.data
    if (!courses?.length) return
    if (!courseId || !courses.some((c) => c.id === courseId)) {
      setCourseId(courses[0].id)
    }
  }, [coursesQuery.data, courseId])

  useEffect(() => {
    if (courseId) localStorage.setItem(COURSE_STORAGE_KEY, courseId)
  }, [courseId])

  const planQuery = useQuery({
    queryKey: ['daily-plan-today', courseId],
    queryFn: () => fetchTodayPlanOrNull(courseId),
    enabled: Boolean(courseId),
    refetchInterval: REFRESH_MS,
  })

  const plan = planQuery.data

  useEffect(() => {
    if (plan) setNotesDraft(plan.special_notes ?? '')
  }, [plan])

  const workerNameById = useMemo(() => {
    const map = new Map<string, string>()
    ;(workersQuery.data ?? []).forEach((w) => map.set(w.id, w.name))
    return map
  }, [workersQuery.data])

  const zoneTaskByKey = useMemo(() => {
    const map = new Map<string, DailyZoneTask>()
    plan?.zone_tasks.forEach((t) => {
      if (!map.has(t.zone)) map.set(t.zone, t)
    })
    return map
  }, [plan?.zone_tasks])

  const attendanceStats = useMemo(() => {
    const rows = plan?.attendance ?? []
    return {
      total: rows.length,
      present: rows.filter((r) => r.status === 'present').length,
      absent: rows.filter((r) => r.status === 'absent').length,
      overtime: rows.filter((r) => r.status === 'overtime').length,
    }
  }, [plan?.attendance])

  const statusMutation = useMutation({
    mutationFn: ({
      zoneTaskId,
      status,
    }: {
      zoneTaskId: string
      status: ZoneStatusKey
    }) => updateZoneTaskStatus(zoneTaskId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-plan-today', courseId] })
    },
    onError: (err: unknown) => {
      toast.error(
        err instanceof ApiError ? err.message : '상태 변경에 실패했습니다.',
        { className: 'gc-toast-error' },
      )
    },
  })

  const notesMutation = useMutation({
    mutationFn: (text: string) => {
      if (!plan) throw new Error('No plan')
      return updateDailyPlan(plan.id, { special_notes: text || null })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-plan-today', courseId] })
      setEditingNotes(false)
      toast.success('전달사항이 저장되었습니다.', {
        className: 'gc-toast-success',
      })
    },
    onError: (err: unknown) => {
      toast.error(
        err instanceof ApiError ? err.message : '저장에 실패했습니다.',
        { className: 'gc-toast-error' },
      )
    },
  })

  const selectedCourse = coursesQuery.data?.find((c) => c.id === courseId)
  const courseLabel =
    selectedCourse?.name_ko || selectedCourse?.name || '골프장 선택'

  if (coursesQuery.isLoading) {
    return <LoadingSpinner message="골프장 목록을 불러오는 중…" />
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <select
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          className="h-10 min-w-[200px] rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm outline-none focus:border-[#1B5E20]"
        >
          {(coursesQuery.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name_ko || c.name}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2 text-xs text-[#6B7280]">
          <span
            className="h-2 w-2 animate-pulse rounded-full bg-[#1B5E20]"
            aria-hidden
          />
          실시간 업데이트 중
        </div>
      </div>

      {planQuery.isLoading ? (
        <LoadingSpinner message="오늘의 계획을 불러오는 중…" />
      ) : planQuery.isError ? (
        <Card>
          <p className="text-sm text-[#DC2626]">
            계획을 불러오지 못했습니다. 로그인 및 서버 연결을 확인하세요.
          </p>
        </Card>
      ) : !plan ? (
        <Card className="py-16 text-center">
          <p className="text-base font-medium text-[#374151]">
            오늘의 계획이 아직 작성되지 않았습니다
          </p>
          <p className="mt-2 text-sm text-[#6B7280]">
            {courseLabel} · 오늘 날짜 기준
          </p>
          <Button className="mt-6" onClick={onSwitchToCreate}>
            계획 작성하기
          </Button>
        </Card>
      ) : (
        <>
          <Card className="!p-4">
            <p className="text-center text-sm font-semibold text-[#111827] sm:text-base">
              {formatHeaderDate(plan.plan_date)}
              <span className="mx-2 text-[#D1D5DB]">|</span>
              {courseLabel}
              <span className="mx-2 text-[#D1D5DB]">|</span>
              {weatherEmoji(plan.weather)} {formatTemperature(plan)}
              <span className="mx-2 text-[#D1D5DB]">|</span>
              작업자 {plan.total_workers ?? attendanceStats.present}명
            </p>
          </Card>

          <Card padding="none" className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[#EEEEEE] bg-white text-[12px] font-bold text-[#6B7280]">
                    <th className="px-4 py-3">구분</th>
                    <th className="px-4 py-3">작업내용</th>
                    <th className="px-4 py-3">담당자</th>
                    <th className="px-4 py-3">예지높이</th>
                    <th className="px-4 py-3">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {ZONES.map((zone, index) => {
                    const task = zoneTaskByKey.get(zone.key)
                    const rowBg =
                      index % 2 === 0 ? 'bg-white' : 'bg-[#F7F8F7]'
                    return (
                      <tr
                        key={zone.key}
                        className={`border-b border-[#F3F4F6] ${rowBg}`}
                      >
                        <td className="px-4 py-3 font-bold text-[#1B5E20]">
                          {zone.label}
                        </td>
                        <td className="px-4 py-3">
                          {task && task.task_types.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {task.task_types.map((t) => (
                                <span
                                  key={t}
                                  className="inline-flex rounded-full border border-[#BBF7D0] bg-[#F0FDF4] px-2 py-0.5 text-[11px] font-semibold text-[#166534]"
                                >
                                  {TASK_LABEL_BY_KEY[t] ?? t}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[#9CA3AF]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {task && task.assigned_worker_ids.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {task.assigned_worker_ids.map((wid) => {
                                const name =
                                  workerNameById.get(wid) ?? wid.slice(0, 8)
                                return (
                                  <span
                                    key={wid}
                                    className="inline-flex items-center gap-1 rounded-full border border-[#E5E7EB] bg-white px-2 py-0.5 text-[11px] font-medium text-[#374151]"
                                  >
                                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1B5E20] text-[9px] font-bold text-white">
                                      {initials(name)}
                                    </span>
                                    {name}
                                  </span>
                                )
                              })}
                            </div>
                          ) : (
                            <span className="text-[#9CA3AF]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[#374151]">
                          {task?.mowing_height_mm != null
                            ? `${task.mowing_height_mm} mm`
                            : '—'}
                        </td>
                        <td className="px-4 py-3">
                          {task ? (
                            <button
                              type="button"
                              disabled={statusMutation.isPending}
                              onClick={() => {
                                const current = task.status as ZoneStatusKey
                                statusMutation.mutate({
                                  zoneTaskId: task.id,
                                  status: nextStatus(current),
                                })
                              }}
                              className="cursor-pointer disabled:opacity-50"
                              title="클릭하여 상태 변경"
                            >
                              <Badge
                                variant={
                                  ZONE_STATUS_META[task.status as ZoneStatusKey]
                                    ?.badge ?? 'pending'
                                }
                              >
                                {ZONE_STATUS_META[task.status as ZoneStatusKey]
                                  ?.label ?? task.status}
                              </Badge>
                            </button>
                          ) : (
                            <span className="text-[#9CA3AF]">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <h3 className="mb-3 text-base font-bold text-[#1B5E20]">
                인원 현황
              </h3>
              <div className="mb-4 flex flex-wrap gap-3 text-sm">
                <span className="font-semibold text-[#111827]">
                  전체 {attendanceStats.total}명
                </span>
                <span className="text-[#16A34A]">
                  출근 {attendanceStats.present}
                </span>
                <span className="text-[#DC2626]">
                  결근 {attendanceStats.absent}
                </span>
                <span className="text-[#2563EB]">
                  연장 {attendanceStats.overtime}
                </span>
              </div>
              <ul className="max-h-[320px] space-y-2 overflow-y-auto">
                {(plan.attendance ?? []).map((row) => {
                  const name = workerNameById.get(row.worker_id) ?? '—'
                  const meta = ATTENDANCE_STATUS_META[row.status]
                  return (
                    <li
                      key={row.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#F3F4F6] bg-[#FAFAFA] px-3 py-2"
                    >
                      <span className="font-medium text-[#111827]">
                        {name}
                      </span>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#6B7280]">
                        <Badge variant={meta.badge}>{meta.label}</Badge>
                        <span>
                          {row.start_time ?? '—'} ~ {row.end_time ?? '—'}
                        </span>
                        {row.working_hours != null ? (
                          <span className="font-semibold text-[#374151]">
                            {row.working_hours}시간
                          </span>
                        ) : null}
                      </div>
                    </li>
                  )
                })}
                {plan.attendance.length === 0 ? (
                  <li className="py-4 text-center text-sm text-[#9CA3AF]">
                    출근 기록이 없습니다
                  </li>
                ) : null}
              </ul>
            </Card>

            <Card>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-base font-bold text-[#1B5E20]">전달사항</h3>
                {!editingNotes ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setNotesDraft(plan.special_notes ?? '')
                      setEditingNotes(true)
                    }}
                  >
                    수정
                  </Button>
                ) : null}
              </div>
              {editingNotes ? (
                <div className="space-y-3">
                  <textarea
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    rows={6}
                    className="w-full resize-y rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#1B5E20]"
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingNotes(false)
                        setNotesDraft(plan.special_notes ?? '')
                      }}
                    >
                      취소
                    </Button>
                    <Button
                      size="sm"
                      loading={notesMutation.isPending}
                      onClick={() => notesMutation.mutate(notesDraft)}
                    >
                      저장
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="min-h-[120px] rounded-lg border border-[#EEEEEE] bg-[#F7F8F7] px-4 py-3 text-sm leading-relaxed text-[#374151] whitespace-pre-wrap">
                  {plan.special_notes?.trim()
                    ? plan.special_notes
                    : '등록된 전달사항이 없습니다.'}
                </div>
              )}
            </Card>
          </div>

          <div className="rounded-2xl border border-[#BBF7D0] bg-[#F0FDF4] px-6 py-5 text-center shadow-[var(--shadow-gc-card)]">
            <p className="text-base font-bold text-[#1B5E20] sm:text-lg">
              안전 무사고 달성 — D+{safetyDays()} 일째 무사고 운영 중
            </p>
          </div>
        </>
      )}
    </div>
  )
}

