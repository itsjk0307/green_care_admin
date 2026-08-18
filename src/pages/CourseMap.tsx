import { useState, useEffect, useRef, useMemo } from 'react'
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Pane,
  ZoomControl,
  useMap,
} from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  DocumentArrowDownIcon,
  MapPinIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { apiRequest } from '../api/client'
import { fetchCourses } from '../api/courses'
import { apiOrigin, API_BASE_URL } from '../config'
import { TaskZonesLayer } from '../components/map/TaskZonesLayer'
import { todayLocalDate } from '../constants/dailyPlan'
import { useIsMobile } from '../hooks/useBreakpoint'
import {
  buildMapPdfLabels,
  captureLeafletMap,
  downloadMapWorkPdf,
  estimateImageBytes,
  taskLabelPair,
} from '../lib/mapWorkPdf'
import { courseDisplayName } from '../lib/courseName'
import { devTerminalLog } from '../lib/devLog'
import { useLanguageStore } from '../stores/languageStore'
import {
  saveMapImage,
  saveMapPdf,
  useMapReportStore,
} from '../stores/mapReportStore'
import { useTaskZoneStore } from '../stores/taskZoneStore'
import type { MapReportAreaType, MapReportMark } from '../types/mapReport'

// ── Leaflet default icon fix (Vite asset hashing breaks the bundled URL) ──
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({ iconUrl: markerIcon, shadowUrl: markerShadow })

// ── Design tokens ──────────────────────────────────────────────────────────
const PRIMARY_GREEN = '#1B5E20'
const PAGE_BG       = '#F4F6F3'

// ── Constants ──────────────────────────────────────────────────────────────
const COURSE_STORAGE_KEY: string       = 'greencare-course-map-course-id'
const SALTBAY_CENTER: [number, number] = [37.391777, 126.772190]
const SALTBAY_ZOOM                     = 17

const MAPTILER_KEY: string = (import.meta.env.VITE_MAPTILER_KEY as string | undefined) ?? ''
// MapTiler's satellite-v2 tiles are server-side upsampled past ~z16 for most
// courses (measured: JPEG byte size keeps shrinking zoom-over-zoom instead of
// growing, i.e. no new detail) — cap native zoom here so Leaflet upsamples
// client-side instead of re-fetching an equally blurry tile from MapTiler.
const MAPTILER_MAX_NATIVE_ZOOM = 16

// Distance threshold for "외곽 신고 건" classification.
// 0.01 degrees ≈ 1 km radius from the course centre at Korean latitude.
const OUT_OF_BOUNDS_DEG = 0.01

// ── Types ──────────────────────────────────────────────────────────────────

interface FieldPhoto {
  id: string | number
  image_url?: string | null
  image_path?: string | null
  note: string | null
  severity: string
  gps_lat: number | string | null
  gps_lng: number | string | null
  created_at: string
  status?: string | null
}

interface MapVersion {
  id: string | number
  tile_folder: string
  shot_date: string
  label: string
  is_current: boolean
}

interface TileSetMeta {
  slug: string
  name: string
  tile_url: string
  minzoom: number
  maxzoom: number
  bounds: number[]  // [west, south, east, north]
}

