import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { calcWorkingHours } from '../../constants/dailyPlan'
import { getWorkers, saveAttendance } from '../../services/dailyPlanService'
import { ApiError } from '../../api/client'
import { useLanguageStore } from '../../stores/languageStore'
import { Button } from '../ui/Button'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import type { AttendanceItem } from '../../types/dailyPlan'

type AttendanceRow = AttendanceItem & {
  start_time: string
  end_time: string
}

type Props = {
  planId: string | null
  courseId: string
  initialRows?: AttendanceRow[]
  onSave?: () => void
}

const timeInputClass =
  'h-9 w-full min-w-[100px] rounded-lg border border-[#E5E7EB] px-2 text-sm outline-none focus:border-[#121820]'

function statusButtonClass(
  active: boolean,
  tone: 'present' | 'absent' | 'overtime',
): string {
  const base =
    'rounded-lg border px-2.5 py-1 text-xs font-semibold transition'
  if (!active) return `${base} border-[#E5E7EB] bg-white text-[#6B7280] hover:bg-[#F9FAFB]`
  if (tone === 'present') return `${base} border-[#BBF7D0] bg-[#10B981] text-white`
  if (tone === 'absent') return `${base} border-[#FECACA] bg-[#EF4444] text-white`
  return `${base} border-[#FDE68A] bg-[#F59E0B] text-white`
}

export function WorkerAttendanceSection({
  planId,
  courseId,
  initialRows,
  onSave,
}: Props) {
  const { t } = useLanguageStore()
  const queryClient = useQueryClient()
  const [rows, setRows] = useState<AttendanceRow[]>([])
  const [initialized, setInitialized] = useState(false)

  const workersQuery = useQuery({
    queryKey: ['workers', courseId],
    queryFn: () => getWorkers(courseId),
    enabled: Boolean(courseId),
  })

  const workers = workersQuery.data ?? []

  useEffect(() => {
    if (initialized) return
    if (initialRows && initialRows.length > 0) {
      setRows(initialRows)
      setInitialized(true)
      return
    }
    if (workers.length > 0) {
      setRows(
        workers.map((w) => ({
          worker_id: w.id,
          status: 'present',
          start_time: '08:00',
          end_time: '19:00',
          working_hours: calcWorkingHours('08:00', '19:00'),
        })),
      )
      setInitialized(true)
    }
  }, [workers, initialRows, initialized])

  const stats = useMemo(() => {
    return {
      present: rows.filter((r) => r.status === 'present').length,
      absent: rows.filter((r) => r.status === 'absent').length,
      overtime: rows.filter((r) => r.status === 'overtime').length,
    }
  }, [rows])

  const workerNameById = useMemo(() => {
    const map = new Map<string, string>()
    workers.forEach((w) => map.set(w.id, w.name))
    return map
  }, [workers])

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!planId) throw new ApiError(t('savePlanFirst'), 400)
      return saveAttendance(
        planId,
        rows.map((r) => ({
          worker_id: r.worker_id,
          status: r.status,
          start_time: r.start_time,
          end_time: r.end_time,
          working_hours: calcWorkingHours(r.start_time, r.end_time),
        })),
      )
    },
    onSuccess: () => {
      toast.success(t('attendanceSaved'), { className: 'gc-toast-success' })
      void queryClient.invalidateQueries({ queryKey: ['daily-plan'] })
      onSave?.()
    },
    onError: (err) => {
      const message =
        err instanceof ApiError ? err.message : t('attendanceSaveFailed')
      toast.error(message, { className: 'gc-toast-error' })
    },
  })

  function updateRow(workerId: string, patch: Partial<AttendanceRow>) {
    setRows((prev) =>
      prev.map((row) => {
        if (row.worker_id !== workerId) return row
        const next = { ...row, ...patch }
        if (patch.start_time !== undefined || patch.end_time !== undefined) {
          next.working_hours = calcWorkingHours(next.start_time, next.end_time)
        }
        return next
      }),
    )
  }

  if (!courseId) {
    return <p className="text-sm text-[#6B7280]">{t('selectCourse')}</p>
  }

  if (workersQuery.isLoading) {
    return <LoadingSpinner message={t('loadingStaffList')} />
  }

  if (workersQuery.isError) {
    return (
      <p className="text-sm text-[#DC2626]">{t('staffListFailed')}</p>
    )
  }

  if (workers.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-[#E5E7EB] bg-[#F9FAFB] px-4 py-6 text-center text-sm text-[#6B7280]">
        {t('noWorkers')}
      </p>
    )
  }

  const statusOptions = [
    ['present', 'statusPresent'] as const,
    ['absent', 'statusAbsent'] as const,
    ['overtime', 'statusOvertime'] as const,
  ]

  return (
    <section>
      <h3 className="mb-3 text-sm font-bold text-[#111827]">
        {t('attendanceTitle')}
      </h3>

      <div className="overflow-x-auto rounded-xl border border-[#EEEEEE]">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr className="border-b border-[#EEEEEE] bg-[#F9FAFB] text-xs font-bold text-[#6B7280]">
              <th className="px-3 py-2.5">{t('nameColumn')}</th>
              <th className="px-3 py-2.5">{t('attendanceStatus')}</th>
              <th className="px-3 py-2.5">{t('clockIn')}</th>
              <th className="px-3 py-2.5">{t('clockOut')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.worker_id}
                className="border-b border-[#F3F4F6] last:border-0"
              >
                <td className="px-3 py-2.5 font-medium text-[#111827]">
                  {workerNameById.get(row.worker_id) ?? '—'}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {statusOptions.map(([status, labelKey]) => (
                      <button
                        key={status}
                        type="button"
                        className={statusButtonClass(
                          row.status === status,
                          status,
                        )}
                        onClick={() => updateRow(row.worker_id, { status })}
                      >
                        {t(labelKey)}
                      </button>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <input
                    type="time"
                    value={row.start_time}
                    onChange={(e) =>
                      updateRow(row.worker_id, { start_time: e.target.value })
                    }
                    className={timeInputClass}
                    disabled={row.status === 'absent'}
                  />
                </td>
                <td className="px-3 py-2.5">
                  <input
                    type="time"
                    value={row.end_time}
                    onChange={(e) =>
                      updateRow(row.worker_id, { end_time: e.target.value })
                    }
                    className={timeInputClass}
                    disabled={row.status === 'absent'}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-[#6B7280]">
        {t('attendanceSummary', {
          present: stats.present,
          absent: stats.absent,
          overtime: stats.overtime,
        })}
      </p>

      <Button
        className="mt-3 w-full"
        variant="secondary"
        loading={saveMutation.isPending}
        disabled={!planId}
        onClick={() => saveMutation.mutate()}
      >
        {t('saveAttendance')}
      </Button>
      {!planId ? (
        <p className="mt-1 text-center text-[11px] text-[#9CA3AF]">
          {t('saveAttendanceHint')}
        </p>
      ) : null}
    </section>
  )
}
