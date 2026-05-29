import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { fetchCourses } from '../api/courses'
import { DailyJournalView } from '../components/journal/DailyJournalView'
import { MonthlyCalendar } from '../components/journal/MonthlyCalendar'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { todayLocalDate } from '../lib/formatScanDate'

const COURSE_STORAGE_KEY = 'greencare-journal-course-id'

export function JournalPage() {
  const [courseId, setCourseId] = useState(
    () => localStorage.getItem(COURSE_STORAGE_KEY) ?? '',
  )
  const [selectedDate, setSelectedDate] = useState(todayLocalDate())

  const coursesQuery = useQuery({
    queryKey: ['courses'],
    queryFn: fetchCourses,
  })

  const courses = coursesQuery.data ?? []

  useEffect(() => {
    if (!courses.length) return
    if (!courseId || !courses.some((c) => c.id === courseId)) {
      const active = courses.find((c) => c.is_active) ?? courses[0]
      setCourseId(active.id)
    }
  }, [courses, courseId])

  useEffect(() => {
    if (courseId) localStorage.setItem(COURSE_STORAGE_KEY, courseId)
  }, [courseId])

  if (coursesQuery.isLoading) {
    return <LoadingSpinner message="불러오는 중…" />
  }

  return (
    <div className="page-enter flex h-[calc(100vh-7rem)] min-h-[640px] flex-col gap-4">
      {/* Course selector */}
      <select
        value={courseId}
        onChange={(e) => setCourseId(e.target.value)}
        className="h-10 w-full max-w-xs rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-all duration-150 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
      >
        {courses.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name_ko || c.name}
          </option>
        ))}
      </select>

      <div className="flex min-h-0 flex-1 gap-4">
        {/* ── Calendar sidebar ── */}
        <aside className="w-[280px] shrink-0 overflow-y-auto rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <MonthlyCalendar
            courseId={courseId}
            selectedDate={selectedDate}
            onDateSelect={setSelectedDate}
          />
        </aside>

        {/* ── Journal content ── */}
        <main className="min-w-0 flex-1 overflow-y-auto rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <DailyJournalView courseId={courseId} date={selectedDate} />
        </main>
      </div>
    </div>
  )
}
