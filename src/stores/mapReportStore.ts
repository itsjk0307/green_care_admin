import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  createMapReport,
  deleteMapReportRemote,
  getMapReports,
} from '../services/mapReportService'
import { devTerminalLog } from '../lib/devLog'
import type { MapPdfLabels } from '../lib/mapWorkPdf'
import type {
  MapReportMigrationCandidate,
  MapWorkReport,
} from '../types/mapReport'

type MapReportStore = {
  reports: MapWorkReport[]
  /** One-time local→server migration; null until dry-run runs. Never auto-uploads. */
  migrationDryRun: MapReportMigrationCandidate[] | null
  addReport: (
    report: Omit<MapWorkReport, 'id' | 'createdAt' | 'syncStatus'>,
    opts?: { id?: string },
  ) => MapWorkReport
  markPdfReady: (id: string) => void
  /** Online-required: uploads the already-generated image+PDF (from IndexedDB)
   * to the backend. Never throws — a failed upload comes back with
   * syncStatus "failed" for the caller/UI to surface. */
  syncReport: (id: string, opts?: { forceRebuildPdf?: boolean }) => Promise<MapWorkReport>
  /** Pull the authoritative list from the backend and merge into local state. */
  fetchReports: (
    courseId: string | undefined,
    resolveCourseName: (courseId: string) => string,
  ) => Promise<void>
  /**
   * Inspect local-only rows (no serverId) for a one-time migration dry-run.
   * Does NOT upload. Safe to call repeatedly.
   */
  runMigrationDryRun: () => Promise<MapReportMigrationCandidate[]>
  /**
   * Upload every local-only candidate. Call only after the user confirms
   * the dry-run. Uses each local id as client_id (idempotent).
   */
  migrateLocalOnlyReports: () => Promise<{
    uploaded: number
    failed: number
    results: MapWorkReport[]
  }>
  removeReport: (id: string) => void
  reportsForCourse: (courseId: string) => MapWorkReport[]
}

/** In-memory object URLs for instant PDF preview (survives tab switches) */
const pdfObjectUrls = new Map<string, string>()

export function peekCachedPdfUrl(id: string): string | null {
  return pdfObjectUrls.get(id) ?? null
}

export function forgetCachedPdfUrl(id: string): void {
  const url = pdfObjectUrls.get(id)
  if (url) {
    URL.revokeObjectURL(url)
    pdfObjectUrls.delete(id)
  }
}

function blobFromIdbValue(value: unknown): Blob | null {
  if (value instanceof Blob) {
    return value.type
      ? value
      : new Blob([value], { type: 'application/pdf' })
  }
  if (value instanceof ArrayBuffer) {
    return new Blob([value], { type: 'application/pdf' })
  }
  if (ArrayBuffer.isView(value)) {
    // IndexedDB structured-clone never produces a SharedArrayBuffer-backed
    // view; the cast satisfies BlobPart's stricter ArrayBuffer-only typing.
    return new Blob([value.buffer as ArrayBuffer], { type: 'application/pdf' })
  }
  return null
}

const MAX_REPORTS = 100
const IDB_NAME = 'greencare-map-reports'
const IDB_IMAGES = 'images'
const IDB_PDFS = 'pdfs'
const META_KEY = 'greencare-map-work-reports'

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 2)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(IDB_IMAGES)) {
        db.createObjectStore(IDB_IMAGES)
      }
      if (!db.objectStoreNames.contains(IDB_PDFS)) {
        db.createObjectStore(IDB_PDFS)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function saveMapImage(id: string, dataUrl: string): Promise<void> {
  const db = await openIDB()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_IMAGES, 'readwrite')
    tx.objectStore(IDB_IMAGES).put(dataUrl, id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function loadMapImage(id: string): Promise<string | null> {
  try {
    const db = await openIDB()
    const value = await new Promise<string | null>((resolve, reject) => {
      const tx = db.transaction(IDB_IMAGES, 'readonly')
      const req = tx.objectStore(IDB_IMAGES).get(id)
      req.onsuccess = () =>
        resolve(typeof req.result === 'string' ? req.result : null)
      req.onerror = () => reject(req.error)
    })
    db.close()
    return value
  } catch {
    return null
  }
}

export async function saveMapPdf(id: string, blob: Blob): Promise<void> {
  // ArrayBuffer survives IndexedDB structured-clone more reliably than Blob
  const buffer = await blob.arrayBuffer()
  const db = await openIDB()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_PDFS, 'readwrite')
    tx.objectStore(IDB_PDFS).put(buffer, id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
  forgetCachedPdfUrl(id)
  const url = URL.createObjectURL(
    new Blob([buffer], { type: 'application/pdf' }),
  )
  pdfObjectUrls.set(id, url)
}

export async function loadMapPdf(id: string): Promise<Blob | null> {
  try {
    const db = await openIDB()
    const value = await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction(IDB_PDFS, 'readonly')
      const req = tx.objectStore(IDB_PDFS).get(id)
      req.onsuccess = () => resolve(req.result ?? null)
      req.onerror = () => reject(req.error)
    })
    db.close()
    return blobFromIdbValue(value)
  } catch {
    return null
  }
}

