import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import {
  completionDotClass,
  formatMonthLabel,
  monthKey,
} from '../../lib/journalUi'
import { getMonthlyJournal } from '../../services/journalService'
import { todayLocalDate } from '../../lib/formatScanDate'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import type { MonthlyJournalDay } from '../../types/journal'

type Props = {
  courseId: string
  selectedDate: string
  onDateSelect: (date: string) => void
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

function buildCalendarCells(year: number, month: number) {
  const first = new Date(year, month - 1, 1)
  const last = new Date(year, month, 0)
  const startPad = first.getDay()
  const daysInMonth = last.getDate()
  const cells: (number | null)[] = []

  for (let i = 0; i < startPad; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  return cells
}

export function MonthlyCalendar({
  courseId,
  selectedDate,
  onDateSelect,
}: Props) {
  const [viewDate, setViewDate] = useState(() => new Date())
  const currentMonth = monthKey(viewDate)
  const today = todayLocalDate()

  const query = useQuery({
    queryKey: ['journal-monthly', courseId, currentMonth],
    queryFn: () => getMonthlyJournal(courseId, currentMonth),
    enabled: Boolean(courseId),
  })

  const dayMap = useMemo(() => {
    const map = new Map<string, MonthlyJournalDay>()
    query.data?.days.forEach((d) => map.set(d.date.slice(0, 10), d))
    return map
  }, [query.data?.days])

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth() + 1
  const cells = buildCalendarCells(year, month)

  function shiftMonth(delta: number) {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1))
  }

  function dateIso(day: number): string {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  return (
    <div className="rounded-2xl border border-[#EEEEEE] bg-white p-4 shadow-[var(--shadow-gc-card)]">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          className="rounded-lg p-2 text-[#6B7280] hover:bg-[#F3F4F6]"
          aria-label="이전 달"
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </button>
        <h2 className="text-sm font-bold text-[#111827]">
          {formatMonthLabel(currentMonth)}
        </h2>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          className="rounded-lg p-2 text-[#6B7280] hover:bg-[#F3F4F6]"
          aria-label="다음 달"
        >
          <ChevronRightIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-[#9CA3AF]">
        {WEEKDAYS.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>

      {query.isLoading ? (
        <LoadingSpinner message="달력 불러오는 중…" />
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, index) => {
            if (day === null) {
              return <div key={`empty-${index}`} className="aspect-square" />
            }

            const iso = dateIso(day)
            const info = dayMap.get(iso)
            const isSelected = selectedDate === iso
            const isToday = today === iso
            const dotClass = info
              ? completionDotClass(info.completion_percent, info.has_plan)
              : ''

            return (
              <button
                key={iso}
                type="button"
                onClick={() => onDateSelect(iso)}
                className={`relative flex aspect-square flex-col items-center justify-center rounded-lg text-sm font-semibold transition ${
                  isSelected
                    ? 'bg-[#1B5E20] text-white'
                    : 'text-[#374151] hover:bg-[#F9FAFB]'
                } ${isToday && !isSelected ? 'ring-2 ring-[#1B5E20] ring-offset-1' : ''}`}
              >
                {day}
                {dotClass ? (
                  <span
                    className={`absolute bottom-1 h-1.5 w-1.5 rounded-full ${dotClass} ${
                      isSelected ? 'bg-white' : ''
                    }`}
                  />
                ) : null}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