interface Worker {
  id: string | number
  name: string
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Resolves image_url or image_path to an absolute URL.
 * Handles both full URLs and FastAPI static-file relative paths such as
 * /storage/field_photos/filename.jpg.
 */
function resolveImageSrc(photo: FieldPhoto, mediaBase: string): string {
  const raw = photo.image_url ?? photo.image_path ?? ''
  if (!raw) return ''
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw
  const normalized = raw.startsWith('/') ? raw : `/${raw}`
  return `${mediaBase}${normalized}`
}

/** Returns the pin dot colour based on report status. */
function pinColor(status?: string | null): string {
  if (status === '처리중') return '#F59E0B'
  if (status === '완료')   return '#22C55E'
  return '#38BDF8' // 신고됨 / default — sky blue
}

/** Creates the pulsing double-circle divIcon for a given status. */
function makePulseIcon(status?: string | null): L.DivIcon {
  const c = pinColor(status)
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:32px;height:32px;display:flex;align-items:center;justify-content:center;">
        <div style="
          position:absolute;width:32px;height:32px;
          background:${c}22;border:1.5px solid ${c}55;
          border-radius:50%;
          animation:outerPulse 2s ease-in-out infinite;"></div>
        <div style="
          position:absolute;width:14px;height:14px;
          background:${c};border:2px solid white;
          border-radius:50%;
          animation:innerPulse 2s ease-in-out infinite;
          box-shadow:0 0 6px ${c}99;"></div>
      </div>`,
    iconSize:    [32, 32],
    iconAnchor:  [16, 16],
    popupAnchor: [0, -20],
  })
}

/** Returns background/text colours for status badge and pills. */
function statusBadgeStyle(status?: string | null): { bg: string; color: string } {
  if (status === '처리중') return { bg: 'rgba(254,243,199,0.95)', color: '#D97706' }
  if (status === '완료')   return { bg: 'rgba(220,252,231,0.95)', color: '#16A34A' }
  return { bg: 'rgba(224,242,254,0.95)', color: '#0284C7' }
}

/**
 * Returns true when the pin is farther than OUT_OF_BOUNDS_DEG degrees from
 * the Salt Bay course centre — indicating an off-site upload.
 */
// Unlike every other endpoint here, GET /tiles/ returns a bare JSON array
// instead of the {success, data} envelope — apiRequest() would throw on it
// (payload.success is undefined on an array), so this fetches it directly.
async function fetchTileSets(): Promise<TileSetMeta[]> {
  const response = await fetch(`${API_BASE_URL}/tiles/`)
  if (!response.ok) {
    throw new Error(`Failed to load tile sets (${response.status})`)
  }
  return response.json() as Promise<TileSetMeta[]>
}

function isOutOfBounds(lat: number, lng: number): boolean {
  const dlat = lat - SALTBAY_CENTER[0]
  const dlng = lng - SALTBAY_CENTER[1]
  return Math.sqrt(dlat * dlat + dlng * dlng) > OUT_OF_BOUNDS_DEG
}

// ── MapInitializer ─────────────────────────────────────────────────────────
// Runs ONCE on mount: sets the initial view and listens for window resize.
function MapInitializer({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap()
  // Capture initial values only — ignore prop changes from parent re-renders
  const stableCenter = useRef(center)
  const stableZoom = useRef(zoom)
  useEffect(() => {
    const c = stableCenter.current
    const z = stableZoom.current
    const recenter = () => map.setView(c, z, { animate: false })
    const run = () => {
      map.invalidateSize({ animate: false, pan: false })
      setTimeout(recenter, 300)
    }
    run()
    window.addEventListener('resize', run)
    return () => window.removeEventListener('resize', run)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map])
  return null
}

// ── FitActiveTile ──────────────────────────────────────────────────────────
// Flies the map to the active tile set's geographic bounds — only when the
// user explicitly switches tile folders.
function FitActiveTile({
  tileFolder,
  tileSets,
}: {
  tileFolder: string
  tileSets: TileSetMeta[]
}) {
  const map = useMap()
  const prevFolder = useRef(tileFolder)
  const didInitial = useRef(false)
  useEffect(() => {
    // Run once on initial load, and again only if tileFolder actually changes
    if (didInitial.current && prevFolder.current === tileFolder) return
    prevFolder.current = tileFolder
    const meta = tileSets.find((t) => t.slug === tileFolder)
    if (meta && meta.bounds.length === 4) {
      didInitial.current = true
      const [west, south, east, north] = meta.bounds
      map.fitBounds([[south, west], [north, east]], { padding: [30, 30] })
    }
  })
  return null
}

// ── MapCapture ─────────────────────────────────────────────────────────────
// Must be rendered inside MapContainer. Stores the Leaflet map instance
// obtained via useMap() into a ref that is accessible by components outside
// the container (e.g. the 외곽 신고 건 panel's 이동 button).
function MapCapture({ targetRef }: { targetRef: React.MutableRefObject<L.Map | null> }) {
  const map = useMap()
  useEffect(() => {
    targetRef.current = map
    return () => { targetRef.current = null }
  }, [map, targetRef])
  return null
}

// ── AssignForm ─────────────────────────────────────────────────────────────
function AssignForm({ photo, onDone }: { photo: FieldPhoto; onDone: () => void }) {
  const queryClient             = useQueryClient()
  const [workerId, setWorkerId] = useState('')
  const [note, setNote]         = useState('')
  const [deadline, setDeadline] = useState('')
  const [status, setStatus]     = useState<string>(photo.status ?? '신고됨')

  const workersQuery = useQuery({
    queryKey: ['workers'],
    queryFn:  () => apiRequest<Worker[]>('/users/?role=worker'),
    staleTime: 5 * 60_000,
  })

  const mutation = useMutation({
    mutationFn: () =>
      apiRequest(`/field-photos/${photo.id}/assign`, {
        method: 'PATCH',
        body: JSON.stringify({
          assigned_to:   workerId  || undefined,
          assigned_note: note      || undefined,
          deadline:      deadline  || undefined,
          status,
        }),
      }),
    onSuccess: () => {
      toast.success('배정이 완료되었습니다.')
      void queryClient.invalidateQueries({ queryKey: ['field-photos'] })
      onDone()
    },
    onError: () => toast.error('배정에 실패했습니다. 다시 시도해주세요.'),
  })

  const inp: React.CSSProperties = {
    width: '100%', padding: '6px 8px', fontSize: 12,
    border: '1px solid #E5E7EB', borderRadius: 6, outline: 'none',
    boxSizing: 'border-box', fontFamily: 'inherit',
    color: '#1F2937', background: 'white',
  }
  const lbl: React.CSSProperties = {
    display: 'block', fontSize: 10, fontWeight: 700, color: '#6B7280',
    marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em',
  }

  return (
    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ borderTop: '1px solid #F3F4F6' }} />

      <div>
        <label style={lbl}>담당 작업자</label>
        <select value={workerId} onChange={e => setWorkerId(e.target.value)} style={inp}>
          <option value="">작업자 선택</option>
          {workersQuery.isLoading && <option disabled>불러오는 중…</option>}
          {workersQuery.data?.map(w => (
            <option key={w.id} value={String(w.id)}>{w.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label style={lbl}>작업 내용</label>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="작업 내용을 입력하세요"
          rows={2}
          style={{ ...inp, resize: 'none' }}
        />
      </div>

      <div>
        <label style={lbl}>마감일</label>
        <input
          type="date"
          value={deadline}
          onChange={e => setDeadline(e.target.value)}
          style={inp}
        />
      </div>

      <div>
        <label style={lbl}>처리 상태</label>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['신고됨', '처리중', '완료'] as const).map(s => {
            const active        = status === s
            const { bg, color } = statusBadgeStyle(s)
            return (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                style={{
                  flex: 1, padding: '4px 0', fontSize: 11, fontWeight: 700,
                  border: `1.5px solid ${active ? color : '#E5E7EB'}`,
                  borderRadius: 6, cursor: 'pointer',
                  background: active ? bg    : 'white',
                  color:      active ? color : '#9CA3AF',
                }}
              >
                {s}
              </button>
            )
          })}
        </div>
      </div>

      {mutation.isError && (
        <p style={{ fontSize: 11, color: '#EF4444', textAlign: 'center', margin: 0 }}>
          배정에 실패했습니다. 다시 시도해주세요.
        </p>
      )}

      <button
        type="button"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
        style={{
          width: '100%', padding: '8px 0', fontSize: 13, fontWeight: 700,
          background: mutation.isPending ? '#9CA3AF' : PRIMARY_GREEN,
          color: 'white', border: 'none', borderRadius: 8,
          cursor: mutation.isPending ? 'not-allowed' : 'pointer',
        }}
      >
        {mutation.isPending ? '처리 중…' : '배정하기'}
      </button>
    </div>
  )
}

// ── PhotoMarker ────────────────────────────────────────────────────────────
// key must be `${photo.id}-${photo.status}` at the call site so React fully
// unmounts/remounts (and Leaflet fully removes/re-adds the layer) whenever
// status changes or a new photo id arrives.
function PhotoMarker({
  photo,
  mediaBase,
  icon,
}: {
  photo: FieldPhoto
  mediaBase: string
  icon?: L.DivIcon
}) {
  const map      = useMap()
  const popupRef = useRef<L.Popup>(null)
  const [showForm, setShowForm] = useState(false)

  const status        = photo.status ?? '신고됨'
  const badge         = statusBadgeStyle(status)
  const severityBg    = photo.severity === 'critical' ? 'rgba(239,68,68,0.9)' : 'rgba(245,158,11,0.9)'
  const severityLabel = photo.severity === 'critical' ? '긴급' : '일반'
  const imgSrc        = resolveImageSrc(photo, mediaBase)
  const dateStr       = new Date(photo.created_at).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
  const canAssign = status === '신고됨' || status === '처리중'

  useEffect(() => { popupRef.current?.update() }, [showForm])

  if (photo.gps_lat == null || photo.gps_lng == null) return null
  const lat = Number(photo.gps_lat)
  const lng = Number(photo.gps_lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat === 0 || lng === 0) return null

  const popupWidth =
    typeof window !== 'undefined' ? Math.min(260, window.innerWidth - 48) : 260

  return (
    <Marker position={[lat, lng]} icon={icon ?? makePulseIcon(status)}>
      <Popup ref={popupRef} maxWidth={popupWidth} minWidth={Math.min(220, popupWidth)} className="custom-popup">
        <div
          style={{
            width: popupWidth, borderRadius: 12, overflow: 'hidden',
            fontFamily: "'Noto Sans KR', sans-serif",
            cursor: showForm ? 'default' : 'pointer',
          }}
          onClick={showForm ? undefined : () => map.closePopup()}
        >
          <div style={{ position: 'relative', width: '100%', height: 140, overflow: 'hidden' }}>
            {imgSrc ? (
              <img
                src={imgSrc}
                alt="현장 사진"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={e => { (e.target as HTMLImageElement).style.background = '#E5E7EB' }}
              />
            ) : (
              <div style={{
                width: '100%', height: '100%', background: '#E5E7EB',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <MapPinIcon style={{ width: 32, height: 32, color: '#9CA3AF' }} />
              </div>
            )}
            <div style={{
              position: 'absolute', top: 8, left: 8,
              background: severityBg, color: 'white',
              fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
            }}>
              {severityLabel}
            </div>
            <div style={{
              position: 'absolute', top: 8, right: 8,
              background: badge.bg, color: badge.color,
              fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
            }}>
              {status}
            </div>
          </div>

          <div style={{ padding: '10px 12px 12px' }} onClick={e => e.stopPropagation()}>
            <div style={{ color: '#9CA3AF', fontSize: 11, marginBottom: 6 }}>
              🕐 {dateStr}
            </div>
            <div style={{
              color: '#1A1A1A', fontSize: 13, lineHeight: '1.5',
              background: '#F9FAFB', borderRadius: 8, padding: '8px 10px',
              borderLeft: `3px solid ${PRIMARY_GREEN}`,
            }}>
              {photo.note ?? '메모 없음'}
            </div>

            {canAssign && !showForm && (
              <button
                type="button"
                onClick={() => setShowForm(true)}
                style={{
                  marginTop: 10, width: '100%',
                  background: PRIMARY_GREEN, color: 'white',
                  border: 'none', borderRadius: 8, padding: '8px 0',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
              >
                작업 배정
              </button>
            )}

            {canAssign && showForm && (
              <AssignForm photo={photo} onDone={() => setShowForm(false)} />
            )}

            {status === '완료' && (
              <div style={{
                marginTop: 10, padding: '8px 0', textAlign: 'center',
                color: '#16A34A', fontWeight: 700, fontSize: 13,
                background: 'rgba(220,252,231,0.6)', borderRadius: 8,
              }}>
                처리 완료 ✓
              </div>
            )}
          </div>
        </div>
      </Popup>
    </Marker>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────
export function CourseMap() {
  const { language, t } = useLanguageStore()
  const isMobile = useIsMobile()
  const [courseId, setCourseId] = useState(
    () => localStorage.getItem(COURSE_STORAGE_KEY) ?? '',
  )
  const [selectedVersionId, setSelectedVersionId] = useState('')
  const [activeTileFolder,  setActiveTileFolder]  = useState('saltbay')

  // Controls visibility of the 외곽 신고 건 side panel.
  // Closed by default on phones so the map isn't covered on first load.
  const [panelOpen, setPanelOpen] = useState(() =>
    typeof window !== 'undefined'
      ? !window.matchMedia('(max-width: 767px)').matches
      : true,
  )
  const [savingPdf, setSavingPdf] = useState(false)

  const allTaskZones = useTaskZoneStore((s) => s.zones)
  const clearCourseZones = useTaskZoneStore((s) => s.clearCourseZones)
  const addMapReport = useMapReportStore((s) => s.addReport)
  const markPdfReady = useMapReportStore((s) => s.markPdfReady)
  const syncReport   = useMapReportStore((s) => s.syncReport)
  const courseTaskZones = useMemo(
    () => allTaskZones.filter((z) => z.courseId === courseId),
    [allTaskZones, courseId],
  )

  const mapRef    = useRef<L.Map | null>(null)
  const mediaBase = apiOrigin()
  // Dev: same-origin /tiles (Vite proxy). Prod: backend origin.
  const tileBase = import.meta.env.DEV ? '' : mediaBase

  // ── Inject keyframe animations and popup CSS once ──────────────────────
  useEffect(() => {
    const el = document.createElement('style')
    el.textContent = `
      @keyframes outerPulse {
        0%, 100% { transform: scale(1);   opacity: 0.6; }
        50%       { transform: scale(1.8); opacity: 0.1; }
      }
      @keyframes innerPulse {
        0%, 100% { transform: scale(1);    opacity: 0.9; }
        50%       { transform: scale(1.15); opacity: 0.7; }
      }
      .custom-popup .leaflet-popup-content-wrapper {
        padding: 0; border-radius: 12px; overflow: hidden;
        box-shadow: 0 8px 30px rgba(0,0,0,0.2);
      }
      .custom-popup .leaflet-popup-content        { margin: 0; width: 260px !important; }
      .custom-popup .leaflet-popup-tip            { background: white; }
      .custom-popup .leaflet-popup-close-button   { display: none !important; }
    `
    document.head.appendChild(el)
    return () => {
      document.head.removeChild(el)
    }
  }, [])

  // ── Persist selected course ────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem(COURSE_STORAGE_KEY, courseId)
  }, [courseId])

  // ── Tile set metadata (bounds per slug) ───────────────────────────────
  // No `initialData` here: with the global 60s default staleTime (main.tsx),
  // an initialData: [] would be treated as "fetched just now" and silently
  // skip the real fetch for a full minute after every mount — tileSets would
  // stay empty exactly when FitActiveTile/bounds-clipping need real data.
  const tileSetsQuery = useQuery({ queryKey: ['tile-sets'], queryFn: fetchTileSets })
  const tileSets: TileSetMeta[] = tileSetsQuery.data ?? []

  // ── MapTiler basemap key check — warn loudly instead of silently omitting ──
  useEffect(() => {
    if (!MAPTILER_KEY) {
      devTerminalLog(
        'warn',
        'VITE_MAPTILER_KEY is not set — course map basemap is falling back to Esri World Imagery. Add VITE_MAPTILER_KEY to .env for the MapTiler satellite basemap.',
      )
    }
  }, [])

  // ── Active drone tile set's metadata/bounds — used to cap the overlay's
  // requests to its actual capture footprint instead of spamming 404s for
  // neighbouring tiles outside the photographed area. ────────────────────
  const activeTileMeta = useMemo(
    () => tileSets.find((t) => t.slug === activeTileFolder),
    [tileSets, activeTileFolder],
  )
  const activeTileBounds = useMemo(() => {
    if (!activeTileMeta || activeTileMeta.bounds.length !== 4) return undefined
    const [west, south, east, north] = activeTileMeta.bounds
    return L.latLngBounds([south, west], [north, east])
  }, [activeTileMeta])

  // ── Courses ────────────────────────────────────────────────────────────
  const coursesQuery  = useQuery({ queryKey: ['courses'], queryFn: fetchCourses })
  const courses       = coursesQuery.data ?? []

  const uniqueCourses = useMemo(() => {
    const seen = new Set<string>()
    return courses.filter(c => {
      if (seen.has(c.name_ko)) return false
      seen.add(c.name_ko)
      return true
    })
  }, [courses])

  // Validate the stored courseId against the loaded course list
  useEffect(() => {
    if (!courses.length) return
    setCourseId(id => (id && courses.some(c => c.id === id) ? id : ''))
  }, [courses])

  // ── Map versions (drone tile sets) ─────────────────────────────────────
  // Errors are NOT swallowed here — a fetch failure (network/401/500) must
  // surface as versionsQuery.isError so the UI can tell it apart from the
  // legitimate "this course has no maps yet" empty state (data: []).
  const versionsQuery = useQuery({
    queryKey: ['map-versions', courseId],
    queryFn: () => apiRequest<MapVersion[]>(`/course-maps/?course_id=${courseId}`),
    enabled: !!courseId,
  })
  const mapVersions: MapVersion[] = versionsQuery.data ?? []

  // Hydrate the active tile folder as soon as drone map data arrives.
  useEffect(() => {
    if (versionsQuery.isLoading) return
    if (!mapVersions.length) {
      setSelectedVersionId('')
      setActiveTileFolder('saltbay')
      return
    }
    const current = mapVersions.find(v => v.is_current) ?? mapVersions[0]
    setSelectedVersionId(String(current.id))
    setActiveTileFolder(current.tile_folder)
  }, [mapVersions, versionsQuery.isLoading])

  // ── Field photos — polled every 10 s ───────────────────────────────────
  const photosQuery = useQuery({
    queryKey: ['field-photos', courseId],
    queryFn: () => apiRequest<FieldPhoto[]>(`/field-photos/?course_id=${courseId}`),
    enabled: !!courseId,
    refetchInterval: 10_000,
    refetchIntervalInBackground: true,
  })
  const fieldPhotos: FieldPhoto[] = photosQuery.data ?? []

  // ── Out-of-bounds classification ────────────────────────────────────────
  const outOfBoundsPhotos = useMemo(
    () =>
      fieldPhotos.filter(p => {
        const lat = Number(p.gps_lat)
        const lng = Number(p.gps_lng)
        // Exclude emulator coordinates (negative longitude = Americas).
        // Only South Korean coordinates (lng > 0) are valid for this map.
        return Number.isFinite(lat) && Number.isFinite(lng) && lng > 0 && isOutOfBounds(lat, lng)
      }),
    [fieldPhotos],
  )

  // ── Auto-open side panel when out-of-bounds reports exist ──────────────
  useEffect(() => {
    if (outOfBoundsPhotos.length > 0) setPanelOpen(true)
  }, [outOfBoundsPhotos.length])

  // ── Derived state ──────────────────────────────────────────────────────
  const selectedCourse = useMemo(
    () => courses.find(c => c.id === courseId) ?? null,
    [courses, courseId],
  )

  const hasCourseGps =
    selectedCourse != null &&
    selectedCourse.center_lat != null &&
    selectedCourse.center_lng != null

  // Limits panning to roughly the course area (padded) so the basemap/drone
  // overlay stay relevant instead of scrolling off into unrelated geography.
  // Falls back to unrestricted panning when a course has no bound_* fields set
  // — or when bound_* doesn't actually contain center_lat/lng (seen on Salt
  // Bay: bound_* is a stale placeholder from before center was corrected,
  // and enforcing it would trap the map away from the real course).
  const courseMaxBounds = useMemo(() => {
    const c = selectedCourse
    if (
      !c ||
      c.bound_north == null || c.bound_south == null ||
      c.bound_east == null  || c.bound_west == null ||
      c.center_lat == null  || c.center_lng == null
    ) {
      return undefined
    }
    const pad = 0.01 // ≈ 1km padding at Korean latitudes
    const bounds = L.latLngBounds(
      [c.bound_south - pad, c.bound_west - pad],
      [c.bound_north + pad, c.bound_east + pad],
    )
    if (!bounds.contains([c.center_lat, c.center_lng])) return undefined
    return bounds
  }, [selectedCourse])

  const mapsFetchFailed = !!courseId && versionsQuery.isError

  const noMapsAvailable =
    !!courseId && hasCourseGps &&
    !versionsQuery.isLoading && !mapsFetchFailed && mapVersions.length === 0

  const isBootstrapping =
    coursesQuery.isLoading ||
    (!!courseId && versionsQuery.isLoading)

  // ── Style helpers ──────────────────────────────────────────────────────
  const selectCls =
    'h-10 min-w-[7rem] shrink-0 cursor-pointer rounded-xl border border-slate-200 bg-white px-3 text-sm ' +
    'text-slate-700 outline-none transition-all focus:border-emerald-500 ' +
    'focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50'

  const toolBtn =
    'flex h-10 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold transition-all'

  const scrollRow =
    'flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'

  const shellClass =
    '-m-3 flex flex-col sm:-m-5 md:-m-6 xl:-m-8 ' +
    'h-[calc(100dvh-60px)] sm:h-[calc(100dvh-68px)]'

  async function handleSavePdf() {
    if (!courseId || !selectedCourse || !hasCourseGps) {
      toast.error(t('mapPdfNeedCourse'), { className: 'gc-toast-error' })
      return
    }
    if (courseTaskZones.length === 0) {
      toast.error(t('mapPdfNeedMarks'), { className: 'gc-toast-error' })
      return
    }
    const map = mapRef.current
    if (!map) {
      toast.error(t('mapPdfFailed'), { className: 'gc-toast-error' })
      return
    }

    // Show full-page loading overlay immediately to cover any UI changes
    setSavingPdf(true)
    // Let React render the overlay before starting capture
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

    try {
      const workDate = todayLocalDate()
      const marks: MapReportMark[] = courseTaskZones.map((z) => {
        const pt = z.points[0] ?? [0, 0]
        const pair = taskLabelPair(z.taskTypes)
        const areaType: MapReportAreaType | undefined =
          z.zone === 'green' || z.zone === 'tee' || z.zone === 'fairway'
            ? z.zone
            : undefined
        return {
          id: z.id,
          title: pair.ko || z.title,
          titleKo: pair.ko || z.title,
          titleEn: pair.en || undefined,
          taskTypes: z.taskTypes,
          workDate: z.workDate,
          lat: pt[0],
          lng: pt[1],
          note: z.note?.trim() || undefined,
          areaType,
        }
      })

      const captureMarks = courseTaskZones.map((z) => {
        const pt = z.points[0] ?? [0, 0]
        return {
          lat: pt[0],
          lng: pt[1],
          color: '#1F4230',
          points: z.points.length >= 3 ? z.points : undefined,
        }
      })

      const tileMeta = tileSets.find((t) => t.slug === activeTileFolder)
      let courseBoundsTuple: [[number, number], [number, number]] | undefined
      let courseBounds:
        | { west: number; south: number; east: number; north: number }
        | undefined
      if (tileMeta && tileMeta.bounds.length === 4) {
        const [west, south, east, north] = tileMeta.bounds
        courseBoundsTuple = [
          [south, west],
          [north, east],
        ]
        courseBounds = { west, south, east, north }
      } else if (
        selectedCourse.center_lat != null &&
        selectedCourse.center_lng != null
      ) {
        const d = 0.012
        courseBounds = {
          west: selectedCourse.center_lng - d,
          south: selectedCourse.center_lat - d,
          east: selectedCourse.center_lng + d,
          north: selectedCourse.center_lat + d,
        }
        courseBoundsTuple = [
          [courseBounds.south, courseBounds.west],
          [courseBounds.north, courseBounds.east],
        ]
      }

      const capture = await captureLeafletMap(map, captureMarks, {
        courseBounds: courseBoundsTuple,
      })

      const mapImageDataUrl = capture.dataUrl
      const marksWithPins = marks.map((m, i) => ({
        ...m,
        mapX: capture.markPercents[i]?.mapX,
        mapY: capture.markPercents[i]?.mapY,
      }))
      const courseName = courseDisplayName(selectedCourse, language)
      const report = addMapReport({
        courseId,
        courseName,
        workDate,
        markCount: marksWithPins.length,
        marks: marksWithPins,
        mapImageDataUrl,
        imageBytesApprox: estimateImageBytes(mapImageDataUrl),
        courseBounds,
      })
      await saveMapImage(report.id, mapImageDataUrl)
      clearCourseZones(courseId)
      toast.success(t('mapPdfSavedHistory'), { className: 'gc-toast-success' })

      // Generate PDF in the background — doesn't block the UI
      const pdfLabelsSnapshot = buildMapPdfLabels(t, language)
      try {
        const pdfBlob = await downloadMapWorkPdf(report, pdfLabelsSnapshot)
        await saveMapPdf(report.id, pdfBlob)
        markPdfReady(report.id)
      } catch (e) {
        console.warn('[map-report] PDF generation failed', e)
      }
      // Auto-upload in background (don't block the overlay)
      syncReport(report.id).catch((err) => {
        console.warn('[map-report] auto-sync failed, can retry later', err)
      })
    } catch (err) {
      console.error(err)
      toast.error(t('mapPdfFailed'), { className: 'gc-toast-error' })
    } finally {
      setSavingPdf(false)
    }
  }

  // ── Loading guard ──────────────────────────────────────────────────────
  if (isBootstrapping) {
    return (
      <div className={`${shellClass} items-center justify-center gap-4`} style={{ background: PAGE_BG }}>
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm">
          <span className="h-7 w-7 animate-spin rounded-full border-[3px] border-slate-200 border-t-emerald-600" />
        </div>
        <p className="text-[15px] font-semibold text-slate-600">지도를 불러오는 중입니다...</p>
        <p className="text-sm text-slate-400">잠시만 기다려 주세요</p>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className={shellClass} style={{ background: PAGE_BG }}>
      {/* Full-page loading overlay during PDF save */}
      {savingPdf && (
        <div className="absolute inset-0 z-[9999] flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0f1923 0%, #1a2d3d 40%, #1e3a2f 100%)' }}>
          <div className="flex flex-col items-center gap-6">
            {/* Animated rings */}
            <div className="relative h-24 w-24">
              <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-white/10 border-t-emerald-400" style={{ animationDuration: '1.2s' }} />
              <span className="absolute inset-3 animate-spin rounded-full border-[3px] border-white/5 border-b-sky-400" style={{ animationDirection: 'reverse', animationDuration: '0.9s' }} />
              <span className="absolute inset-6 animate-spin rounded-full border-[3px] border-white/5 border-t-white/70" style={{ animationDuration: '1.5s' }} />
              {/* Center icon */}
              <span className="absolute inset-0 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-8 w-8 text-white/80">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
              </span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <p className="text-lg font-semibold tracking-wide text-white">
                {language === 'ko' ? 'PDF 리포트 생성 중' : 'Generating PDF Report'}
              </p>
              <p className="animate-pulse text-sm text-white/50">
                {language === 'ko' ? '잠시만 기다려 주세요...' : 'Please wait a moment...'}
              </p>
            </div>
            {/* Decorative bottom dots */}
            <div className="flex gap-1.5 pt-2">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-400/80" style={{ animationDelay: '0ms' }} />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-sky-400/80" style={{ animationDelay: '150ms' }} />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/60" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      )}
      {/* ── 상단 바: course only — task tools live in the bottom panel ── */}
      <div className="shrink-0 border-b border-[#EEEEEE] bg-white px-2.5 py-2 sm:px-4 sm:py-2.5 lg:px-5">
        <div className="flex items-center gap-1.5 sm:gap-3">
          <span className="hidden min-w-0 truncate text-base font-bold text-slate-900 md:inline">
            {selectedCourse
              ? courseDisplayName(selectedCourse, language)
              : language === 'en'
                ? 'Field map'
                : '현장 지도'}
          </span>

          <div className={`${scrollRow} min-w-0 flex-1`}>
            <select
              value={courseId}
              onChange={e => {
                setCourseId(e.target.value)
                setSelectedVersionId('')
                setActiveTileFolder('saltbay')
              }}
              className={`${selectCls} max-w-[42vw] sm:max-w-none`}
            >
              <option value="">
                {language === 'en' ? 'Select course' : '골프장 선택'}
              </option>
              {uniqueCourses.map(c => (
                <option key={c.id} value={c.id}>
                  {courseDisplayName(c, language)}
                </option>
              ))}
            </select>

            {courseId ? (
              <select
                value={selectedVersionId}
                onChange={e => {
                  const v = mapVersions.find(v => String(v.id) === e.target.value)
                  if (v) {
                    setSelectedVersionId(e.target.value)
                    setActiveTileFolder(v.tile_folder)
                  }
                }}
                disabled={mapVersions.length === 0}
                className={`${selectCls} max-w-[28vw] sm:max-w-none`}
              >
                {mapVersions.length === 0 ? (
                  <option>날짜 없음</option>
                ) : (
                  mapVersions.map(v => (
                    <option key={v.id} value={String(v.id)}>{v.label}</option>
                  ))
                )}
              </select>
            ) : null}
          </div>

          {courseId && hasCourseGps ? (
            <button
              type="button"
              disabled={savingPdf || courseTaskZones.length === 0}
              onClick={() => void handleSavePdf()}
              className={`${toolBtn} border-brand/30 bg-[#eef4ee] text-brand hover:bg-[#e2efe3] disabled:cursor-not-allowed disabled:opacity-40`}
              title={t('mapPdfSave')}
            >
              {savingPdf ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand/30 border-t-brand" />
              ) : (
                <DocumentArrowDownIcon className="h-4 w-4 shrink-0" />
              )}
              <span className="hidden whitespace-nowrap sm:inline">{t('mapPdfSave')}</span>
            </button>
          ) : null}

          {outOfBoundsPhotos.length > 0 && !panelOpen ? (
            <button
              type="button"
              onClick={() => setPanelOpen(true)}
              className={`${toolBtn} border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100`}
            >
              외곽 {outOfBoundsPhotos.length}
            </button>
          ) : null}
        </div>
      </div>

      {/* ── 지도 영역 ── */}
      <div className="relative min-h-0 flex-1 overflow-hidden">

        {/* 골프장 미선택 */}
        {!courseId && (
          <div className="absolute inset-0 z-[2000] flex flex-col items-center justify-center gap-3 bg-slate-50 px-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 sm:h-16 sm:w-16">
              <MapPinIcon className="h-7 w-7 text-slate-300 sm:h-8 sm:w-8" />
            </div>
            <p className="text-sm font-semibold text-slate-600 sm:text-[15px]">골프장을 선택하세요</p>
          </div>
        )}

        {/* GPS 좌표 없음 */}
        {courseId && !hasCourseGps && (
          <div className="absolute inset-0 z-[2000] flex flex-col items-center justify-center gap-3 bg-slate-50 px-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 sm:h-16 sm:w-16">
              <MapPinIcon className="h-7 w-7 text-slate-300 sm:h-8 sm:w-8" />
            </div>
            <p className="text-sm font-semibold text-slate-600 sm:text-[15px]">GPS 좌표가 설정되지 않았습니다</p>
            <p className="text-xs text-slate-400 sm:text-sm">코스 설정에서 중심 좌표를 입력한 후 다시 방문해주세요</p>
          </div>
        )}

        {/* 드론 지도 없음 */}
        {noMapsAvailable && (
          <div className="absolute inset-0 z-[2000] flex flex-col items-center justify-center gap-3 bg-slate-50/90 px-4 text-center backdrop-blur-sm">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 sm:h-16 sm:w-16">
              <MapPinIcon className="h-7 w-7 text-slate-300 sm:h-8 sm:w-8" />
            </div>
            <p className="text-sm font-semibold text-slate-600 sm:text-[15px]">드론 지도가 없습니다</p>
            <p className="text-xs text-slate-400 sm:text-sm">이 골프장에 등록된 드론 촬영 지도가 없습니다</p>
          </div>
        )}

        {/* 지도 목록 불러오기 실패 — 서버 오류/인증 만료/네트워크 문제 등.
            "지도 없음"과 시각적으로 구분되도록 빨간 계열로 표시하고 재시도 버튼 제공. */}
        {mapsFetchFailed && (
          <div className="absolute inset-0 z-[2000] flex flex-col items-center justify-center gap-3 bg-slate-50/90 px-4 text-center backdrop-blur-sm">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 sm:h-16 sm:w-16">
              <MapPinIcon className="h-7 w-7 text-red-300 sm:h-8 sm:w-8" />
            </div>
            <p className="text-sm font-semibold text-red-600 sm:text-[15px]">지도 정보를 불러오지 못했습니다</p>
            <p className="max-w-xs text-xs text-slate-400 sm:text-sm">
              {versionsQuery.error instanceof Error
                ? versionsQuery.error.message
                : '서버 연결을 확인한 후 다시 시도해주세요.'}
            </p>
            <button
              type="button"
              onClick={() => void versionsQuery.refetch()}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700"
            >
              다시 시도
            </button>
          </div>
        )}

        {/* ── 외곽 신고 건 패널 ───────────────────────────────────────────────
            Absolute overlay on the right side of the map. Visible whenever
            outOfBoundsPhotos is non-empty and panelOpen is true.
            Each row has a "이동" button that calls mapRef.current.flyTo()
            so the admin can jump directly to the off-site pin. */}
        {hasCourseGps && outOfBoundsPhotos.length > 0 && panelOpen && (
          <div
            data-pdf-hide
            className="absolute left-2 top-2 z-[1000] flex w-[min(calc(100%-1rem),15rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg sm:left-3 sm:top-3 sm:w-60"
            style={{ maxHeight: isMobile ? 'min(280px, 40vh)' : 'min(420px, 45vh)' }}
          >
            {/* 패널 헤더 */}
            <div
              className="flex shrink-0 items-center justify-between border-b border-slate-100 px-3 py-2.5"
              style={{ background: '#FFFBEB' }}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-base leading-none">📍</span>
                <span className="text-xs font-bold text-amber-700">
                  외곽 신고 건
                </span>
                <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                  {outOfBoundsPhotos.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                className="rounded-md p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                aria-label="패널 닫기"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>

            {/* 안내 문구 — tablet+ */}
            <p className="hidden shrink-0 border-b border-slate-50 bg-slate-50 px-3 py-1.5 text-[10px] leading-snug text-slate-500 sm:block">
              골프장 경계 외부에서 업로드된 신고 건입니다.
              <br />
              항목을 클릭하면 해당 위치로 이동합니다.
            </p>

            {/* 신고 건 목록 */}
            <ul className="flex-1 divide-y divide-slate-50 overflow-y-auto">
              {outOfBoundsPhotos.map(photo => {
                const lat           = Number(photo.gps_lat)
                const lng           = Number(photo.gps_lng)
                const dotColor      = pinColor(photo.status)
                const { bg, color } = statusBadgeStyle(photo.status)
                const isCritical    = photo.severity === 'critical'
                const sevBg         = isCritical ? '#FEE2E2' : '#FEF3C7'
                const sevColor      = isCritical ? '#DC2626' : '#D97706'
                const sevLabel      = isCritical ? '긴급' : '일반'
                const timeStr       = new Date(photo.created_at).toLocaleTimeString('ko-KR', {
                  hour: '2-digit', minute: '2-digit',
                })
                const dateStr       = new Date(photo.created_at).toLocaleDateString('ko-KR', {
                  month: 'short', day: 'numeric',
                })

                return (
                  <li key={photo.id}>
                    <button
                      type="button"
                      className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-slate-50 active:bg-slate-100"
                      onClick={() => {
                        if (
                          !Number.isFinite(lat) || !Number.isFinite(lng) ||
                          lat === 0 || lng === 0
                        ) {
                          alert('올바르지 않은 GPS 좌표입니다.')
                          return
                        }
                        mapRef.current?.flyTo(
                          [lat, lng],
                          18,
                          { animate: true, duration: 1.5 },
                        )
                      }}
                    >
                      {/* 상태 색상 점 */}
                      <span
                        className="mt-1 shrink-0 rounded-full"
                        style={{ width: 8, height: 8, background: dotColor, display: 'inline-block' }}
                      />

                      {/* 정보 */}
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-1">
                          <span
                            className="rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                            style={{ background: sevBg, color: sevColor }}
                          >
                            {sevLabel}
                          </span>
                          <span
                            className="rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                            style={{ background: bg, color }}
                          >
                            {photo.status ?? '신고됨'}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500">
                          {dateStr} · {timeStr}
                        </p>
                        {photo.note && (
                          <p className="mt-0.5 truncate text-[11px] text-slate-700">
                            {photo.note}
                          </p>
                        )}
                      </div>

                      {/* 이동 버튼 */}
                      <span
                        className="shrink-0 self-center rounded-lg px-2 py-1 text-[10px] font-bold text-white"
                        style={{ background: PRIMARY_GREEN }}
                      >
                        이동
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>

            {/* 패널 푸터: 전체 이동 보기 */}
            <div className="shrink-0 border-t border-slate-100 px-3 py-2">
              <button
                type="button"
                className="w-full rounded-xl py-1.5 text-[11px] font-semibold text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
                onClick={() => {
                  if (!mapRef.current || outOfBoundsPhotos.length === 0) return
                  // outOfBoundsPhotos already excludes lng <= 0 (emulator/Americas),
                  // but re-guard here so a stale closure can never pass bad coords to
                  // latLngBounds and snap the map to California.
                  const validPhotos = outOfBoundsPhotos.filter(p => Number(p.gps_lng) > 0)
                  if (validPhotos.length === 0) return
                  const lats = validPhotos.map(p => Number(p.gps_lat))
                  const lngs = validPhotos.map(p => Number(p.gps_lng))
                  const bounds = L.latLngBounds(
                    [Math.min(...lats), Math.min(...lngs)],
                    [Math.max(...lats), Math.max(...lngs)],
                  )
                  mapRef.current.flyToBounds(bounds, { padding: [40, 40], maxZoom: 16 })
                }}
              >
                모든 외곽 신고 건 보기
              </button>
            </div>
          </div>
        )}

        {/* ── 지도 컨테이너 ──────────────────────────────────────────────────
            Gated only on hasCourseGps so the Leaflet DOM mounts immediately.
            Basemap (MapTiler satellite, or Esri if no key) is always on;
            the drone orthomosaic layers on top as an overlay when present. */}
        {hasCourseGps && (
          <MapContainer
            key={courseId}
            ref={mapRef}
            center={[selectedCourse!.center_lat!, selectedCourse!.center_lng!]}
            zoom={selectedCourse?.default_zoom ?? SALTBAY_ZOOM}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom
            minZoom={14}
            maxZoom={19}
            maxBounds={courseMaxBounds}
            maxBoundsViscosity={1.0}
            attributionControl={false}
            zoomControl={false}
            whenReady={() => {
              setTimeout(() => {
                const m = mapRef.current
                if (!m) return
                m.invalidateSize()
              }, 200)
            }}
          >
            <ZoomControl position="topleft" />

            {/* 기본 지도(베이스맵) — MapTiler 위성, 키 없으면 Esri로 폴백 */}
            {MAPTILER_KEY ? (
              <TileLayer
                key="maptiler-satellite-base"
                url={`https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=${MAPTILER_KEY}`}
                crossOrigin="anonymous"
                attribution='&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                maxZoom={19}
                maxNativeZoom={MAPTILER_MAX_NATIVE_ZOOM}
              />
            ) : (
              <TileLayer
                key="esri-satellite-base-fallback"
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                crossOrigin="anonymous"
                attribution="Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community (VITE_MAPTILER_KEY missing)"
                maxZoom={19}
              />
            )}

            {/* 드론 정사영상 오버레이 — 실제 촬영 범위(bounds) 밖 타일은
                요청 자체를 하지 않아 경계부 404가 생기지 않는다 */}
            {mapVersions.length > 0 && (
              <TileLayer
                key={`drone-${activeTileFolder}`}
                url={`${tileBase}/tiles/${activeTileFolder}/{z}/{x}/{y}.png`}
                attribution=""
                crossOrigin="anonymous"
                minZoom={14}
                maxZoom={19}
                minNativeZoom={activeTileMeta?.minzoom ?? 14}
                maxNativeZoom={activeTileMeta?.maxzoom ?? 19}
                tileSize={256}
                tms={false}
                errorTileUrl=""
                bounds={activeTileBounds}
              />
            )}

            <MapInitializer
              center={[selectedCourse!.center_lat!, selectedCourse!.center_lng!]}
              zoom={selectedCourse?.default_zoom ?? SALTBAY_ZOOM}
            />
            {tileSets.length > 0 && (
              <FitActiveTile tileFolder={activeTileFolder} tileSets={tileSets} />
            )}
            {/* MapCapture populates mapRef via useMap() so the panel's
                이동 button can call imperative Leaflet methods from outside
                the MapContainer tree. */}
            <MapCapture targetRef={mapRef} />

            <TaskZonesLayer
              courseId={courseId}
              onSaved={() => {
                toast.success(t('taskZoneSaved'), {
                  className: 'gc-toast-success',
                })
              }}
            />

            {/* 현장 보고 핀 — 전용 Pane으로 드론 타일 위에 항상 표시
                zIndex 650: tilePane(200) · markerPane(600) 위, popupPane(700) 아래 */}
            <Pane name="field-report-pins" style={{ zIndex: 650 }}>
              {fieldPhotos.filter(photo => Number(photo.gps_lng) > 0).map(photo => {
                // Null-check before coercion: Number(null) === 0, which is finite,
                // so photos with null GPS would otherwise land at [0,0] (Atlantic).
                if (photo.gps_lat == null || photo.gps_lng == null) return null
                const lat = Number(photo.gps_lat)
                const lng = Number(photo.gps_lng)
                if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat === 0 || lng === 0) return null
                return (
                  <PhotoMarker
                    key={`${photo.id}-${photo.status ?? '신고됨'}`}
                    photo={photo}
                    mediaBase={mediaBase}
                  />
                )
              })}
            </Pane>
          </MapContainer>
        )}
      </div>
    </div>
  )
}
