import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { PlusIcon } from '@heroicons/react/24/outline'
import { fetchCourses } from '../api/courses'
import { ScanDetailView } from '../components/drone/ScanDetailView'
import { ScanList } from '../components/drone/ScanList'
import { UploadScanModal } from '../components/drone/UploadScanModal'
import { Button } from '../components/ui/Button'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'

const COURSE_STORAGE_KEY = 'greencare-drone-scan-course-id'

export function DroneScanPage() {
  const [courseId, setCourseId] = useState(
    () => localStorage.getItem(COURSE_STORAGE_KEY) ?? '',
  )
  const [selectedScanId, setSelectedScanId] = useState<string | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)

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
    return <LoadingSpinner message="골프장 목록 불러오는 중…" />
  }

  return (
    <div className="page-enter flex h-[calc(100vh-7rem)] min-h-[600px] flex-col gap-4">
      {/* Course selector */}
      <select
        value={courseId}
        onChange={(e) => {
          setCourseId(e.target.value)
          setSelectedScanId(null)
        }}
        className="h-10 w-full max-w-xs rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-all duration-150 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
      >
        {courses.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name_ko || c.name}
          </option>
        ))}
      </select>

      <div className="flex min-h-0 flex-1 gap-4">
        {/* ── Scan list panel ── */}
        <aside className="flex w-[320px] shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h1 className="text-base font-bold text-slate-900">드론 스캔</h1>
            <Button
              className="mt-3 w-full"
              icon={<PlusIcon className="h-4 w-4" />}
              onClick={() => setUploadOpen(true)}
            >
              새 스캔 업로드
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <ScanList
              courseId={courseId}
              selectedScanId={selectedScanId}
              onSelect={setSelectedScanId}
            />
          </div>
        </aside>

        {/* ── Detail panel ── */}
        <main className="min-w-0 flex-1 overflow-y-auto rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          {selectedScanId === null ? (
            <div className="flex h-full min-h-[400px] flex-col items-center justify-center text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-100 text-4xl">
                🛸
              </div>
              <p className="mt-5 text-base font-semibold text-slate-900">
                스캔을 선택하거나 새 스캔을 업로드하세요
              </p>
              <p className="mt-2 text-sm text-slate-400">
                왼쪽 목록에서 스캔을 선택하거나 업로드 버튼을 눌러주세요
              </p>
              <Button className="mt-6" onClick={() => setUploadOpen(true)}>
                새 스캔 업로드
              </Button>
            </div>
          ) : (
            <ScanDetailView scanId={selectedScanId} />
          )}
        </main>
      </div>

      <UploadScanModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        defaultCourseId={courseId}
        onSuccess={(scanId) => {
          setSelectedScanId(scanId)
          setUploadOpen(false)
        }}
      />
    </div>
  )
}
