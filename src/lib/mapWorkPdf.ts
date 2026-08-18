/**
 * Course map work PDF — jsPDF output via HTML template → html2canvas.
 * Method: jsPDF (not Puppeteer / window.print / react-pdf).
 */
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import L from 'leaflet'
import type { Map as LeafletMap } from 'leaflet'
import { TASK_TYPES, type TaskKey } from '../constants/dailyPlan'
import { translations } from '../i18n/translations'
import { colorForTasks } from '../stores/taskZoneStore'
import type {
  CourseMapBounds,
  MapReportAreaType,
  MapReportMark,
  MapWorkReport,
} from '../types/mapReport'

let circleLogoCache: string | null | undefined
let circleLogoReady: Promise<string | null> | null = null

function blobToDataUrl(blob: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () =>
      resolve(typeof reader.result === 'string' ? reader.result : null)
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(blob)
  })
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('logo image failed'))
    img.src = src
  })
}

/**
 * Build a clean circular PNG for PDF:
 * - loads favicon (woven mark on black)
 * - paints onto transparent canvas
 * - keys out near-black background so it sits cleanly on white paper
 */
async function prepareCircleLogoPng(srcDataUrl: string): Promise<string | null> {
  try {
    const img = await loadImageElement(srcDataUrl)
    const size = 256
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return srcDataUrl

    // Draw source into square
    ctx.clearRect(0, 0, size, size)
    ctx.drawImage(img, 0, 0, size, size)

    const imageData = ctx.getImageData(0, 0, size, size)
    const d = imageData.data
    const cx = size / 2
    const cy = size / 2
    const r = size / 2 - 2

    let minX = size
    let minY = size
    let maxX = 0
    let maxY = 0

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4
        const dx = x - cx
        const dy = y - cy
        const dist = Math.sqrt(dx * dx + dy * dy)
        // Outside circle → transparent
        if (dist > r) {
          d[i + 3] = 0
          continue
        }
        // Near-black background inside → transparent
        const lum = (d[i]! + d[i + 1]! + d[i + 2]!) / 3
        if (lum < 28) {
          d[i + 3] = 0
          continue
        }
        if (d[i + 3]! > 8) {
          if (x < minX) minX = x
          if (y < minY) minY = y
          if (x > maxX) maxX = x
          if (y > maxY) maxY = y
        }
      }
    }
    ctx.putImageData(imageData, 0, 0)

    // Re-center opaque artwork so it optically sits mid-line with brand text
    if (maxX > minX && maxY > minY) {
      const bw = maxX - minX + 1
      const bh = maxY - minY + 1
      const pad = Math.round(size * 0.08)
      const cropped = document.createElement('canvas')
      cropped.width = size
      cropped.height = size
      const cctx = cropped.getContext('2d')
      if (cctx) {
        cctx.clearRect(0, 0, size, size)
        const scale = (size - pad * 2) / Math.max(bw, bh)
        const dw = bw * scale
        const dh = bh * scale
        const dx = (size - dw) / 2
        const dy = (size - dh) / 2
        cctx.drawImage(canvas, minX, minY, bw, bh, dx, dy, dw, dh)
        return cropped.toDataURL('image/png')
      }
    }

    return canvas.toDataURL('image/png')
  } catch {
    return srcDataUrl
  }
}

async function loadCircleLogoDataUrl(): Promise<string | null> {
  if (circleLogoCache !== undefined) return circleLogoCache
  if (!circleLogoReady) {
    circleLogoReady = (async () => {
      try {
        const response = await fetch('/favicon.png')
        if (!response.ok) return null
        const blob = await response.blob()
        const raw = await blobToDataUrl(blob)
        if (!raw) return null
        return await prepareCircleLogoPng(raw)
      } catch {
        return null
      }
    })()
  }
  circleLogoCache = await circleLogoReady
  return circleLogoCache
}

// ── Leaflet capture (tiles only; pins overlaid in PDF HTML) ───────────────


function fetchableTileUrl(src: string): string {
  try {
    const url = new URL(src, window.location.origin)
    const tilesMatch = url.pathname.match(/\/(?:storage\/)?tiles\/(.+)/)
    if (tilesMatch && import.meta.env.DEV) {
      return `/tiles/${tilesMatch[1]}${url.search}`
    }
    return url.href
  } catch {
    return src
  }
}