/** Load stored PDF and return a reusable object URL (no rebuild). */
export async function getMapPdfObjectUrl(id: string): Promise<string | null> {
  const cached = pdfObjectUrls.get(id)
  if (cached) return cached
  const blob = await loadMapPdf(id)
  if (!blob || blob.size < 32) return null
  const url = URL.createObjectURL(blob)
  pdfObjectUrls.set(id, url)
  return url
}

async function deleteMapAssets(id: string): Promise<void> {
  try {
    const db = await openIDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([IDB_IMAGES, IDB_PDFS], 'readwrite')
      tx.objectStore(IDB_IMAGES).delete(id)
      tx.objectStore(IDB_PDFS).delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch {
    /* ignore */
  }
}

/** Strip heavy data URLs before writing localStorage metadata */
function withoutImages(reports: MapWorkReport[]): MapWorkReport[] {
  return reports.map((r) => ({
    ...r,
    mapImageDataUrl: '',
    imageBytesApprox: 0,
  }))
}

const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : 'Upload failed.'

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl)
  return res.blob()
}

function sortByCreatedAtDesc(reports: MapWorkReport[]): MapWorkReport[] {
  return [...reports].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}

/**
 * Ground-truth check against IndexedDB — `r.hasPdf` is a flag set at save
 * time and can go stale (e.g. cap eviction, manual IDB clearing), so the
 * dry-run verifies directly rather than trusting the cached boolean.
 */
async function assessCandidate(r: MapWorkReport): Promise<MapReportMigrationCandidate> {
  const [storedPdf, storedImage] = await Promise.all([
    loadMapPdf(r.id),
    loadMapImage(r.id),
  ])
  const hasPdf = Boolean(storedPdf && storedPdf.size > 32)
  const hasMapImage = Boolean(storedImage)
  const hasMarks = r.marks.length > 0
  return {
    id: r.id,
    courseId: r.courseId,
    courseName: r.courseName,
    workDate: r.workDate,
    createdAt: r.createdAt,
    markCount: r.markCount,
    hasPdf,
    hasMapImage,
    canRebuild: !hasPdf && hasMarks && hasMapImage,
    missingCoreData: !hasPdf && (!hasMarks || !hasMapImage),
    syncStatus: r.syncStatus,
    lastError: r.lastError,
  }
}

/** Minimal English labels for a migration-triggered rebuild — this PDF only
 * needs to faithfully preserve the underlying work record (marks/GPS/course),
 * not match the exact localized copy a live "Save PDF" click would produce. */
const MIGRATION_PDF_LABELS: MapPdfLabels = {
  locale: 'en',
  title: 'Course Work Report',
  brand: 'GreenCare',
  workDate: 'Work Date',
  markCount: 'Marks',
  markCountUnit: '',
  generatedAt: 'Generated',
  courseLabel: 'Course',
  marks: 'Marked Tasks',
  mapSection: 'Work Map',
  mapCaption: 'Numbers match the task list below',
  colNo: 'No',
  colWork: 'Task',
  colArea: 'Area',
  colGps: 'GPS',
  colDate: 'Date',
  noMarks: 'No tasks marked',
  coverFootLeft: 'Daejung Golf Engineering',
  coverFootRight: 'Auto-generated by GreenCare Admin',
  backLine1: 'This report was auto-generated by GreenCare Admin.',
  backLine2: 'Daejung Golf Engineering',
  pageFooter: 'GreenCare — Greenkeeping Work Report',
  areaGreen: 'Green',
  areaTee: 'Tee',
  areaFairway: 'Fairway',
  areaUnknown: '—',
  eyebrow: 'COURSE WORK REPORT',
  mapSubtitle: 'Pin numbers match the task list',
  backClose: 'End of report',
  statAreas: 'Work areas',
}

