import {
  ArrowPathIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  MapIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import toast from 'react-hot-toast'
import { fetchCourses } from '../../api/courses'
import { taskLabel } from '../../constants/dailyPlan'
import { courseDisplayName } from '../../lib/courseName'
import {
  buildMapPdfLabels,
  buildMapWorkPdf,
  mapWorkPdfFilename,
} from '../../lib/mapWorkPdf'
import { resolveMapReportFileUrl } from '../../services/mapReportService'
import { useLanguageStore } from '../../stores/languageStore'
import {
  getMapPdfObjectUrl,
  loadMapImage,
  peekCachedPdfUrl,
  saveMapPdf,
  useMapReportStore,
} from '../../stores/mapReportStore'
import { isMapReportUnsynced, type MapWorkReport } from '../../types/mapReport'
import { Button } from '../ui/Button'

function formatWorkDate(dateStr: string, language: string): string {
  const raw = (dateStr ?? '').slice(0, 10)
  if (!raw) return '—'
  const d = new Date(`${raw}T12:00:00`)
  if (Number.isNaN(d.getTime())) return raw
  return d.toLocaleDateString(language === 'ko' ? 'ko-KR' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function uniqueTaskKeys(marks: MapReportMark[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const m of marks) {
    for (const key of m.taskTypes ?? []) {
      if (!key || seen.has(key)) continue
      seen.add(key)
      out.push(key)
    }
  }
  return out
}

function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return
    const scrollY = window.scrollY
    const scrollbar =
      window.innerWidth - document.documentElement.clientWidth
    const { body } = document
    const prev = {
      overflow: body.style.overflow,
      paddingRight: body.style.paddingRight,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
    }
    body.style.overflow = 'hidden'
    body.style.paddingRight = scrollbar > 0 ? `${scrollbar}px` : prev.paddingRight
    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.width = '100%'
    return () => {
      body.style.overflow = prev.overflow
      body.style.paddingRight = prev.paddingRight
      body.style.position = prev.position
      body.style.top = prev.top
      body.style.width = prev.width
      window.scrollTo(0, scrollY)
    }
  }, [locked])
}

type Props = {
  embedded?: boolean
  courseId?: string
  fromDate?: string
  toDate?: string
  searchQuery?: string
}