async function drawTileFromUrl(
  ctx: CanvasRenderingContext2D,
  src: string,
  x: number,
  y: number,
  w: number,
  h: number,
): Promise<void> {
  const fetchUrl = fetchableTileUrl(src)
  try {
    const res = await fetch(fetchUrl, { mode: 'cors', credentials: 'omit' })
    // Missing drone tiles (404) are normal at edges — skip quietly
    if (!res.ok) return
    const blob = await res.blob()
    if (!blob.type.startsWith('image/') && blob.size < 32) return
    const bitmap = await createImageBitmap(blob)
    try {
      ctx.drawImage(bitmap, x, y, w, h)
    } finally {
      bitmap.close()
    }
  } catch {
    /* skip */
  }
}

async function drawTilePane(
  ctx: CanvasRenderingContext2D,
  container: HTMLElement,
  mapRect: DOMRect,
): Promise<void> {
  const imgs = [
    ...container.querySelectorAll('.leaflet-tile-pane img'),
  ] as HTMLImageElement[]

  for (const img of imgs) {
    if (!img.src || !img.complete || img.naturalWidth === 0) continue
    const r = img.getBoundingClientRect()
    if (
      r.right < mapRect.left ||
      r.left > mapRect.right ||
      r.bottom < mapRect.top ||
      r.top > mapRect.bottom
    ) {
      continue
    }
    // Draw directly from the loaded <img> element (avoids CORS re-fetch issues)
    try {
      ctx.drawImage(
        img,
        r.left - mapRect.left,
        r.top - mapRect.top,
        r.width,
        r.height,
      )
    } catch {
      // CORS-tainted img — fall back to re-fetch
      await drawTileFromUrl(
        ctx,
        img.src,
        r.left - mapRect.left,
        r.top - mapRect.top,
        r.width,
        r.height,
      )
    }
  }
}

async function waitForVisibleTiles(container: HTMLElement): Promise<void> {
  const deadline = Date.now() + 4000
  while (Date.now() < deadline) {
    const imgs = [
      ...container.querySelectorAll('.leaflet-tile-pane img'),
    ] as HTMLImageElement[]
    if (imgs.length === 0) {
      await new Promise((r) => setTimeout(r, 120))
      continue
    }
    const pending = imgs.filter((img) => !img.complete || img.naturalWidth === 0)
    if (pending.length === 0) break
    await Promise.all(
      pending.map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete) {
              resolve()
              return
            }
            img.addEventListener('load', () => resolve(), { once: true })
            img.addEventListener('error', () => resolve(), { once: true })
          }),
      ),
    )
    break
  }
  await new Promise((r) => setTimeout(r, 100))
}

export type CaptureMark = {
  lat: number
  lng: number
  color: string
  points?: Array<[number, number]>
}


/** Capture basemap JPEG and return viewport % for each mark (for PDF pins).
 *  Reads tile image URLs and fetches them to an offscreen canvas — zero DOM
 *  cloning, zero map repositioning, zero UI flash. */
export async function captureLeafletMap(
  map: LeafletMap,
  marks: CaptureMark[] = [],
  _options?: {
    courseBounds?: [[number, number], [number, number]]
  },
): Promise<{ dataUrl: string; markPercents: Array<{ mapX: number; mapY: number }> }> {
  const container = map.getContainer()
  await waitForVisibleTiles(container)

  const size = map.getSize()
  const markPercents = marks.map((m) => {
    const p = map.latLngToContainerPoint([m.lat, m.lng])
    return {
      mapX: Math.min(100, Math.max(0, (p.x / size.x) * 100)),
      mapY: Math.min(100, Math.max(0, (p.y / size.y) * 100)),
    }
  })

  const mapRect = container.getBoundingClientRect()
  const width = Math.max(1, Math.round(mapRect.width))
  const height = Math.max(1, Math.round(mapRect.height))
  const scale = Math.min(2, window.devicePixelRatio || 1)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')
  ctx.scale(scale, scale)
  ctx.fillStyle = '#f4f6f3'
  ctx.fillRect(0, 0, width, height)
  await drawTilePane(ctx, container, mapRect)
  const raw = canvas.toDataURL('image/jpeg', 0.82)
  return {
    dataUrl: await compressMapJpeg(raw, 1280, 0.72),
    markPercents,
  }
}

export function estimateImageBytes(dataUrl: string): number {
  const i = dataUrl.indexOf(',')
  const b64 = i >= 0 ? dataUrl.slice(i + 1) : dataUrl
  return Math.round((b64.length * 3) / 4)
}

