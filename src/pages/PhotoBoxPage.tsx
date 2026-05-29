import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Squares2X2Icon, ListBulletIcon } from '@heroicons/react/24/outline'
import { fetchCourses } from '../api/courses'
import { ApiError } from '../api/client'
import { HolePhotoSummary } from '../components/photobox/HolePhotoSummary'
import { PhotoLightbox } from '../components/photobox/PhotoLightbox'
import { Button } from '../components/ui/Button'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { formatKoreanScanDate, todayLocalDate } from '../lib/formatScanDate'
import { getPhotos, photoThumbnail } from '../services/photoService'
import type { PhotoFilters, PhotoTypeFilter, WorkPhoto } from '../types/photo'

const COURSE_STORAGE_KEY = 'greencare-photobox-course-id'

type ViewMode = 'grid' | 'list'

const TYPE_FILTERS: { key: PhotoTypeFilter; label: string }[] = [
  { key: null, label: '전체' },
  { key: 'before', label: '작업전' },
  { key: 'after', label: '작업후' },
]

const inputClass =
  'h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 outline-none transition-all duration-150 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 cursor-pointer'

function PhotoGridSkeleton() {
  return (
    <div className="columns-2 gap-3 sm:columns-3 lg:columns-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="mb-3 h-40 animate-pulse break-inside-avoid rounded-xl bg-slate-200"
        />
      ))}
    </div>
  )
}

function PhotoCard({ photo, onClick }: { photo: WorkPhoto; onClick: () => void }) {
  const src = photoThumbnail(photo)
  const date = photo.taken_at ?? photo.created_at
  const workTypes = photo.work_types?.join(', ') ?? '—'

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative mb-3 w-full break-inside-avoid overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm transition-all duration-200 hover:shadow-md"
    >
      {src ? (
        <img
          src={src}
          alt=""
          className="block w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <div className="flex h-40 items-center justify-center bg-slate-100 text-slate-400">
          No image
        </div>
      )}
      <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/75 via-black/20 to-transparent p-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        <p className="text-sm font-bold text-white">{photo.hole_number}홀</p>
        <p className="text-xs text-white/90">{formatKoreanScanDate(date)}</p>
        <p className="text-xs text-white/80">{photo.worker_name ?? '—'}</p>
        <p className="truncate text-xs text-white/70">{workTypes}</p>
      </div>
    </button>
  )
}

