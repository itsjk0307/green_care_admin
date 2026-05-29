import { apiBlobRequest, apiRequest } from '../api/client'
import type { DailyJournal, MonthlyJournal } from '../types/journal'

export function getDailyJournal(courseId: string, date: string) {
  const params = new URLSearchParams({ course_id: courseId, date })
  return apiRequest<DailyJournal>(`/journal/daily?${params}`)
}

export function getMonthlyJournal(courseId: string, month: string) {
  const params = new URLSearchParams({ course_id: courseId, month })
  return apiRequest<MonthlyJournal>(`/journal/monthly?${params}`)
}

export async function exportJournal(
  courseId: string,
  fromDate: string,
  toDate: string,
) {
  const blob = await apiBlobRequest('/journal/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      course_id: courseId,
      from_date: fromDate,
      to_date: toDate,
      format: 'excel',
    }),
  })

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `greencare-journal_${fromDate}_${toDate}.xlsx`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