/** Downscale/compress JPEG for storage + PDF embedding */
export async function compressMapJpeg(
  dataUrl: string,
  maxWidth = 1280,
  quality = 0.72,
): Promise<string> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('compress load failed'))
      el.src = dataUrl
    })
    const scale = Math.min(1, maxWidth / img.naturalWidth)
    const w = Math.max(1, Math.round(img.naturalWidth * scale))
    const h = Math.max(1, Math.round(img.naturalHeight * scale))
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const ctx = c.getContext('2d')
    if (!ctx) return dataUrl
    ctx.fillStyle = '#f4f6f3'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(img, 0, 0, w, h)
    return c.toDataURL('image/jpeg', quality)
  } catch {
    return dataUrl
  }
}
// ── Localization helpers ──────────────────────────────────────────────────

export type MapPdfLabels = {
  locale: 'ko' | 'en'
  title: string
  brand: string
  workDate: string
  markCount: string
  markCountUnit: string
  generatedAt: string
  courseLabel: string
  marks: string
  mapSection: string
  mapCaption: string
  colNo: string
  colWork: string
  colArea: string
  colGps: string
  colDate: string
  noMarks: string
  coverFootLeft: string
  coverFootRight: string
  backLine1: string
  backLine2: string
  pageFooter: string
  areaGreen: string
  areaTee: string
  areaFairway: string
  areaUnknown: string
  eyebrow: string
  mapSubtitle: string
  backClose: string
  statAreas: string
}

/** Build PDF chrome strings from the active UI language. */
export function buildMapPdfLabels(
  t: (key: keyof typeof translations.ko) => string,
  locale: 'ko' | 'en',
): MapPdfLabels {
  return {
    locale,
    title: t('mapPdfTitle'),
    brand: t('mapPdfBrand'),
    workDate: t('taskZoneDate'),
    markCount: t('mapPdfMarkCountLabel'),
    markCountUnit: t('mapPdfMarkCountUnit'),
    generatedAt: t('mapPdfGenerated'),
    courseLabel: t('mapPdfCourseLabel'),
    marks: t('mapPdfMarks'),
    mapSection: t('mapPdfMapPage'),
    mapCaption: t('mapPdfMapCaption'),
    mapSubtitle: t('mapPdfMapSubtitle'),
    colNo: t('mapPdfColNo'),
    colWork: t('mapPdfColWork'),
    colArea: t('mapPdfColArea'),
    colGps: t('mapPdfLatLng'),
    colDate: t('taskZoneDate'),
    noMarks: t('mapPdfNoMarks'),
    coverFootLeft: t('mapPdfCoverFootLeft'),
    coverFootRight: t('mapPdfCoverFootRight'),
    backLine1: t('mapPdfCoverFooter'),
    backLine2: t('mapPdfBackLine2'),
    pageFooter: t('mapPdfPageFooter'),
    areaGreen: t('zoneGreen'),
    areaTee: t('zoneTee'),
    areaFairway: t('zoneFairway'),
    areaUnknown: '—',
    eyebrow: t('mapPdfEyebrow'),
    backClose: t('mapPdfBackClose'),
    statAreas: t('mapPdfStatAreas'),
  }
}

export function taskLabelPair(keys: TaskKey[]): { ko: string; en: string } {
  const koParts: string[] = []
  const enParts: string[] = []
  for (const key of keys) {
    const meta = TASK_TYPES.find((t) => t.key === key)
    if (meta) {
      koParts.push(translations.ko[meta.labelKey])
      enParts.push(translations.en[meta.labelKey])
    } else {
      koParts.push(key)
    }
  }
  return { ko: koParts.join(', '), en: enParts.join(', ') }
}

function areaLabel(
  area: MapReportAreaType | undefined,
  labels: MapPdfLabels,
): string {
  if (area === 'green') return labels.areaGreen
  if (area === 'tee') return labels.areaTee
  if (area === 'fairway') return labels.areaFairway
  return labels.areaUnknown
}

function areaBadgeClass(area: MapReportAreaType | undefined): string {
  if (area === 'green') return 'badge-green'
  if (area === 'tee') return 'badge-tee'
  if (area === 'fairway') return 'badge-fw'
  return 'badge-na'
}

