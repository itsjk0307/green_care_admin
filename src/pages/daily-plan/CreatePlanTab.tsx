import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import toast from 'react-hot-toast'
import { fetchCourses } from '../../api/courses'
import {
  addZoneTask,
  createDailyPlan,
  saveAttendance,
} from '../../api/dailyPlans'
import { fetchUsers } from '../../api/users'
import { ApiError } from '../../api/client'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import type { AppUser } from '../../types/api'
import {
  TASK_TYPES,
  WEATHER_OPTIONS,
  ZONES,
  calcWorkingHours,
  createEmptyZoneState,
  todayLocalDate,
  type TaskKey,
  type ZoneFormState,
  type ZoneKey,
} from './constants'

type AttendanceRow = {
  worker_id: string
  status: 'present' | 'absent' | 'overtime'
  start_time: string
  end_time: string
  working_hours: number | null
}

type Props = {
  onSaved: () => void
}

const inputClass =
  'h-10 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#111827] outline-none focus:border-[#1B5E20]'
const labelClass = 'mb-1.5 block text-[13px] font-bold text-[#374151]'

function SectionHeader({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-4 text-base font-bold text-[#1B5E20]">{children}</h2>
  )
}

export function CreatePlanTab({ onSaved }: Props) {
  const [planDate, setPlanDate] = useState(todayLocalDate)
  const [courseId, setCourseId] = useState('')
  const [weather, setWeather] = useState<string>('맑음')
  const [tempMin, setTempMin] = useState('')
  const [tempMax, setTempMax] = useState('')
  const [rainfall, setRainfall] = useState('')
  const [specialNotes, setSpecialNotes] = useState('')
  const [zones, setZones] = useState(createEmptyZoneState)
  const [attendance, setAttendance] = useState<AttendanceRow[]>([])
  const [attendanceReady, setAttendanceReady] = useState(false)

  const coursesQuery = useQuery({
    queryKey: ['courses'],
    queryFn: fetchCourses,
  })

  const workersQuery = useQuery({
    queryKey: ['users', 'worker'],
    queryFn: () => fetchUsers('worker'),
  })

  const workers = workersQuery.data ?? []

  useEffect(() => {
    if (workers.length > 0 && !attendanceReady) {
      setAttendance(
        workers.map((w) => ({
          worker_id: w.id,
          status: 'present' as const,
          start_time: '08:00',
          end_time: '19:00',
          working_hours: calcWorkingHours('08:00', '19:00'),
        })),
      )
      setAttendanceReady(true)
    }
  }, [workers, attendanceReady])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!courseId) throw new ApiError('골프장을 선택하세요.', 400)

      const plan = await createDailyPlan({
        course_id: courseId,
        plan_date: planDate,
        weather,
        temperature_min: tempMin ? Number(tempMin) : null,
        temperature_max: tempMax ? Number(tempMax) : null,
        rainfall_mm: rainfall ? Number(rainfall) : null,
        special_notes: specialNotes.trim() || null,
      })

      for (const zone of ZONES) {
        const state = zones[zone.key]
        if (state.tasks.size === 0) continue

        await addZoneTask(plan.id, {
          zone: zone.key,
          task_types: Array.from(state.tasks),
          mowing_height_mm:
            state.tasks.has('mowing') && state.mowingHeight
              ? Number(state.mowingHeight)
              : null,
          assigned_worker_ids: state.workerIds,
          notes: state.notes.trim() || null,
        })
      }

      await saveAttendance(
        plan.id,
        attendance.map((row) => ({
          worker_id: row.worker_id,
          status: row.status,
          start_time: row.start_time,
          end_time: row.end_time,
          working_hours: row.working_hours,
        })),
      )
    },
    onSuccess: () => {
      toast.success('오늘의 계획이 저장되었습니다', {
        className: 'gc-toast-success',
      })
      onSaved()
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : '저장에 실패했습니다.'
      toast.error(message, { className: 'gc-toast-error' })
    },
  })

  function updateZone(
    zoneKey: ZoneKey,
    updater: (prev: ZoneFormState) => ZoneFormState,
  ) {
    setZones((prev) => ({
      ...prev,
      [zoneKey]: updater(prev[zoneKey]),
    }))
  }

  function toggleTask(zoneKey: ZoneKey, task: TaskKey) {
    updateZone(zoneKey, (z) => {
      const tasks = new Set(z.tasks)
      if (tasks.has(task)) tasks.delete(task)
      else tasks.add(task)
      return { ...z, tasks }
    })
  }

  function toggleWorker(zoneKey: ZoneKey, workerId: string) {
    updateZone(zoneKey, (z) => {
      const ids = z.workerIds.includes(workerId)
        ? z.workerIds.filter((id) => id !== workerId)
        : [...z.workerIds, workerId]
      return { ...z, workerIds: ids }
    })
  }

  function updateAttendance(workerId: string, patch: Partial<AttendanceRow>) {
    setAttendance((rows) =>
      rows.map((row) => {
        if (row.worker_id !== workerId) return row
        const next = { ...row, ...patch }
        if (patch.start_time !== undefined || patch.end_time !== undefined) {
          next.working_hours = calcWorkingHours(next.start_time, next.end_time)
        }
        return next
      }),
    )
  }

  const workerById = useMemo(() => {
    const map = new Map<string, AppUser>()
    workers.forEach((w) => map.set(w.id, w))
    return map
  }, [workers])

  const loadingData = coursesQuery.isLoading || workersQuery.isLoading

  if (loadingData) {
    return <LoadingSpinner message="데이터를 불러오는 중…" />
  }

  if (coursesQuery.isError || workersQuery.isError) {
    return (
      <Card>
        <p className="text-sm text-[#DC2626]">
          API 연결에 실패했습니다. 로그인 상태와 서버 주소를 확인하세요.
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-5">
      <Card>
        <SectionHeader>기본 정보</SectionHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>날짜</label>
            <input
              type="date"
              value={planDate}
              onChange={(e) => setPlanDate(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>골프장</label>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className={inputClass}
            >
              <option value="">골프장 선택</option>
              {(coursesQuery.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name_ko || c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      <Card>
        <SectionHeader>날씨</SectionHeader>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {WEATHER_OPTIONS.map((w) => {
            const active = weather === w.value
            return (
              <button
                key={w.value}
                type="button"
                onClick={() => setWeather(w.value)}
                className={`flex h-12 items-center justify-center gap-1.5 rounded-xl border text-sm font-semibold transition ${
                  active
                    ? 'border-[#1B5E20] bg-[#F0FDF4] text-[#1B5E20]'
                    : 'border-[#E5E7EB] bg-white text-[#374151] hover:border-[#BBF7D0]'
                }`}
              >
                <span>{w.emoji}</span>
                <span>{w.label}</span>
              </button>
            )
          })}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <label className={labelClass}>최저온도 (°C)</label>
            <input
              type="number"
              value={tempMin}
              onChange={(e) => setTempMin(e.target.value)}
              className={inputClass}
              placeholder="0"
            />
          </div>
          <div>
            <label className={labelClass}>최고온도 (°C)</label>
            <input
              type="number"
              value={tempMax}
              onChange={(e) => setTempMax(e.target.value)}
              className={inputClass}
              placeholder="0"
            />
          </div>
          <div>
            <label className={labelClass}>강수량 (mm)</label>
            <input
              type="number"
              value={rainfall}
              onChange={(e) => setRainfall(e.target.value)}
              className={inputClass}
              placeholder="0"
            />
          </div>
        </div>
      </Card>

      <Card padding="lg">
        <SectionHeader>구역별 작업</SectionHeader>
        <div className="space-y-6">
          {ZONES.map((zone) => {
            const state = zones[zone.key]
            const showMowing = state.tasks.has('mowing')
            return (
              <div
                key={zone.key}
                className="border-b border-[#F3F4F6] pb-6 last:border-0 last:pb-0"
              >
                <p className="mb-3 text-sm font-bold text-[#1B5E20]">
                  {zone.label}
                </p>
                <div className="flex flex-wrap gap-2">
                  {TASK_TYPES.map((task) => (
                    <label
                      key={task.key}
                      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
                        state.tasks.has(task.key)
                          ? 'border-[#1B5E20] bg-[#F0FDF4] text-[#1B5E20]'
                          : 'border-[#E5E7EB] text-[#6B7280]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={state.tasks.has(task.key)}
                        onChange={() => toggleTask(zone.key, task.key)}
                      />
                      {task.label}
                    </label>
                  ))}
                </div>
                {showMowing ? (
                  <div className="mt-3 max-w-[200px]">
                    <label className={labelClass}>예지 높이 (mm)</label>
                    <input
                      type="number"
                      value={state.mowingHeight}
                      onChange={(e) =>
                        updateZone(zone.key, (z) => ({
                          ...z,
                          mowingHeight: e.target.value,
                        }))
                      }
                      className={inputClass}
                      placeholder="3.5"
                    />
                  </div>
                ) : null}
                <div className="mt-3">
                  <label className={labelClass}>작업자 배정</label>
                  <div className="flex flex-wrap gap-2 rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] p-3">
                    {workers.length === 0 ? (
                      <span className="text-xs text-[#9CA3AF]">
                        등록된 작업자가 없습니다
                      </span>
                    ) : (
                      workers.map((w) => (
                        <label
                          key={w.id}
                          className={`inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-xs ${
                            state.workerIds.includes(w.id)
                              ? 'border-[#1B5E20] bg-[#F0FDF4] text-[#1B5E20]'
                              : 'border-[#E5E7EB] bg-white text-[#374151]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={state.workerIds.includes(w.id)}
                            onChange={() => toggleWorker(zone.key, w.id)}
                          />
                          {w.name}
                        </label>
                      ))
                    )}
                  </div>
                </div>
                <div className="mt-3">
                  <label className={labelClass}>메모 (선택)</label>
                  <input
                    type="text"
                    value={state.notes}
                    onChange={(e) =>
                      updateZone(zone.key, (z) => ({
                        ...z,
                        notes: e.target.value,
                      }))
                    }
                    className={inputClass}
                    placeholder="구역별 참고 사항"
                  />
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      <Card>
        <SectionHeader>작업자 출근</SectionHeader>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#EEEEEE] text-[12px] font-bold text-[#6B7280]">
                <th className="pb-2 pr-4">작업자</th>
                <th className="pb-2 pr-4">상태</th>
                <th className="pb-2 pr-4">시작</th>
                <th className="pb-2 pr-4">종료</th>
                <th className="pb-2">근무시간</th>
              </tr>
            </thead>
            <tbody>
              {attendance.map((row) => {
                const worker = workerById.get(row.worker_id)
                return (
                  <tr
                    key={row.worker_id}
                    className="border-b border-[#F9FAFB] last:border-0"
                  >
                    <td className="py-3 pr-4 font-medium text-[#111827]">
                      {worker?.name ?? '—'}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="inline-flex rounded-lg border border-[#E5E7EB] p-0.5">
                        {(
                          [
                            ['present', '출근'],
                            ['absent', '결근'],
                            ['overtime', '연장'],
                          ] as const
                        ).map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() =>
                              updateAttendance(row.worker_id, { status: value })
                            }
                            className={`rounded-md px-2 py-1 text-xs font-semibold ${
                              row.status === value
                                ? 'bg-[#1B5E20] text-white'
                                : 'text-[#6B7280] hover:bg-[#F9FAFB]'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <input
                        type="time"
                        value={row.start_time}
                        onChange={(e) =>
                          updateAttendance(row.worker_id, {
                            start_time: e.target.value,
                          })
                        }
                        className="h-9 rounded-lg border border-[#E5E7EB] px-2 text-xs"
                      />
                    </td>
                    <td className="py-3 pr-4">
                      <input
                        type="time"
                        value={row.end_time}
                        onChange={(e) =>
                          updateAttendance(row.worker_id, {
                            end_time: e.target.value,
                          })
                        }
                        className="h-9 rounded-lg border border-[#E5E7EB] px-2 text-xs"
                      />
                    </td>
                    <td className="py-3 text-[#374151]">
                      {row.working_hours != null
                        ? `${row.working_hours}시간`
                        : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <SectionHeader>전달사항</SectionHeader>
        <textarea
          value={specialNotes}
          onChange={(e) => setSpecialNotes(e.target.value)}
          rows={4}
          className="w-full resize-y rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#1B5E20]"
          placeholder="현장 전달 사항을 입력하세요"
        />
      </Card>

      <div className="flex justify-end pb-8">
        <Button
          size="lg"
          loading={saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
        >
          오늘의 계획 저장
        </Button>
      </div>
    </div>
  )
}



