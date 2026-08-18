import type { TaskKey } from '../constants/dailyPlan'

/** Primary course areas used in PDF 구역 column */
export type MapReportAreaType = 'green' | 'tee' | 'fairway'

export type CourseMapBounds = {
  west: number
  south: number
  east: number
  north: number
}

export type MapReportMark = {
  id: string
  title: string
  taskTypes: TaskKey[]
  workDate: string
  lat: number
  lng: number
  /** Optional free-text memo for this mark */
  note?: string
  /** Optional area — legacy marks may omit */
  areaType?: MapReportAreaType
  /** Korean primary labels for each task (for PDF) */
  titleKo?: string
  /** English secondary labels for each task (for PDF) */
  titleEn?: string
  /** Pin position on captured map image (0–100%) — preferred over bounds projection */
  mapX?: number
  mapY?: number
}

export type MapReportSyncStatus = 'pending' | 'synced' | 'failed'

export type MapWorkReport = {
  id: string
  courseId: string
  courseName: string
  /** Work / report date YYYY-MM-DD */
  workDate: string
  createdAt: string
  markCount: number
  marks: MapReportMark[]
  /** JPEG data URL of map snapshot (no baked-in pins; pins overlaid in PDF) */
  mapImageDataUrl: string
  /** Soft-capped size hint in bytes of the image data URL */
  imageBytesApprox: number
  /** Tile/course bounds for GPS→% pin projection (legacy reports may omit) */
  courseBounds?: CourseMapBounds
  /** True once the generated PDF blob is stored in IndexedDB */
  hasPdf?: boolean
  /**
   * Backend sync state.
   * - pending: local save exists; upload not confirmed
   * - failed: POST attempted and failed (retry banner)
   * - synced: confirmed on server (has serverId)
   * Absent on legacy pre-sync records — treat as pending until migrated.
   */
  syncStatus?: MapReportSyncStatus
  serverId?: string
  /** Server-hosted copies, used when this report originated on another device/platform. */
  serverImageUrl?: string
  serverPdfUrl?: string
  lastError?: string
}

/** Local-only row waiting for one-time upload to /map-reports/ */
export type MapReportMigrationCandidate = {
  id: string
  courseId: string
  courseName: string
  workDate: string
  createdAt: string
  markCount: number
  hasPdf: boolean
  /** IndexedDB has a map snapshot for this id (prerequisite for rebuild). */
  hasMapImage: boolean
  /** No stored PDF, but marks + map image are both present — a PDF can be
   * regenerated client-side (same fallback the PDF-preview button uses)
   * before uploading, instead of the migration just failing for this row. */
  canRebuild: boolean
  /** No stored PDF AND missing marks or map image — nothing left to upload. */
  missingCoreData: boolean
  syncStatus?: MapReportSyncStatus
  /** Message from the most recent failed upload attempt, if any. */
  lastError?: string
}

/** True when this device has no confirmed server copy yet (or POST failed). */
export function isMapReportUnsynced(report: MapWorkReport): boolean {
  if (report.syncStatus === 'failed') return true
  return !report.serverId
}