function formatGeneratedAt(isoOrLocal: string): string {
  const d = new Date(isoOrLocal)
  if (Number.isNaN(d.getTime())) return isoOrLocal
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day} ${hh}:${mm}`
}

function formatTableDate(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd)
  if (!m) return ymd
  return `${m[2]}-${m[3]}`
}

export function gpsToPercent(
  lat: number,
  lng: number,
  b: CourseMapBounds,
): { left: string; top: string } {
  const xSpan = b.east - b.west || 1
  const ySpan = b.north - b.south || 1
  const left = Math.min(100, Math.max(0, ((lng - b.west) / xSpan) * 100))
  const top = Math.min(100, Math.max(0, ((b.north - lat) / ySpan) * 100))
  return { left: `${left.toFixed(2)}%`, top: `${top.toFixed(2)}%` }
}

function markColor(m: MapReportMark): string {
  return colorForTasks(m.taskTypes ?? [])
}

function markTitle(m: MapReportMark, locale: 'ko' | 'en'): string {
  const pair = m.taskTypes?.length ? taskLabelPair(m.taskTypes) : null
  if (locale === 'en') {
    const en = (m.titleEn || '').trim()
    if (en) return en
    if (pair?.en) return pair.en
    return (m.title || '').trim() || '—'
  }
  const ko = (m.titleKo || '').trim()
  if (ko) return ko
  if (pair?.ko) return pair.ko
  return (m.title || '').trim() || '—'
}

/** Map+table fits more rows without icon stats */
const ROWS_FIRST_CONTENT = 7
const ROWS_PER_PAGE = 11

function chunkMarksForPages(marks: MapReportMark[]): {
  chunks: MapReportMark[][]
  offsets: number[]
} {
  if (marks.length === 0) return { chunks: [[]], offsets: [0] }
  const chunks: MapReportMark[][] = []
  const offsets: number[] = []
  const first = marks.slice(0, ROWS_FIRST_CONTENT)
  chunks.push(first)
  offsets.push(0)
  for (let i = first.length; i < marks.length; i += ROWS_PER_PAGE) {
    chunks.push(marks.slice(i, i + ROWS_PER_PAGE))
    offsets.push(i)
  }
  return { chunks, offsets }
}

// ── Corporate emerald tokens ──────────────────────────────────────────────
const EM_950 = '#0B3D33'
const EM_800 = '#115547'
const EM_600 = '#1B6B58'
const EM_100 = '#DCEBE6'
const MIST = '#F4F8F6'
const WHITE = '#FFFFFF'
const INK = '#1C2422'
const INK_SOFT = '#68736E'
const HAIR = '#E3EAE6'
const MARKER = '#E07812' // deeper amber — white digits stay readable in PDF
/** A4 @ 96dpi */
const PAGE_W = 794
const PAGE_H = 1123
/** 16mm margins */
const M = 60

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Geometric overlay — very quiet stroke polygons (premium, not busy).
 */
function geoOverlay(mirror = false, idPrefix = 'g'): string {
  const transform = mirror ? 'transform="scale(-1,1) translate(-210,0)"' : ''
  return `
<svg class="geo" viewBox="0 0 210 297" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" ${transform} preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="${idPrefix}-fill" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${EM_950}"/>
      <stop offset="48%" stop-color="${EM_800}"/>
      <stop offset="100%" stop-color="${EM_600}"/>
    </linearGradient>
  </defs>
  <rect width="210" height="297" fill="url(#${idPrefix}-fill)"/>
  <g fill="none" stroke="#FFFFFF" stroke-width="0.8">
    <polygon points="140,-20 230,40 200,120" stroke-opacity="0.06"/>
    <polygon points="160,90 240,160 190,230" stroke-opacity="0.05"/>
    <polygon points="-20,200 70,230 30,300" stroke-opacity="0.05"/>
  </g>
  <polygon fill="#FFFFFF" fill-opacity="0.025" points="155,-10 220,50 210,110"/>
</svg>`
}

function styleBlock(): string {
  return `
:root{
  --em-950:${EM_950};--em-800:${EM_800};--em-600:${EM_600};--em-100:${EM_100};
  --mist:${MIST};--white:${WHITE};--ink:${INK};--ink-soft:${INK_SOFT};
  --hair:${HAIR};--marker:${MARKER};
  --hero:linear-gradient(135deg,${EM_950} 0%,${EM_800} 48%,${EM_600} 100%);
}
*{margin:0;padding:0;box-sizing:border-box}
.gc-pdf-root{
  font-family:"Pretendard Variable",Pretendard,"Noto Sans KR",sans-serif;
  color:var(--ink);
  -webkit-print-color-adjust:exact;print-color-adjust:exact;color-adjust:exact;
  background:#fff;
}
.mono{font-family:"IBM Plex Mono","Noto Sans KR",monospace;
  font-variant-numeric:tabular-nums;font-feature-settings:"tnum" 1}
.nowrap{white-space:nowrap}
.page{
  width:${PAGE_W}px;height:${PAGE_H}px;overflow:hidden;position:relative;
  background:#fff;display:flex;flex-direction:column;page-break-after:always;
}
.geo{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0}