/**
 * Local-only = no confirmed server id yet (legacy pre-API rows, pending, or
 * failed uploads). These must never be silently discarded by the history cap.
 */
function isProtectedLocal(r: MapWorkReport): boolean {
  return !r.serverId || r.syncStatus === 'failed' || r.syncStatus === 'pending'
}

async function buildMapReportForm(
  report: {
    id: string
    courseId: string
    courseName: string
    workDate: string
    createdAt: string
    marks: MapWorkReport['marks']
    markCount: number
    courseBounds?: MapWorkReport['courseBounds']
  },
  opts?: { forceRebuildPdf?: boolean },
): Promise<FormData> {
  const [imageDataUrl, existingPdfBlob] = await Promise.all([
    loadMapImage(report.id),
    loadMapPdf(report.id),
  ])

  let pdfBlob =
    opts?.forceRebuildPdf || !existingPdfBlob ? null : existingPdfBlob
  if (!pdfBlob) {
    if (!imageDataUrl || report.marks.length === 0) {
      throw new Error(
        'No stored PDF, and not enough data to rebuild one (missing marks or map image).',
      )
    }
    const { buildMapWorkPdf } = await import('../lib/mapWorkPdf')
    pdfBlob = await buildMapWorkPdf({
      courseName: report.courseName,
      workDate: report.workDate,
      marks: report.marks,
      mapImageDataUrl: imageDataUrl,
      courseBounds: report.courseBounds,
      labels: MIGRATION_PDF_LABELS,
      generatedAt: report.createdAt,
    })
    await saveMapPdf(report.id, pdfBlob)
  }

  const form = new FormData()
  form.append('course_id', report.courseId)
  form.append('work_date', report.workDate)
  form.append('marks', JSON.stringify(report.marks))
  form.append('mark_count', String(report.markCount))
  // Idempotency key — safe to retry POST without creating duplicates.
  form.append('client_id', report.id)
  if (imageDataUrl) {
    const imageBlob = await dataUrlToBlob(imageDataUrl)
    form.append('map_image', imageBlob, `${report.id}.jpg`)
  }
  form.append('pdf_file', pdfBlob, `${report.id}.pdf`)
  return form
}

/**
 * Cap at MAX_REPORTS: sort by creation time FIRST, then slice.
 * Unsynced / failed locals are always retained so a sync retry stays possible.
 */
function capReports(combined: MapWorkReport[]): MapWorkReport[] {
  const sorted = sortByCreatedAtDesc(combined)
  const protectedRows = sorted.filter(isProtectedLocal)
  const rest = sorted.filter((r) => !isProtectedLocal(r))
  const keptRest = rest.slice(0, Math.max(MAX_REPORTS - protectedRows.length, 0))
  const keptIds = new Set(
    [...protectedRows, ...keptRest].map((r) => r.id),
  )
  for (const row of sorted) {
    if (!keptIds.has(row.id)) {
      void deleteMapAssets(row.id)
      forgetCachedPdfUrl(row.id)
    }
  }
  return sortByCreatedAtDesc([...protectedRows, ...keptRest])
}