export function PhotoBoxPage() {
  const photosRef = useRef<HTMLDivElement>(null)
  const [courseId, setCourseId] = useState(
    () => localStorage.getItem(COURSE_STORAGE_KEY) ?? '',
  )
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState(todayLocalDate())
  const [holeFilter, setHoleFilter] = useState<number | null>(null)
  const [typeFilter, setTypeFilter] = useState<PhotoTypeFilter>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [page, setPage] = useState(1)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const coursesQuery = useQuery({ queryKey: ['courses'], queryFn: fetchCourses })
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

  const filters: PhotoFilters = useMemo(
    () => ({
      from_date: fromDate || null,
      to_date: toDate || null,
      hole_number: holeFilter,
      photo_type: typeFilter,
    }),
    [fromDate, toDate, holeFilter, typeFilter],
  )

  const photosQuery = useQuery({
    queryKey: ['photos', courseId, filters, page],
    queryFn: () => getPhotos(courseId, filters, page),
    enabled: Boolean(courseId),
  })

  useEffect(() => {
    if (photosQuery.isError) {
      const message =
        photosQuery.error instanceof ApiError
          ? photosQuery.error.message
          : '사진을 불러오지 못했습니다.'
      toast.error(message, { className: 'gc-toast-error' })
    }
  }, [photosQuery.isError, photosQuery.error])

  const photos = photosQuery.data?.items ?? []
  const totalPages = photosQuery.data?.total_pages ?? 1

  function handleHoleSelect(hole: number) {
    setHoleFilter(hole)
    setPage(1)
    photosRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  if (coursesQuery.isLoading) {
    return <LoadingSpinner message="불러오는 중…" />
  }

  return (
    <div className="page-enter mx-auto max-w-[1400px] space-y-5">
      {/* ── Filter bar ── */}
      <div className="flex flex-wrap items-end gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
            골프장
          </label>
          <select
            value={courseId}
            onChange={(e) => {
              setCourseId(e.target.value)
              setPage(1)
              setHoleFilter(null)
            }}
            className={`${inputClass} min-w-[170px]`}
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name_ko || c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
            기간
          </label>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setPage(1) }}
              className={inputClass}
            />
            <span className="text-slate-400">–</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => { setToDate(e.target.value); setPage(1) }}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
            홀
          </label>
          <select
            value={holeFilter ?? ''}
            onChange={(e) => {
              setHoleFilter(e.target.value ? Number(e.target.value) : null)
              setPage(1)
            }}
            className={`${inputClass} min-w-[100px]`}
          >
            <option value="">전체</option>
            {Array.from({ length: 18 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>{n}홀</option>
            ))}
          </select>
        </div>

        {/* Type filter pills */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
            유형
          </label>
          <div className="flex gap-1.5">
            {TYPE_FILTERS.map((t) => (
              <button
                key={t.key ?? 'all'}
                type="button"
                onClick={() => { setTypeFilter(t.key); setPage(1) }}
                className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-all duration-150 ${
                  typeFilter === t.key
                    ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* View mode toggle */}
        <div className="ml-auto flex gap-1">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`rounded-xl border p-2 transition-all duration-150 ${
              viewMode === 'grid'
                ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                : 'border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
            aria-label="그리드 보기"
          >
            <Squares2X2Icon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`rounded-xl border p-2 transition-all duration-150 ${
              viewMode === 'list'
                ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                : 'border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
            aria-label="목록 보기"
          >
            <ListBulletIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      <HolePhotoSummary
        courseId={courseId}
        selectedHole={holeFilter}
        onHoleSelect={handleHoleSelect}
      />

      {/* ── Photos section ── */}
      <section
        ref={photosRef}
        className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
      >
        <h2 className="mb-4 text-sm font-semibold text-slate-900">사진</h2>

        {photosQuery.isLoading ? (
          <PhotoGridSkeleton />
        ) : photos.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-sm text-slate-400">사진이 없습니다</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="columns-2 gap-3 sm:columns-3 lg:columns-4">
            {photos.map((photo, index) => (
              <PhotoCard
                key={photo.id}
                photo={photo}
                onClick={() => setLightboxIndex(index)}
              />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-400">미리보기</th>
                  <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-400">홀</th>
                  <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-400">날짜</th>
                  <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-400">작업자</th>
                  <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-400">유형</th>
                  <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-400">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {photos.map((photo, index) => (
                  <tr
                    key={photo.id}
                    className="cursor-pointer transition-colors hover:bg-emerald-50/50"
                    onClick={() => setLightboxIndex(index)}
                  >
                    <td className="px-3 py-2.5">
                      <img
                        src={photoThumbnail(photo)}
                        alt=""
                        className="h-12 w-16 rounded-lg object-cover"
                      />
                    </td>
                    <td className="px-3 py-2.5 text-sm font-semibold text-slate-900">
                      {photo.hole_number}홀
                    </td>
                    <td className="px-3 py-2.5 text-sm text-slate-500">
                      {formatKoreanScanDate(photo.taken_at ?? photo.created_at)}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-slate-700">
                      {photo.worker_name ?? '—'}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-slate-500">
                      {photo.photo_type === 'before'
                        ? '작업전'
                        : photo.photo_type === 'after'
                          ? '작업후'
                          : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-slate-500">
                      {photo.work_types?.join(', ') ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 ? (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-1.5">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              이전
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p)}
                className={`h-9 min-w-[36px] rounded-xl border px-2 text-sm font-medium transition-all duration-150 ${
                  page === p
                    ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                }`}
              >
                {p}
              </button>
            ))}
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              다음
            </Button>
          </div>
        ) : null}
      </section>

      {lightboxIndex !== null ? (
        <PhotoLightbox
          photos={photos}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
        />
      ) : null}
    </div>
  )
}