export function MapWorkReportsSection({
  embedded = false,
  courseId = '',
  fromDate = '',
  toDate = '',
  searchQuery = '',
}: Props) {
  const { t, language } = useLanguageStore()
  const reports = useMapReportStore((s) => s.reports)
  const removeReport = useMapReportStore((s) => s.removeReport)
  const markPdfReady = useMapReportStore((s) => s.markPdfReady)
  const fetchReports = useMapReportStore((s) => s.fetchReports)
  const syncReport = useMapReportStore((s) => s.syncReport)
  const runMigrationDryRun = useMapReportStore((s) => s.runMigrationDryRun)
  const migrationDryRun = useMapReportStore((s) => s.migrationDryRun)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const [marksPreview, setMarksPreview] = useState<MapWorkReport | null>(null)
  const [pendingDelete, setPendingDelete] = useState<MapWorkReport | null>(null)
  const [imageById, setImageById] = useState<Record<string, string>>({})
  /** ids with a stored PDF ready for instant open */
  const [pdfReadyIds, setPdfReadyIds] = useState<Record<string, true>>({})

  const coursesQuery = useQuery({ queryKey: ['courses'], queryFn: fetchCourses })
  const courses = coursesQuery.data ?? []
  const resolveCourseName = (id: string): string => {
    const course = courses.find((c) => c.id === id)
    return course ? courseDisplayName(course, language) : id
  }

  useEffect(() => {
    // Dry-run only — never auto-uploads local backlog.
    runMigrationDryRun()
    fetchReports(courseId || undefined, resolveCourseName)
      .catch(() => {
        // Fetch failure keeps the local cache; unsynced banners cover offline.
      })
      .finally(() => {
        runMigrationDryRun()
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, courses.length])

  const handleRetry = async (report: MapWorkReport) => {
    setRetryingId(report.id)
    try {
      const updated = await syncReport(report.id)
      if (updated.syncStatus === 'failed') {
        toast.error(t('mapReportRetryFailed'), { className: 'gc-toast-error' })
      } else {
        toast.success(t('mapReportRetrySucceeded'), { className: 'gc-toast-success' })
      }
    } finally {
      setRetryingId(null)
    }
  }

  const sorted = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return [...reports]
      .filter((r) => {
        if (courseId && r.courseId !== courseId) return false
        if (fromDate && r.workDate < fromDate) return false
        if (toDate && r.workDate > toDate) return false
        if (!q) return true
        const markText = r.marks
          .map(
            (m) =>
              `${m.title} ${m.titleKo ?? ''} ${m.titleEn ?? ''} ${m.note ?? ''}`,
          )
          .join(' ')
        const hay = `${r.courseName} ${r.workDate} ${markText}`.toLowerCase()
        return hay.includes(q)
      })
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  }, [reports, courseId, fromDate, toDate, searchQuery])

  useBodyScrollLock(pendingDelete != null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const next: Record<string, string> = {}
      await Promise.all(
        sorted.map(async (r) => {
          if (r.mapImageDataUrl) {
            next[r.id] = r.mapImageDataUrl
            return
          }
          const img = await loadMapImage(r.id)
          if (img) next[r.id] = img
        }),
      )
      if (!cancelled) setImageById(next)
    })()
    return () => {
      cancelled = true
    }
  }, [sorted])

  const reportIdsKey = sorted.map((r) => r.id).join(',')

  // Prefetch stored PDFs into memory so opening is instant (no rebuild)
  useEffect(() => {
    if (!reportIdsKey) return
    let cancelled = false
    const ids = reportIdsKey.split(',').filter(Boolean)
    void (async () => {
      const ready: Record<string, true> = {}
      for (const id of ids) {
        const url = await getMapPdfObjectUrl(id)
        if (url) ready[id] = true
        if (cancelled) return
      }
      if (!cancelled) {
        setPdfReadyIds((prev) => ({ ...prev, ...ready }))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [reportIdsKey])

  function withImage(report: MapWorkReport): MapWorkReport {
    return {
      ...report,
      mapImageDataUrl: imageById[report.id] || report.mapImageDataUrl || '',
    }
  }

  function thumbnailSrc(report: MapWorkReport): string {
    const local = imageById[report.id] || report.mapImageDataUrl
    if (local) return local
    if (report.serverImageUrl) return resolveMapReportFileUrl(report.serverImageUrl)
    return ''
  }

  async function handleOpenPdf(report: MapWorkReport) {
    const filename = mapWorkPdfFilename(report.courseName, report.workDate)

    // Instant path: already in memory
    const hot = peekCachedPdfUrl(report.id)
    if (hot) {
      window.open(hot, '_blank')
      return
    }

    setBusyId(report.id)
    try {
      let url = await getMapPdfObjectUrl(report.id)
      if (url) {
        setPdfReadyIds((prev) => ({ ...prev, [report.id]: true }))
        if (!report.hasPdf) markPdfReady(report.id)
        window.open(url, '_blank')
        return
      }

      if (report.serverPdfUrl) {
        const resp = await fetch(resolveMapReportFileUrl(report.serverPdfUrl))
        if (resp.ok) {
          const blob = await resp.blob()
          await saveMapPdf(report.id, blob)
          if (!report.hasPdf) markPdfReady(report.id)
          url = peekCachedPdfUrl(report.id) ?? URL.createObjectURL(blob)
          setPdfReadyIds((prev) => ({ ...prev, [report.id]: true }))
          window.open(url, '_blank')
          return
        }
      }

      const full = withImage(report)
      if (!full.mapImageDataUrl) {
        const img = await loadMapImage(report.id)
        if (img) full.mapImageDataUrl = img
      }
      const blob = await buildMapWorkPdf({
        courseName: resolveCourseName(full.courseId) || full.courseName,
        workDate: full.workDate,
        marks: full.marks,
        mapImageDataUrl: full.mapImageDataUrl || null,
        courseBounds: full.courseBounds,
        labels: buildMapPdfLabels(t, language),
        generatedAt: full.createdAt || new Date().toISOString(),
      })
      await saveMapPdf(report.id, blob)
      markPdfReady(report.id)
      url = peekCachedPdfUrl(report.id) ?? URL.createObjectURL(blob)
      setPdfReadyIds((prev) => ({ ...prev, [report.id]: true }))
      window.open(url, '_blank')
    } catch {
      toast.error(t('mapPdfFailed'), { className: 'gc-toast-error' })
    } finally {
      setBusyId(null)
    }
  }

  function handleConfirmDelete() {
    if (!pendingDelete) return
    const id = pendingDelete.id
    removeReport(id)
    setPdfReadyIds((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    if (marksPreview?.id === id) setMarksPreview(null)
    setPendingDelete(null)
    toast.success(t('mapReportDeleted'), { className: 'gc-toast-success' })
  }

  useEffect(() => {
    if (!pendingDelete) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setPendingDelete(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pendingDelete])

  const empty = (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-10 text-center">
      <MapIcon className="mx-auto h-8 w-8 text-slate-300" />
      <p className="mt-3 text-sm font-semibold text-slate-700">
        {t('mapReportHistoryEmpty')}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        {reports.length === 0
          ? t('mapReportHistoryEmptyHint')
          : t('reportListEmptyHint')}
      </p>
    </div>
  )

  if (sorted.length === 0 && !marksPreview) {
    const migrationBanner =
      migrationDryRun && migrationDryRun.length > 0 ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3">
          <p className="text-sm font-bold text-amber-900">
            {t('mapReportMigrationTitle')}
          </p>
          <p className="mt-1 text-xs text-amber-800">
            {t('mapReportMigrationMessage', { n: migrationDryRun.length })}
          </p>
          <p className="mt-1 text-[11px] font-medium text-amber-700">
            {t('mapReportMigrationWaiting')}
          </p>
          <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-[11px] text-amber-900/90">
            {migrationDryRun.map((c) => (
              <li key={c.id} className="flex flex-col gap-0.5">
                <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                  <span className="font-semibold">{c.courseName || c.courseId}</span>
                  <span>· {c.workDate}</span>
                  <span className="text-amber-700/80">
                    · {new Date(c.createdAt).toLocaleString()}
                  </span>
                  <span className="text-amber-700/70">
                    ·{' '}
                    {c.hasPdf
                      ? 'has stored PDF'
                      : c.canRebuild
                        ? 'no stored PDF — rebuildable from marks+image'
                        : 'no stored PDF — missing marks or map image'}
                    {' · '}
                    {c.markCount} marks
                  </span>
                </div>
                {c.lastError ? (
                  <span className="text-red-700/90">↳ last error: {c.lastError}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null

    const body = (
      <div className="space-y-3">
        {migrationBanner}
        {empty}
      </div>
    )

    return embedded ? body : (
      <div className="space-y-3">
        <div>
          <h2 className="text-[15px] font-bold text-slate-900">
            {t('mapReportHistoryTitle')}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {t('mapReportHistoryHint')}
          </p>
        </div>
        {body}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {embedded ? null : (
        <div>
          <h2 className="text-[15px] font-bold text-slate-900">
            {t('mapReportHistoryTitle')}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">{t('mapReportHistoryHint')}</p>
        </div>
      )}

      {migrationDryRun && migrationDryRun.length > 0 ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3">
          <p className="text-sm font-bold text-amber-900">
            {t('mapReportMigrationTitle')}
          </p>
          <p className="mt-1 text-xs text-amber-800">
            {t('mapReportMigrationMessage', { n: migrationDryRun.length })}
          </p>
          <p className="mt-1 text-[11px] font-medium text-amber-700">
            {t('mapReportMigrationWaiting')}
          </p>
          <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-[11px] text-amber-900/90">
            {migrationDryRun.map((c) => (
              <li key={c.id} className="flex flex-col gap-0.5">
                <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                  <span className="font-semibold">{c.courseName || c.courseId}</span>
                  <span>· {c.workDate}</span>
                  <span className="text-amber-700/80">
                    · {new Date(c.createdAt).toLocaleString()}
                  </span>
                  <span className="text-amber-700/70">
                    ·{' '}
                    {c.hasPdf
                      ? 'has stored PDF'
                      : c.canRebuild
                        ? 'no stored PDF — rebuildable from marks+image'
                        : 'no stored PDF — missing marks or map image'}
                    {' · '}
                    {c.markCount} marks
                  </span>
                </div>
                {c.lastError ? (
                  <span className="text-red-700/90">↳ last error: {c.lastError}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {sorted.length === 0 ? empty : (
        <ul className="space-y-2">
          {sorted.map((report) => {
            const unsynced = isMapReportUnsynced(report)
            const thumb = thumbnailSrc(report)
            return (
              <li
                key={report.id}
                className={`flex flex-col gap-3 rounded-2xl border bg-white p-3 ${
                  unsynced ? 'border-red-300' : 'border-slate-200'
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setMarksPreview(withImage(report))}
                      className="h-14 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100"
                    >
                      {thumb ? (
                        <img
                          src={thumb}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="flex h-full items-center justify-center text-slate-300">
                          <MapIcon className="h-6 w-6" />
                        </span>
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#121820]">
                        MAP WORK
                      </p>
                      <p className="mt-0.5 truncate text-[15px] font-bold text-slate-900">
                        {formatWorkDate(report.workDate, language)}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {[
                          report.courseName || null,
                          t('mapReportMarkCount', { n: report.markCount }),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                      {(() => {
                        const taskKeys = uniqueTaskKeys(report.marks ?? [])
                        const visible = taskKeys.slice(0, 3)
                        const extra = taskKeys.length - visible.length
                        if (visible.length === 0) return null
                        return (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {visible.map((key) => (
                              <span
                                key={key}
                                className="inline-block rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600"
                              >
                                {taskLabel(key, language)}
                              </span>
                            ))}
                            {extra > 0 && (
                              <span className="inline-block rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                                +{extra}
                              </span>
                            )}
                          </div>
                        )
                      })()}
                    </div>

                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        disabled={busyId === report.id}
                        onClick={() => void handleOpenPdf(report)}
                        className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#121820] px-3 text-xs font-semibold text-white hover:bg-[#1e2a36] disabled:opacity-50 sm:flex-none"
                        title={
                          pdfReadyIds[report.id] || report.hasPdf
                            ? t('mapReportPdfPreview')
                            : t('mapPdfSave')
                        }
                      >
                        {busyId === report.id ? (
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                        ) : (
                          <DocumentTextIcon className="h-4 w-4" />
                        )}
                        Open PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(report)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-500"
                        title={t('taskZoneDelete')}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {unsynced ? (
                  <div className="flex items-center gap-3 rounded-xl bg-amber-50 p-3">
                    <ExclamationTriangleIcon className="h-5 w-5 shrink-0 text-red-500" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-red-600">
                        {t('mapReportSyncFailedTitle')}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {t('mapReportSyncFailedMessage')}
                      </p>
                      {report.lastError ? (
                        <p className="mt-1 truncate text-[11px] text-red-500/90">
                          {report.lastError}
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      disabled={retryingId === report.id}
                      onClick={() => void handleRetry(report)}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-red-500 px-3 py-2 text-xs font-bold text-white hover:bg-red-600 disabled:opacity-60"
                    >
                      <ArrowPathIcon
                        className={`h-3.5 w-3.5 ${retryingId === report.id ? 'animate-spin' : ''}`}
                      />
                      {retryingId === report.id
                        ? t('mapReportRetrying')
                        : t('mapReportRetry')}
                    </button>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}

      {pendingDelete
        ? createPortal(
            <div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="map-pdf-delete-title"
              className="fixed top-1/2 z-[90] w-[min(100%-2rem,360px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-5 shadow-[var(--shadow-gc-modal)]"
              style={{
                left: 'calc(var(--gc-sidebar-width, 0px) + (100vw - var(--gc-sidebar-width, 0px)) / 2)',
              }}
            >
              <h2
                id="map-pdf-delete-title"
                className="text-base font-semibold text-slate-900"
              >
                {t('mapReportDeleteConfirmTitle')}
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                {pendingDelete.courseName} ({pendingDelete.workDate})
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {t('mapReportDeleteConfirmBody')}
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setPendingDelete(null)}
                >
                  {t('taskZoneCancel')}
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={handleConfirmDelete}
                >
                  {t('mapReportDeleteConfirm')}
                </Button>
              </div>
            </div>,
            document.body,
          )
        : null}


      {marksPreview ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[1px]"
          onClick={() => setMarksPreview(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div>
                <p className="font-semibold text-slate-900">
                  {marksPreview.courseName}
                </p>
                <p className="text-xs text-slate-500">{marksPreview.workDate}</p>
              </div>
              <button
                type="button"
                onClick={() => setMarksPreview(null)}
                className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-50"
              >
                ✕
              </button>
            </div>
            <div className="max-h-[calc(90vh-4rem)] overflow-y-auto p-4">
              {thumbnailSrc(marksPreview) ? (
                <img
                  src={thumbnailSrc(marksPreview)}
                  alt=""
                  className="w-full rounded-xl border border-slate-100"
                />
              ) : null}
              <ul className="mt-4 space-y-2">
                {marksPreview.marks.map((m, i) => (
                  <li
                    key={m.id}
                    className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
                  >
                    <span className="font-semibold text-slate-800">
                      {i + 1}. {m.titleKo || m.title}
                      {m.titleEn ? (
                        <span className="ml-2 text-[11px] font-normal text-slate-500">
                          {m.titleEn}
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-slate-500">
                      {m.lat.toFixed(5)}, {m.lng.toFixed(5)}
                      {m.areaType ? ` · ${m.areaType}` : ''}
                    </span>
                    {m.note?.trim() ? (
                      <span className="mt-1.5 block rounded-lg border border-slate-200 bg-[#f4f5f7] px-2.5 py-1.5 text-[12px] leading-snug text-slate-700">
                        <span className="font-semibold text-[#121820]">
                          {t('mapPdfNote')}:{' '}
                        </span>
                        {m.note.trim()}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