export const useMapReportStore = create<MapReportStore>()(
  persist(
    (set, get) => ({
      reports: [],
      migrationDryRun: null,

      addReport: (input, opts) => {
        const id = opts?.id ?? crypto.randomUUID()
        const report: MapWorkReport = {
          ...input,
          id,
          createdAt: new Date().toISOString(),
          syncStatus: 'pending',
        }
        // Persist image in IndexedDB (localStorage too small for JPEGs)
        if (input.mapImageDataUrl) {
          void saveMapImage(report.id, input.mapImageDataUrl)
        }
        // Keep store/meta image-free; caller still gets full report for immediate PDF
        const meta: MapWorkReport = { ...report, mapImageDataUrl: '' }
        set((s) => ({
          reports: capReports([meta, ...withoutImages(s.reports)]),
        }))
        return report
      },

      markPdfReady: (id) => {
        set((s) => ({
          reports: s.reports.map((r) =>
            r.id === id ? { ...r, hasPdf: true } : r,
          ),
        }))
      },

      syncReport: async (id, opts) => {
        const report = get().reports.find((r) => r.id === id)
        if (!report) {
          throw new Error('Report not found.')
        }
        set({
          reports: get().reports.map((r) =>
            r.id === id
              ? { ...r, syncStatus: 'pending', lastError: undefined }
              : r,
          ),
        })
        try {
          const form = await buildMapReportForm(report, opts)
          const record = await createMapReport(form)
          const updated: MapWorkReport = {
            ...report,
            syncStatus: 'synced',
            serverId: record.id,
            serverImageUrl: record.map_image_url ?? undefined,
            serverPdfUrl: record.pdf_url ?? undefined,
            lastError: undefined,
            hasPdf: true,
          }
          const nextReports = get().reports.map((r) =>
            r.id === id ? updated : r,
          )
          set({
            reports: nextReports,
            // Now synced — drop it from the local-only dry-run list.
            migrationDryRun: (get().migrationDryRun ?? []).filter(
              (c) => c.id !== id,
            ),
          })
          devTerminalLog('info', '[map-reports] POST /map-reports/ OK', {
            client_id: id,
            serverId: record.id,
            courseId: report.courseId,
            workDate: report.workDate,
          })
          return updated
        } catch (err) {
          const failed: MapWorkReport = {
            ...report,
            syncStatus: 'failed',
            lastError: errorMessage(err),
          }
          set({
            reports: get().reports.map((r) => (r.id === id ? failed : r)),
          })
          devTerminalLog('error', '[map-reports] POST /map-reports/ failed', {
            client_id: id,
            courseId: report.courseId,
            workDate: report.workDate,
            error: errorMessage(err),
          })
          return failed
        }
      },

      fetchReports: async (courseId, resolveCourseName) => {
        const { reports: records } = await getMapReports(courseId)
        const fetchedClientIds = new Set(records.map((rec) => rec.client_id))

        // Start from current local rows, then overlay / add server authority.
        const byClientId = new Map(get().reports.map((r) => [r.id, r] as const))
        for (const rec of records) {
          const existing = byClientId.get(rec.client_id)
          if (existing) {
            byClientId.set(rec.client_id, {
              ...existing,
              courseId: rec.course_id,
              workDate: rec.work_date,
              createdAt: rec.created_at || existing.createdAt,
              markCount: rec.mark_count,
              marks:
                (rec.marks as MapWorkReport['marks'])?.length > 0
                  ? (rec.marks as MapWorkReport['marks'])
                  : existing.marks,
              syncStatus: 'synced',
              serverId: rec.id,
              serverImageUrl: rec.map_image_url ?? undefined,
              serverPdfUrl: rec.pdf_url ?? undefined,
              lastError: undefined,
              hasPdf: existing.hasPdf || Boolean(rec.pdf_url),
              courseName:
                existing.courseName || resolveCourseName(rec.course_id),
            })
          } else {
            // Authored on a different device/platform — no local IndexedDB assets yet.
            byClientId.set(rec.client_id, {
              id: rec.client_id,
              courseId: rec.course_id,
              courseName: resolveCourseName(rec.course_id),
              workDate: rec.work_date,
              createdAt: rec.created_at,
              markCount: rec.mark_count,
              marks: rec.marks as MapWorkReport['marks'],
              mapImageDataUrl: '',
              imageBytesApprox: 0,
              syncStatus: 'synced',
              serverId: rec.id,
              serverImageUrl: rec.map_image_url ?? undefined,
              serverPdfUrl: rec.pdf_url ?? undefined,
              hasPdf: Boolean(rec.pdf_url),
            })
          }
        }

        // Reconcile deletions that happened elsewhere: drop reports that were
        // previously confirmed synced for THIS course but are no longer on
        // the server. Never touches other courses (out of scope for this
        // fetch) or unsynced reports (this device's only copy).
        for (const [clientId, r] of byClientId) {
          const inScope = courseId === undefined || r.courseId === courseId
          if (
            inScope &&
            r.syncStatus === 'synced' &&
            r.serverId &&
            !fetchedClientIds.has(clientId)
          ) {
            void deleteMapAssets(clientId)
            forgetCachedPdfUrl(clientId)
            byClientId.delete(clientId)
          }
        }

        const next = capReports(Array.from(byClientId.values()))
        const dry = await Promise.all(
          next.filter((r) => !r.serverId).map(assessCandidate),
        )
        set({ reports: next, migrationDryRun: dry })
      },

      runMigrationDryRun: async () => {
        const locals = get().reports.filter((r) => !r.serverId)
        const candidates = (await Promise.all(locals.map(assessCandidate))).sort(
          (a, b) => (a.createdAt < b.createdAt ? 1 : -1),
        )
        set({ migrationDryRun: candidates })
        const summary = candidates.map((c) => ({
          id: c.id,
          course: c.courseName || c.courseId,
          workDate: c.workDate,
          createdAt: c.createdAt,
          markCount: c.markCount,
          hasPdf: c.hasPdf,
          hasMapImage: c.hasMapImage,
          canRebuild: c.canRebuild,
          missingCoreData: c.missingCoreData,
          syncStatus: c.syncStatus ?? 'pending',
        }))
        devTerminalLog('info', '[map-reports] migration dry-run (no upload)', {
          count: candidates.length,
          hasPdfAlready: candidates.filter((c) => c.hasPdf).length,
          canRebuild: candidates.filter((c) => c.canRebuild).length,
          missingCoreData: candidates.filter((c) => c.missingCoreData).length,
          candidates: summary,
        })
        if (import.meta.env.DEV) {
          console.info('[map-reports] migration dry-run', candidates.length, summary)
        }
        return candidates
      },

      migrateLocalOnlyReports: async () => {
        const candidates = await get().runMigrationDryRun()
        const results: MapWorkReport[] = []
        let uploaded = 0
        let failed = 0
        for (const c of candidates) {
          if (c.missingCoreData) {
            const report = get().reports.find((r) => r.id === c.id)
            if (report) results.push(report)
            failed += 1
            continue
          }
          const updated = await get().syncReport(c.id, { forceRebuildPdf: true })
          results.push(updated)
          if (updated.syncStatus === 'synced') uploaded += 1
          else failed += 1
        }
        await get().runMigrationDryRun()
        return { uploaded, failed, results }
      },

      removeReport: (id) => {
        const existing = get().reports.find((r) => r.id === id)
        forgetCachedPdfUrl(id)
        void deleteMapAssets(id)
        if (existing?.serverId) {
          void deleteMapReportRemote(existing.serverId).catch(() => undefined)
        }
        set((s) => ({
          reports: s.reports.filter((r) => r.id !== id),
          migrationDryRun: (s.migrationDryRun ?? []).filter((c) => c.id !== id),
        }))
      },

      reportsForCourse: (courseId) =>
        get().reports.filter((r) => r.courseId === courseId),
    }),
    {
      name: META_KEY,
      // Never persist base64 images into localStorage
      partialize: (state) => ({
        reports: withoutImages(state.reports),
      }),
      merge: (persisted, current) => {
        const p = persisted as { reports?: MapWorkReport[] } | undefined
        const reports = Array.isArray(p?.reports) ? p.reports : current.reports
        // Normalize legacy rows (no syncStatus / no serverId) as pending so
        // the UI surfaces them until migration or a successful POST.
        const normalized = withoutImages(reports).map((r) => {
          if (r.serverId && r.syncStatus !== 'failed') {
            return { ...r, syncStatus: 'synced' as const }
          }
          if (!r.serverId && r.syncStatus !== 'failed') {
            return { ...r, syncStatus: 'pending' as const }
          }
          return r
        })
        return {
          ...current,
          reports: normalized,
        }
      },
      storage: {
        getItem: (name) => {
          try {
            const raw = localStorage.getItem(name)
            if (!raw) return null
            // Bloated legacy payloads with embedded JPEGs — drop them
            if (raw.length > 1_500_000) {
              localStorage.removeItem(name)
              return null
            }
            return JSON.parse(raw) as {
              state: { reports: MapWorkReport[] }
              version?: number
            }
          } catch {
            localStorage.removeItem(name)
            return null
          }
        },
        setItem: (name, value) => {
          try {
            localStorage.setItem(name, JSON.stringify(value))
          } catch {
            // Quota — keep only newest lightweight meta
            try {
              const slim = {
                ...value,
                state: {
                  ...value.state,
                  reports: withoutImages(value.state.reports ?? []).slice(0, 5),
                },
              }
              localStorage.setItem(name, JSON.stringify(slim))
            } catch {
              localStorage.removeItem(name)
            }
          }
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    },
  ),
)
