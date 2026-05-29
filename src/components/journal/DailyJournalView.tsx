import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { ApiError } from '../../api/client'
import {
  attendanceStatusClass,
  attendanceStatusLabel,
  formatKoreanJournalDate,
  weatherEmoji,
  zoneStatusBadge,
  zoneStatusLabel,
} from '../../lib/journalUi'
import { getDailyJournal } from '../../services/journalService'
import { Button } from '../ui/Button'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { ExcelExportModal } from './ExcelExportModal'

type Props = {
  courseId: string
  date: string
}

export function DailyJournalView({ courseId, date }: Props) {
  const [exportOpen, setExportOpen] = useState(false)

  const query = useQuery({
    queryKey: ['journal-daily', courseId, date],
    queryFn: () => getDailyJournal(courseId, date),
    enabled: Boolean(courseId) && Boolean(date),
  })

  if (!courseId) {
    return (
      <p className="text-sm text-[#6B7280]">골프장을 선택하세요.</p>
    )
  }

  if (query.isLoading) {
    return <LoadingSpinner message="일지 불러오는 중…" />
  }

  if (query.isError) {
    const message =
      query.error instanceof ApiError
        ? query.error.message
        : '일지를 불러오지 못했습니다.'
    return <p className="text-sm text-[#DC2626]">{message}</p>
  }

  const journal = query.data
  if (!journal) {
    return (
      <p className="rounded-xl border border-dashed border-[#E5E7EB] py-12 text-center text-sm text-[#6B7280]">
        해당 날짜의 일지가 없습니다.
      </p>
    )
  }

  const zoneTasks = journal.zone_tasks ?? []
  const attendance = journal.attendance ?? []
  const issues = journal.issues_summary

  const present = attendance.filter((a) => a.status === 'present').length
  const absent = attendance.filter((a) => a.status === 'absent').length
  const overtime = attendance.filter((a) => a.status === 'overtime').length

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-[#111827]">
          {formatKoreanJournalDate(date)}
        </h1>
        <Button variant="secondary" onClick={() => setExportOpen(true)}>
          Excel 다운로드
        </Button>
      </div>

      <section className="rounded-2xl border border-[#EEEEEE] bg-white p-5 shadow-[var(--shadow-gc-card)]">
        <h2 className="mb-3 text-sm font-bold text-[#1B5E20]">날씨 정보</h2>
        <div className="flex flex-wrap items-center gap-4 text-sm text-[#374151]">
          <span className="text-2xl" aria-hidden>
            {weatherEmoji(journal.weather)}
          </span>
          <span>{journal.weather ?? '—'}</span>
          <span>
            기온:{' '}
            {journal.temperature_min != null && journal.temperature_max != null
              ? `최저 ${journal.temperature_min}°C / 최고 ${journal.temperature_max}°C`
              : '—'}
          </span>
          <span>
            강수량:{' '}
            {journal.rainfall_mm != null ? `${journal.rainfall_mm}mm` : '—'}
          </span>
        </div>
      </section>

      <section className="rounded-2xl border border-[#EEEEEE] bg-white p-5 shadow-[var(--shadow-gc-card)]">
        <h2 className="mb-3 text-sm font-bold text-[#1B5E20]">전달사항</h2>
        <div
          className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${
            journal.special_notes?.trim()
              ? 'bg-[#F9FAFB] text-[#374151]'
              : 'bg-[#F3F4F6] text-[#9CA3AF]'
          }`}
        >
          {journal.special_notes?.trim() || '전달사항 없음'}
        </div>
      </section>

      <section className="rounded-2xl border border-[#EEEEEE] bg-white p-5 shadow-[var(--shadow-gc-card)]">
        <h2 className="mb-3 text-sm font-bold text-[#1B5E20]">구역별 작업 현황</h2>
        {zoneTasks.length === 0 ? (
          <p className="text-sm text-[#6B7280]">등록된 작업이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#EEEEEE] text-xs font-bold text-[#6B7280]">
                  <th className="px-3 py-2">구역</th>
                  <th className="px-3 py-2">작업내용</th>
                  <th className="px-3 py-2">예초높이</th>
                  <th className="px-3 py-2">담당자</th>
                  <th className="px-3 py-2">상태</th>
                  <th className="px-3 py-2">완료시간</th>
                </tr>
              </thead>
              <tbody>
                {zoneTasks.map((task, i) => (
                  <tr key={task.id ?? i} className="border-b border-[#F3F4F6]">
                    <td className="px-3 py-2 font-medium text-[#1B5E20]">
                      {task.zone_label ?? task.zone}
                    </td>
                    <td className="px-3 py-2">
                      {task.task_types.join(', ') || '—'}
                    </td>
                    <td className="px-3 py-2">
                      {task.mowing_height_mm != null
                        ? `${task.mowing_height_mm} mm`
                        : '—'}
                    </td>
                    <td className="px-3 py-2">
                      {(task.assigned_worker_names ?? task.assigned_workers)?.join(
                        ', ',
                      ) ?? '—'}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${zoneStatusBadge(task.status)}`}
                      >
                        {zoneStatusLabel(task.status)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[#6B7280]">
                      {task.completed_at
                        ? new Date(task.completed_at).toLocaleTimeString('ko-KR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-[#EEEEEE] bg-white p-5 shadow-[var(--shadow-gc-card)]">
        <h2 className="mb-3 text-sm font-bold text-[#1B5E20]">근태 현황</h2>
        {attendance.length === 0 ? (
          <p className="text-sm text-[#6B7280]">근태 기록이 없습니다.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[#EEEEEE] text-xs font-bold text-[#6B7280]">
                    <th className="px-3 py-2">성명</th>
                    <th className="px-3 py-2">출근상태</th>
                    <th className="px-3 py-2">출근시간</th>
                    <th className="px-3 py-2">퇴근시간</th>
                    <th className="px-3 py-2">근무시간</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.map((row) => (
                    <tr key={row.worker_id} className="border-b border-[#F3F4F6]">
                      <td className="px-3 py-2 font-medium">{row.worker_name}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${attendanceStatusClass(row.status)}`}
                        >
                          {attendanceStatusLabel(row.status)}
                        </span>
                      </td>
                      <td className="px-3 py-2">{row.start_time ?? '—'}</td>
                      <td className="px-3 py-2">{row.end_time ?? '—'}</td>
                      <td className="px-3 py-2">
                        {row.working_hours != null
                          ? `${row.working_hours}시간`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 rounded-lg bg-[#F9FAFB] px-3 py-2 text-xs font-semibold text-[#374151]">
              출근 {present}명 · 결근 {absent}명 · 연장 {overtime}명
            </p>
          </>
        )}
      </section>

      <section className="rounded-2xl border border-[#EEEEEE] bg-white p-5 shadow-[var(--shadow-gc-card)]">
        <h2 className="mb-3 text-sm font-bold text-[#1B5E20]">이슈 현황</h2>
        <ul className="space-y-2 text-sm text-[#374151]">
          <li>신규 이슈: {issues?.new_count ?? 0}건</li>
          <li>해결된 이슈: {issues?.resolved_count ?? 0}건</li>
          <li>촬영 사진: {issues?.photo_count ?? 0}장</li>
        </ul>
      </section>

      <ExcelExportModal
        open={exportOpen}
        courseId={courseId}
        onClose={() => setExportOpen(false)}
      />
    </div>
  )
}