/* ── Cover ── */
.cover{background:var(--hero);color:#fff;padding:${M}px}
.cover-top{position:relative;z-index:1;display:flex;align-items:center;gap:9px;height:22px}
.cover-top .brand-logo{
  width:20px;height:20px;border-radius:50%;object-fit:contain;display:block;
  flex-shrink:0;align-self:center;transform:translateY(1.5px);
}
.cover-top .brand-word{
  font-size:12px;font-weight:700;letter-spacing:.22em;color:#fff;
  line-height:22px;height:22px;display:flex;align-items:center;
}
.cover-center{
  position:relative;z-index:1;flex:1;display:flex;flex-direction:column;
  justify-content:center;max-width:520px;
}
.cover-eyebrow{font-size:11px;letter-spacing:.24em;color:rgba(220,235,230,.9);font-weight:600;margin-bottom:18px}
.cover-title{font-size:34px;font-weight:700;letter-spacing:-.025em;line-height:1.25;color:#fff}
.cover-course{font-size:18px;font-weight:500;color:rgba(255,255,255,.88);margin-top:14px}
.cover-rule{width:40px;height:2px;background:rgba(255,255,255,.55);margin:22px 0 18px;border:0}
.cover-meta{font-size:13px;color:rgba(255,255,255,.78);line-height:1.7;font-weight:500}
.cover-meta .mono{font-weight:600;color:rgba(255,255,255,.92)}
.cover-foot{
  position:relative;z-index:1;display:flex;align-items:center;
  font-size:12px;color:rgba(255,255,255,.85);font-weight:500;
}
.company-mark{display:inline-flex;align-items:center;gap:8px;line-height:1;height:18px}
.company-mark .company-logo{
  width:18px;height:18px;display:block;object-fit:contain;flex-shrink:0;border-radius:50%;
  transform:translateY(1px);
}
.company-mark .company-name{display:flex;align-items:center;line-height:18px;height:18px}

/* ── Content ── */
.content{background:#fff;padding:${M}px ${M}px 44px}
.accent-line{height:2px;width:100%;background:var(--em-800);flex-shrink:0;margin:0 0 22px}
.run-head{
  display:flex;justify-content:space-between;align-items:baseline;
  padding-bottom:12px;margin-bottom:20px;border-bottom:1px solid var(--hair);
}
.run-head b{font-size:15px;font-weight:700;color:var(--em-950)}
.run-head .meta{font-size:12px;color:var(--ink-soft);font-weight:500}
.map-card{
  width:100%;border:1px solid var(--hair);border-radius:8px;overflow:hidden;
  background:#F7FAF8;aspect-ratio:16/9;position:relative;
}
.map-card .map-rel{position:absolute;inset:0}
.map-card .map-rel>img{width:100%;height:100%;display:block;object-fit:cover;object-position:center}
.pin{
  position:absolute;transform:translate(-50%,-50%);width:14px;height:14px;border-radius:50%;
  background:var(--marker);border:2px solid #fff;
  box-shadow:0 1px 4px rgba(0,0,0,.3);
}
.map-meta{
  margin-top:12px;font-size:12px;color:var(--ink-soft);font-weight:500;
  display:flex;gap:14px;align-items:center;
}
.map-meta .sep{opacity:.35}
.section-gap{margin-top:26px}
.section-title{font-size:13px;font-weight:700;color:var(--em-950);margin-bottom:12px;letter-spacing:.02em}
.work-card{border-top:1px solid var(--em-950);background:#fff;padding-top:2px}
.work-card table{width:100%;border-collapse:collapse;table-layout:fixed}
.work-card thead th{
  background:transparent;color:#5A6460;font-size:10px;letter-spacing:.1em;
  font-weight:700;text-align:left;padding:12px 10px 10px 0;border-bottom:1px solid var(--hair);
  text-transform:uppercase;
}
.work-card thead th.col-no,.work-card thead th.col-date{text-align:center}
.work-card tbody td{
  padding:16px 10px 16px 0;border-bottom:1px solid var(--hair);font-size:13px;vertical-align:middle;
}
.work-card tbody tr:last-child td{border-bottom:0}
.col-no{width:36px;text-align:center;vertical-align:middle !important}
.col-area{width:70px}
.col-gps{width:118px}
.col-date{width:58px;text-align:center;white-space:nowrap;font-size:12px !important;
  color:#3D4743 !important;font-weight:600}
.dot-mark{
  display:inline-block;width:12px;height:12px;border-radius:50%;
  box-shadow:0 0 0 2px #fff,0 0 0 3px rgba(0,0,0,.08);
  vertical-align:middle;
}
.w-name{font-weight:600;font-size:14px;color:var(--ink);line-height:1.4}
.w-name small{display:block;font-weight:400;font-size:11px;color:var(--ink-soft);margin-top:3px}
.gps-stack{display:flex;flex-direction:column;gap:2px;line-height:1.25}
.gps-stack span{display:block;font-size:11px;color:#3D4743;font-weight:500;white-space:nowrap}
.badge{
  display:inline-block;padding:4px 8px;border-radius:999px;font-size:11px;font-weight:600;
  line-height:1.2;white-space:nowrap;
}
.badge-green{background:var(--em-100);color:var(--em-950)}
.badge-tee{background:#F7EFE3;color:#7A5418}
.badge-fw{background:#E8F0F6;color:#1F5C8B}
.badge-na{background:transparent;color:var(--ink-soft);padding:0;font-weight:500}
.dim{font-size:12px;color:#3D4743;font-weight:500}
.pg-foot{
  margin-top:auto;padding-top:16px;border-top:1px solid var(--hair);
  display:flex;justify-content:space-between;align-items:center;
  font-size:11px;color:var(--ink-soft);font-weight:500;
}
.pg-num{font-weight:600;color:var(--em-950)}

/* ── Back ── */
.back{background:var(--hero);color:#fff;align-items:center;justify-content:center;text-align:center}
.back-body{
  position:relative;z-index:1;flex:1;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:16px;padding:${M}px;
}
.back-logo{width:56px;height:56px;display:block;object-fit:contain;border-radius:50%}
.back-logo-fallback{
  width:56px;height:56px;border-radius:50%;background:rgba(255,255,255,.12);
  display:flex;align-items:center;justify-content:center;
}
.back-logo-fallback span{width:16px;height:16px;border-radius:50%;background:#fff}
.back-word{font-size:18px;font-weight:700;letter-spacing:.06em;color:#fff}
.back-line{font-size:13px;color:rgba(255,255,255,.82);font-weight:500}
.back-line .company-mark{justify-content:center}
.back-line .company-logo{width:16px;height:16px}
.back-line .company-name{line-height:16px;height:16px}
.back-mono{
  position:absolute;left:0;right:0;bottom:${M}px;z-index:1;
  font-size:11px;color:rgba(255,255,255,.55);letter-spacing:.08em;font-weight:500;
}
`
}

function pinStyle(m: MapReportMark, bounds: CourseMapBounds | undefined): string {
  if (
    typeof m.mapX === 'number' &&
    typeof m.mapY === 'number' &&
    Number.isFinite(m.mapX) &&
    Number.isFinite(m.mapY)
  ) {
    const left = Math.min(100, Math.max(0, m.mapX))
    const top = Math.min(100, Math.max(0, m.mapY))
    return `left:${left.toFixed(2)}%;top:${top.toFixed(2)}%`
  }
  if (!bounds) return 'left:50%;top:50%;opacity:0'
  const { left, top } = gpsToPercent(m.lat, m.lng, bounds)
  return `left:${left};top:${top}`
}

function buildPinsHtml(
  marks: MapReportMark[],
  bounds: CourseMapBounds | undefined,
): string {
  return marks
    .map((m) => {
      const c = markColor(m)
      return `<div class="pin" style="${pinStyle(m, bounds)};background:${c}" aria-hidden="true"></div>`
    })
    .join('')
}

function buildTableRows(
  marks: MapReportMark[],
  labels: MapPdfLabels,
  _offset: number,
): string {
  if (marks.length === 0) {
    return `<tr><td colspan="5" class="dim">${escapeHtml(labels.noMarks)}</td></tr>`
  }
  return marks
    .map((m) => {
      const area = m.areaType
      const color = markColor(m)
      const badge = `<span class="badge ${areaBadgeClass(area)}">${escapeHtml(areaLabel(area, labels))}</span>`
      return `<tr>
        <td class="col-no"><span class="dot-mark" style="background:${color}"></span></td>
        <td class="w-name">${escapeHtml(markTitle(m, labels.locale))}</td>
        <td class="col-area">${badge}</td>
        <td class="col-gps mono">
          <div class="gps-stack">
            <span>${m.lat.toFixed(5)}</span>
            <span>${m.lng.toFixed(5)}</span>
          </div>
        </td>
        <td class="col-date mono">${escapeHtml(formatTableDate(m.workDate))}</td>
      </tr>`
    })
    .join('')
}

function companyMark(name: string, logoDataUrl: string | null): string {
  const icon = logoDataUrl
    ? `<img class="company-logo" src="${logoDataUrl}" alt="" />`
    : ''
  return `<span class="company-mark">${icon}<span class="company-name">${escapeHtml(name)}</span></span>`
}

function buildCoverHtml(args: BuildArgs, logoDataUrl: string | null): string {
  const L = args.labels
  const n = args.marks.length
  const unit = L.markCountUnit
  const brandIcon = logoDataUrl
    ? `<img class="brand-logo" src="${logoDataUrl}" alt="" />`
    : ''
  return `
<section class="page cover">
  ${geoOverlay(false, 'cover')}
  <div class="cover-top">
    ${brandIcon}
    <div class="brand-word">${escapeHtml(L.brand.toUpperCase())}</div>
  </div>
  <div class="cover-center">
    <div class="cover-eyebrow">${escapeHtml(L.eyebrow)}</div>
    <div class="cover-title">${escapeHtml(L.title)}</div>
    <div class="cover-course">${escapeHtml(args.courseName)}</div>
    <div class="cover-rule"></div>
    <div class="cover-meta">
      ${escapeHtml(L.workDate)} <span class="mono">${escapeHtml(args.workDate)}</span>
      &nbsp;&nbsp;·&nbsp;&nbsp;
      ${escapeHtml(L.markCount)} <span class="mono">${n}${escapeHtml(unit)}</span>
    </div>
  </div>
  <div class="cover-foot">
    ${companyMark(L.coverFootLeft, logoDataUrl)}
  </div>
</section>`
}

function buildContentHtml(
  args: BuildArgs,
  pageMarks: MapReportMark[],
  offset: number,
  pageIndex: number,
  totalPages: number,
  showMap: boolean,
): string {
  const L = args.labels
  const n = args.marks.length
  const unit = L.markCountUnit

  const mapBlock = showMap
    ? `
    <div class="map-card">
      <div class="map-rel">
        ${
          args.mapImageDataUrl
            ? `<img src="${args.mapImageDataUrl}" alt="" />`
            : ''
        }
        ${buildPinsHtml(args.marks, args.courseBounds)}
      </div>
    </div>
    <div class="map-meta">
      <span>${escapeHtml(L.mapSection)}</span>
      <span class="sep">·</span>
      <span class="mono">${n}${escapeHtml(unit)}</span>
      <span class="sep">·</span>
      <span class="mono">${escapeHtml(args.workDate)}</span>
    </div>`
    : ''

  return `
<section class="page content">
  <div class="accent-line"></div>
  <div class="run-head">
    <b>${escapeHtml(args.courseName)}</b>
    <span class="meta mono">${escapeHtml(args.workDate)} · ${n}${escapeHtml(unit)}</span>
  </div>
  ${mapBlock}
  <div class="section-gap">
    <div class="section-title">${escapeHtml(L.marks)}</div>
    <div class="work-card">
      <table>
        <thead>
          <tr>
            <th class="col-no"></th>
            <th>${escapeHtml(L.colWork)}</th>
            <th class="col-area">${escapeHtml(L.colArea)}</th>
            <th class="col-gps">${escapeHtml(L.colGps)}</th>
            <th class="col-date">${escapeHtml(L.colDate)}</th>
          </tr>
        </thead>
        <tbody>
          ${buildTableRows(pageMarks, L, offset)}
        </tbody>
      </table>
    </div>
  </div>
  <div class="pg-foot">
    <span>${escapeHtml(L.pageFooter)}</span>
    <span class="pg-num mono">${pageIndex} / ${totalPages}</span>
  </div>
</section>`
}

function buildBackHtml(
  labels: MapPdfLabels,
  logoDataUrl: string | null,
  generatedAt: string,
): string {
  const logo = logoDataUrl
    ? `<img class="back-logo" src="${logoDataUrl}" alt="" />`
    : `<div class="back-logo-fallback"><span></span></div>`
  return `
<section class="page back">
  ${geoOverlay(true, 'back')}
  <div class="back-body">
    ${logo}
    <div class="back-word">${escapeHtml(labels.brand)}</div>
    <div class="back-line">${escapeHtml(labels.coverFootLeft)}</div>
  </div>
  <div class="back-mono mono">${escapeHtml(generatedAt)}</div>
</section>`
}

type BuildArgs = {
  courseName: string
  workDate: string
  marks: MapReportMark[]
  mapImageDataUrl: string | null
  courseBounds?: CourseMapBounds
  labels: MapPdfLabels
  generatedAt: string
}

function ensureFontsLinked() {
  const id = 'gc-pdf-fonts'
  if (document.getElementById(id)) return
  const pret = document.createElement('link')
  pret.id = id
  pret.rel = 'stylesheet'
  pret.href =
    'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css'
  document.head.appendChild(pret)
  const mono = document.createElement('link')
  mono.rel = 'stylesheet'
  mono.href =
    'https://cdn.jsdelivr.net/npm/@fontsource/ibm-plex-mono@5.0.8/400.min.css'
  document.head.appendChild(mono)
}

async function waitForFonts(): Promise<void> {
  try {
    await document.fonts.ready
  } catch {
    /* ignore */
  }
  await new Promise((r) => setTimeout(r, 180))
}

async function waitForHostImages(host: HTMLElement): Promise<void> {
  const imgs = [...host.querySelectorAll('img')] as HTMLImageElement[]
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve()
            return
          }
          img.addEventListener('load', () => resolve(), { once: true })
          img.addEventListener('error', () => resolve(), { once: true })
          if (typeof img.decode === 'function') {
            void img.decode().then(() => resolve()).catch(() => resolve())
          }
        }),
    ),
  )
}

async function renderPagesToPdf(html: string): Promise<Blob> {
  const host = document.createElement('div')
  host.className = 'gc-pdf-root'
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${PAGE_W}px;z-index:-1;pointer-events:none;`
  host.innerHTML = `<style>${styleBlock()}</style>${html}`
  document.body.appendChild(host)
  ensureFontsLinked()
  await waitForFonts()
  await waitForHostImages(host)

  const pages = [...host.querySelectorAll('.page')] as HTMLElement[]
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  try {
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i]!
      page.style.width = `${PAGE_W}px`
      page.style.height = `${PAGE_H}px`
      const canvas = await html2canvas(page, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: PAGE_W,
        height: PAGE_H,
        windowWidth: PAGE_W,
        windowHeight: PAGE_H,
        onclone: (_doc, el) => {
          el.style.width = `${PAGE_W}px`
          el.style.height = `${PAGE_H}px`
        },
      })
      // PNG keeps text edges sharp vs JPEG blur; MEDIUM = lossless Flate
      // compression inside the PDF (same pixels, smaller file vs NONE).
      const img = canvas.toDataURL('image/png')
      if (i > 0) doc.addPage('a4', 'portrait')
      doc.addImage(img, 'PNG', 0, 0, 210, 297, undefined, 'MEDIUM')
    }
  } finally {
    host.remove()
  }

  return doc.output('blob')
}

/** Build corporate emerald cover + content + back PDF */
export async function buildMapWorkPdf(args: BuildArgs): Promise<Blob> {
  const generatedAt = formatGeneratedAt(args.generatedAt)
  const logoDataUrl = await loadCircleLogoDataUrl()
  const { chunks, offsets } = chunkMarksForPages(args.marks)
  const contentCount = Math.max(1, chunks.length)
  const totalPages = contentCount + 2

  let html = buildCoverHtml(args, logoDataUrl)
  chunks.forEach((chunk, i) => {
    html += buildContentHtml(
      args,
      chunk,
      offsets[i] ?? 0,
      i + 2,
      totalPages,
      i === 0,
    )
  })
  html += buildBackHtml(args.labels, logoDataUrl, generatedAt)

  return renderPagesToPdf(html)
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function mapWorkPdfFilename(
  courseName: string,
  workDate: string,
): string {
  const safeCourse = courseName.replace(/[\\/:*?"<>|]/g, '_').slice(0, 40)
  return `map-work-${safeCourse}-${workDate}.pdf`
}

export async function downloadMapWorkPdf(
  report: Pick<
    MapWorkReport,
    | 'courseName'
    | 'workDate'
    | 'marks'
    | 'mapImageDataUrl'
    | 'courseBounds'
    | 'createdAt'
  >,
  labels: MapPdfLabels,
  filename?: string,
): Promise<Blob> {
  const blob = await buildMapWorkPdf({
    courseName: report.courseName,
    workDate: report.workDate,
    marks: report.marks,
    mapImageDataUrl: report.mapImageDataUrl || null,
    courseBounds: report.courseBounds,
    labels,
    generatedAt: report.createdAt || new Date().toISOString(),
  })
  downloadBlob(
    blob,
    filename ?? mapWorkPdfFilename(report.courseName, report.workDate),
  )
  return blob
}
