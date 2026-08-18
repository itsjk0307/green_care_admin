import { useState, useEffect, useRef, useMemo } from 'react'
import {
  MapContainer,
  TileLayer,
  Rectangle,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import { useQuery, useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { CheckIcon, MapPinIcon } from '@heroicons/react/24/outline'
import { fetchCourses } from '../api/courses'
import { apiRequest, ApiError } from '../api/client'
import { apiOrigin } from '../config'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'

// Fix Leaflet default marker icon broken by Vite's asset hashing
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({ iconUrl: markerIcon, shadowUrl: markerShadow })

const COURSE_STORAGE_KEY = 'greencare-course-map-course-id'

const DEFAULT_CENTER = { lat: 37.391777, lng: 126.772190 }
const DEFAULT_ZOOM = 17

// ── MapLogger ──────────────────────────────────────────────────────────────
function MapLogger() {
  useMapEvents({
    moveend: (e) => {
      const center = e.target.getCenter()
      const zoom = e.target.getZoom()
      console.log(`Map center: lat=${center.lat.toFixed(6)}, lng=${center.lng.toFixed(6)}, zoom=${zoom}`)
    },
    zoomend: (e) => {
      const center = e.target.getCenter()
      const zoom = e.target.getZoom()
      console.log(`Zoom changed: lat=${center.lat.toFixed(6)}, lng=${center.lng.toFixed(6)}, zoom=${zoom}`)
    },
  })
  return null
}

// ── FitBounds ──────────────────────────────────────────────────────────────
function FitBounds({ bounds }: { bounds: [[number, number], [number, number]] }) {
  const map = useMap()
  useEffect(() => {
    map.fitBounds(bounds, { padding: [20, 20] })
  }, [map, bounds])
  return null
}

// ── MapInitializer ─────────────────────────────────────────────────────────
function MapInitializer({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap()
  useEffect(() => {
    const recenter = () => map.setView(center, zoom, { animate: false })
    const invalidateAndCenter = () => {
      map.invalidateSize({ animate: false, pan: false })
      setTimeout(recenter, 300)
    }
    invalidateAndCenter()
    window.addEventListener('resize', invalidateAndCenter)
    return () => window.removeEventListener('resize', invalidateAndCenter)
  }, [map, center, zoom])
  return null
}

// ── FitActiveTile ───────────────────────────────────────────────────────────
// Flies the map to the active tile set's geographic bounds once tiles are loaded.
function FitActiveTile({
  tileFolder,
  tileSets,
}: {
  tileFolder: string
  tileSets: TileSetMeta[]
}) {
  const map = useMap()
  useEffect(() => {
    const meta = tileSets.find((t) => t.slug === tileFolder)
    if (meta && meta.bounds.length === 4) {
      const [west, south, east, north] = meta.bounds
      map.fitBounds([[south, west], [north, east]], { padding: [30, 30] })
    }
  }, [tileFolder, tileSets, map])
  return null
}

// ── MapController ──────────────────────────────────────────────────────────
function MapController({
  showDroneTiles,
  paddedMaxBounds,
  courseBoundBox,
}: {
  showDroneTiles: boolean
  paddedMaxBounds: [[number, number], [number, number]] | undefined
  courseBoundBox: [[number, number], [number, number]] | null
}) {
  const map = useMap()
  useEffect(() => {
    if (showDroneTiles) {
      map.setMaxBounds([[-90, -180], [90, 180]])
    } else {
      if (paddedMaxBounds) map.setMaxBounds(paddedMaxBounds)
      if (courseBoundBox) map.fitBounds(courseBoundBox, { padding: [20, 20] })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDroneTiles, map])
  return null
}

// ── Types ──────────────────────────────────────────────────────────────────

interface BoundsData {
  bound_north: number | null
  bound_south: number | null
  bound_east: number | null
  bound_west: number | null
}

interface BoundsState {
  north: number
  south: number
  east: number
  west: number
}

interface FieldPhoto {
  id: string | number
  image_url: string
  note: string | null
  severity: 'critical' | 'normal' | string
  gps_lat: number | string | null
  gps_lng: number | string | null
  created_at: string
  status?: string
}

interface MapVersion {
  id: string | number
  course_id: string
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

function hasBounds(
  data: BoundsData,
): data is BoundsData & {
  bound_north: number
  bound_south: number
  bound_east: number
  bound_west: number
} {
  return (
    data.bound_north != null &&
    data.bound_south != null &&
    data.bound_east != null &&
    data.bound_west != null
  )
}

// ── API fetchers ────────────────────────────────────────────────────────────

function fetchCourseBounds(courseId: string): Promise<BoundsData> {
  return apiRequest<BoundsData>(`/courses/${courseId}`)
}

function patchCourseBounds(courseId: string, bounds: BoundsState): Promise<BoundsData> {
  return apiRequest<BoundsData>(`/courses/${courseId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      bound_north: bounds.north,
      bound_south: bounds.south,
      bound_east: bounds.east,
      bound_west: bounds.west,
    }),
  })
}

function fetchFieldPhotos(courseId: string): Promise<FieldPhoto[]> {
  return apiRequest<FieldPhoto[]>(`/field-photos/?course_id=${courseId}`)
}

function fetchTileSets(): Promise<TileSetMeta[]> {
  return apiRequest<TileSetMeta[]>('/tiles/')
}

async function fetchMapVersions(courseId: string): Promise<MapVersion[]> {
  try {
    const data = await apiRequest<MapVersion[]>(`/course-maps/?course_id=${courseId}`)
    return data ?? []
  } catch {
    return []
  }
}

// ── Page ───────────────────────────────────────────────────────────────────

export function CourseMapPage() {
  const [courseId, setCourseId] = useState(
    () => localStorage.getItem(COURSE_STORAGE_KEY) ?? '',
  )
  const [bounds, setBounds] = useState<BoundsState | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [showDroneTiles] = useState(true)
  const [selectedVersionId, setSelectedVersionId] = useState<string>('')
  const [activeTileFolder, setActiveTileFolder] = useState<string>('saltbay')
  // mapReady gates the markers effect — ensures mapRef.current is set before
  // we try to add layers, even if fieldPhotos arrive before the map mounts.
  const [mapReady, setMapReady] = useState(false)
  const mapRef = useRef<L.Map | null>(null)
  const markersLayerRef = useRef<L.LayerGroup | null>(null)
  const mediaBase = apiOrigin()

  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = `
      @keyframes outerPulse {
        0%   { transform: scale(1);   opacity: 0.6; }
        50%  { transform: scale(1.8); opacity: 0.1; }
        100% { transform: scale(1);   opacity: 0.6; }
      }
      @keyframes innerPulse {
        0%   { transform: scale(1);    opacity: 0.9; }
        50%  { transform: scale(1.15); opacity: 0.7; }
        100% { transform: scale(1);    opacity: 0.9; }
      }
      .custom-popup .leaflet-popup-content-wrapper {
        padding: 0;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 8px 30px rgba(0,0,0,0.2);
      }
      .custom-popup .leaflet-popup-content {
        margin: 0;
      }
      .custom-popup .leaflet-popup-tip {
        background: white;
      }
      .custom-popup .leaflet-popup-close-button {
        display: none !important;
      }
    `
    document.head.appendChild(style)
    return () => { document.head.removeChild(style) }
  }, [])

  useEffect(() => {
    window.dispatchEvent(new Event('resize'))
  }, [courseId, showDroneTiles])

  const tileSetsQuery = useQuery({ queryKey: ['tile-sets'], queryFn: fetchTileSets, initialData: [] as TileSetMeta[] })
  const tileSets: TileSetMeta[] = tileSetsQuery.data ?? []

  const coursesQuery = useQuery({ queryKey: ['courses'], queryFn: fetchCourses })
  const courses = coursesQuery.data ?? []
  const uniqueCourses = useMemo(() => {
    const seen = new Set<string>()
    return courses.filter((c) => {
      if (seen.has(c.name_ko)) return false
      seen.add(c.name_ko)
      return true
    })
  }, [courses])

  useEffect(() => {
    if (!courses.length) return
    setCourseId((id) => {
      if (!id) return id
      return courses.some((c) => c.id === id) ? id : ''
    })
  }, [courses])

  useEffect(() => {
    localStorage.setItem(COURSE_STORAGE_KEY, courseId)
  }, [courseId])

  // ── Map versions ────────────────────────────────────────────────────────
  const versionsQuery = useQuery({
    queryKey: ['map-versions', courseId],
    queryFn: () => fetchMapVersions(courseId),
    enabled: !!courseId,
    initialData: [] as MapVersion[],
  })
  const mapVersions: MapVersion[] = versionsQuery.data ?? []

  useEffect(() => {
    if (!mapVersions.length) {
      setSelectedVersionId('')
      setActiveTileFolder('saltbay')
      return
    }
    const current = mapVersions.find((v) => v.is_current) ?? mapVersions[0]
    setSelectedVersionId(String(current.id))
    setActiveTileFolder(current.tile_folder)
  }, [mapVersions])

  // ── Course bounds ────────────────────────────────────────────────────────
  const boundsQuery = useQuery({
    queryKey: ['course-bounds', courseId],
    queryFn: () => fetchCourseBounds(courseId),
    enabled: !!courseId,
  })

  useEffect(() => {
    setBounds(null)
    setIsDirty(false)
    if (!boundsQuery.data) return
    const data = boundsQuery.data
    if (hasBounds(data)) {
      setBounds({
        north: data.bound_north,
        south: data.bound_south,
        east: data.bound_east,
        west: data.bound_west,
      })
    }
  }, [boundsQuery.data])

  // ── Field photos — manual polling bypasses React Query structural sharing ─
  const [fieldPhotos, setFieldPhotos] = useState<FieldPhoto[]>([])
  const [isPhotosFetching, setIsPhotosFetching] = useState(false)

  useEffect(() => {
    if (!courseId) {
      setFieldPhotos([])
      return
    }

    let cancelled = false

    const poll = async () => {
      setIsPhotosFetching(true)
      try {
        const photos = await fetchFieldPhotos(courseId)
        if (!cancelled) {
          setFieldPhotos(photos ?? [])
          console.log('Fetched photos:', photos?.length ?? 0)
        }
      } catch (err) {
        if (!cancelled) console.error('Failed to fetch photos:', err)
      } finally {
        if (!cancelled) setIsPhotosFetching(false)
      }
    }

    poll()
    const interval = setInterval(poll, 10_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [courseId])

  // ── Imperative Leaflet marker management ──────────────────────────────────
  // Bypasses React reconciliation entirely — directly adds/removes Leaflet
  // layers so the map always reflects the latest fieldPhotos state.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    // Tear down the previous layer group
    if (markersLayerRef.current) {
      markersLayerRef.current.clearLayers()
      map.removeLayer(markersLayerRef.current)
    }

    const layerGroup = L.layerGroup()

    fieldPhotos.forEach((photo) => {
      const lat = Number(photo.gps_lat)
      const lng = Number(photo.gps_lng)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return

      const status = photo.status ?? '신고됨'
      const dotColor =
        status === '처리중' ? '#F59E0B' :
        status === '완료'   ? '#22C55E' :
        '#38BDF8'

      const icon = L.divIcon({
        className: '',
        html: `
          <div style="position:relative;width:32px;height:32px;display:flex;align-items:center;justify-content:center;">
            <div style="position:absolute;width:32px;height:32px;background:${dotColor}22;border:1.5px solid ${dotColor}55;border-radius:50%;animation:outerPulse 2s ease-in-out infinite;"></div>
            <div style="position:absolute;width:14px;height:14px;background:${dotColor};border:2px solid white;border-radius:50%;animation:innerPulse 2s ease-in-out infinite;box-shadow:0 0 6px ${dotColor}99;"></div>
          </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -16],
      })

      const severityBg = photo.severity === 'critical' ? 'rgba(239,68,68,0.9)' : 'rgba(245,158,11,0.9)'
      const severityLabel = photo.severity === 'critical' ? '긴급' : '일반'
      const statusBg =
        status === '처리중' ? 'rgba(254,243,199,0.95)' :
        status === '완료'   ? 'rgba(220,252,231,0.95)' :
        'rgba(224,242,254,0.95)'
      const statusColor =
        status === '처리중' ? '#D97706' :
        status === '완료'   ? '#16A34A' :
        '#0284C7'

      const dateStr = new Date(photo.created_at).toLocaleDateString('ko-KR', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })

      const fullImageUrl = `${mediaBase}${photo.image_url}`

      const popupHtml = `
        <div style="width:220px;border-radius:12px;overflow:hidden;font-family:'Noto Sans KR',sans-serif;cursor:pointer;"
             onclick="this.closest('.leaflet-popup').querySelector('.leaflet-popup-close-button').click()">
          <div style="position:relative;width:100%;height:140px;overflow:hidden;">
            <img src="${fullImageUrl}" style="width:100%;height:100%;object-fit:cover;"
                 onerror="this.style.background='#f0f0f0'" />
            <div style="position:absolute;top:8px;left:8px;background:${severityBg};color:white;font-size:10px;font-weight:700;padding:3px 10px;border-radius:20px;">
              ${severityLabel}
            </div>
            <div style="position:absolute;top:8px;right:8px;background:${statusBg};color:${statusColor};font-size:10px;font-weight:700;padding:3px 10px;border-radius:20px;">
              ${status}
            </div>
          </div>
          <div style="padding:10px 12px 12px;">
            <div style="color:#9CA3AF;font-size:11px;margin-bottom:6px;">🕐 ${dateStr}</div>
            <div style="color:#1A1A1A;font-size:13px;line-height:1.5;background:#F9FAFB;border-radius:8px;padding:8px 10px;border-left:3px solid #1B5E20;">
              ${photo.note ?? '메모 없음'}
            </div>
          </div>
        </div>
      `

      const popup = L.popup({ maxWidth: 220, className: 'custom-popup', closeButton: false })
        .setContent(popupHtml)

      L.marker([lat, lng], { icon }).bindPopup(popup).addTo(layerGroup)
    })

    layerGroup.addTo(map)
    markersLayerRef.current = layerGroup

    console.log('Markers updated:', fieldPhotos.length)

    return () => {
      if (markersLayerRef.current) {
        markersLayerRef.current.clearLayers()
      }
    }
  }, [fieldPhotos, mediaBase, mapReady]) // mapReady ensures map is initialized before first render

  const saveMutation = useMutation({
    mutationFn: () => patchCourseBounds(courseId, bounds!),
    onSuccess() {
      toast.success('경계가 저장되었습니다')
      setIsDirty(false)
    },
    onError(err) {
      toast.error(err instanceof ApiError ? err.message : '저장에 실패했습니다')
    },
  })

  const selectedCourse = useMemo(
    () => courses.find((c) => c.id === courseId) ?? null,
    [courses, courseId],
  )

  console.log('selectedCourse full:', JSON.stringify(selectedCourse))

  const hasCourseGps =
    selectedCourse !== null &&
    selectedCourse.center_lat !== null &&
    selectedCourse.center_lat !== undefined &&
    selectedCourse.center_lng !== null &&
    selectedCourse.center_lng !== undefined

  const courseBoundBox = useMemo<[[number, number], [number, number]] | null>(() => {
    if (
      selectedCourse === null ||
      selectedCourse.bound_south == null ||
      selectedCourse.bound_west == null ||
      selectedCourse.bound_north == null ||
      selectedCourse.bound_east == null
    ) return null
    return [
      [selectedCourse.bound_south, selectedCourse.bound_west],
      [selectedCourse.bound_north, selectedCourse.bound_east],
    ]
  }, [selectedCourse])

  const paddedMaxBounds = useMemo<[[number, number], [number, number]] | undefined>(() => {
    if (!courseBoundBox) return undefined
    return [
      [courseBoundBox[0][0] - 0.01, courseBoundBox[0][1] - 0.01],
      [courseBoundBox[1][0] + 0.01, courseBoundBox[1][1] + 0.01],
    ]
  }, [courseBoundBox])

  const selectClass =
    'h-8 cursor-pointer rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50'

  const noMapsAvailable =
    !!courseId && hasCourseGps && !versionsQuery.isLoading && mapVersions.length === 0

  if (coursesQuery.isLoading) {
    return (
      <div className="flex h-[calc(100vh-84px)] items-center justify-center">
        <LoadingSpinner message="골프장 목록 불러오는 중…" />
      </div>
    )
  }

  return (
    <div className="-mx-6 -mb-6 -mt-6 flex flex-col" style={{ height: 'calc(100vh - 60px)' }}>
      {/* ── Top Bar ── */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-[#EEEEEE] bg-white px-5">
        <div className="flex items-center gap-3">
          <span className="text-base font-bold text-slate-900">
            {selectedCourse ? selectedCourse.name_ko : '코스 경계 설정'}
          </span>

          <select
            value={courseId}
            onChange={(e) => {
              setCourseId(e.target.value)
              setIsDirty(false)
              setSelectedVersionId('')
              setActiveTileFolder('saltbay')
              setMapReady(false)
            }}
            className={selectClass}
          >
            <option value="">골프장을 선택하세요</option>
            {uniqueCourses.map((c) => (
              <option key={c.id} value={c.id}>{c.name_ko}</option>
            ))}
          </select>

          {courseId && (
            <select
              value={selectedVersionId}
              onChange={(e) => {
                const v = mapVersions.find((v) => String(v.id) === e.target.value)
                if (v) {
                  setSelectedVersionId(e.target.value)
                  setActiveTileFolder(v.tile_folder)
                }
              }}
              disabled={versionsQuery.isLoading || mapVersions.length === 0}
              className={selectClass}
            >
              {versionsQuery.isLoading ? (
                <option value="">로딩 중…</option>
              ) : mapVersions.length === 0 ? (
                <option value="">날짜 선택</option>
              ) : (
                mapVersions.map((v) => (
                  <option key={v.id} value={String(v.id)}>{v.label}</option>
                ))
              )}
            </select>
          )}
        </div>

        <div className="flex items-center gap-3">
          {bounds && (
            <span className="hidden tabular-nums text-[11px] text-slate-400 sm:block">
              N {bounds.north.toFixed(5)} · S {bounds.south.toFixed(5)} · E{' '}
              {bounds.east.toFixed(5)} · W {bounds.west.toFixed(5)}
            </span>
          )}
          <button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={!isDirty || !bounds || saveMutation.isPending}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white transition-all hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <CheckIcon className="h-4 w-4" />
            {saveMutation.isPending ? '저장 중…' : '경계 저장'}
          </button>
        </div>
      </div>

      {/* ── Map Area ── */}
      <div className="relative" style={{ height: 'calc(100vh - 116px)', width: '100%' }}>

        {isPhotosFetching && courseId && (
          <div className="absolute right-3 top-3 z-[2000] flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-600 shadow-md backdrop-blur-sm">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
            사진 로딩 중…
          </div>
        )}

        {!courseId && (
          <div className="absolute inset-0 z-[2000] flex flex-col items-center justify-center gap-3 bg-slate-50">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
              <MapPinIcon className="h-8 w-8 text-slate-300" />
            </div>
            <p className="text-[15px] font-semibold text-slate-600">골프장을 선택하세요</p>
          </div>
        )}

        {courseId && !hasCourseGps && (
          <div className="absolute inset-0 z-[2000] flex flex-col items-center justify-center gap-3 bg-slate-50">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
              <MapPinIcon className="h-8 w-8 text-slate-300" />
            </div>
            <p className="text-[15px] font-semibold text-slate-600">GPS 좌표를 먼저 설정하세요</p>
            <p className="text-sm text-slate-400">
              코스 설정에서 중심 좌표를 입력한 후 다시 방문해주세요.
            </p>
          </div>
        )}

        {noMapsAvailable && (
          <div className="absolute inset-0 z-[2000] flex flex-col items-center justify-center gap-3 bg-slate-50">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
              <MapPinIcon className="h-8 w-8 text-slate-300" />
            </div>
            <p className="text-[15px] font-semibold text-slate-600">드론 지도가 없습니다</p>
            <p className="text-sm text-slate-400">No drone map available</p>
          </div>
        )}

        {hasCourseGps && mapVersions.length > 0 && (
          <MapContainer
            key={courseId}
            ref={mapRef}
            center={[selectedCourse!.center_lat ?? DEFAULT_CENTER.lat, selectedCourse!.center_lng ?? DEFAULT_CENTER.lng]}
            zoom={selectedCourse?.default_zoom ?? DEFAULT_ZOOM}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom
            minZoom={14}
            maxZoom={19}
            attributionControl={false}
            zoomControl={true}
            whenReady={() => {
              setTimeout(() => {
                const m = mapRef.current
                if (m) {
                  m.invalidateSize()
                  // Signal that the map instance is ready so the markers effect can run
                  setMapReady(true)
                }
              }, 200)
            }}
          >
            {showDroneTiles ? (
              <TileLayer
                key={`drone-${activeTileFolder}`}
                url={`${mediaBase}/tiles/${activeTileFolder}/{z}/{x}/{y}.png`}
                attribution=""
                minZoom={14}
                maxZoom={19}
                minNativeZoom={14}
                maxNativeZoom={19}
                tileSize={256}
                tms={false}
                errorTileUrl=""
              />
            ) : (
              <TileLayer
                key="osm"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
            )}

            <MapLogger />
            <MapInitializer
              center={[selectedCourse!.center_lat ?? DEFAULT_CENTER.lat, selectedCourse!.center_lng ?? DEFAULT_CENTER.lng]}
              zoom={selectedCourse?.default_zoom ?? DEFAULT_ZOOM}
            />
            {showDroneTiles && tileSets.length > 0 && (
              <FitActiveTile tileFolder={activeTileFolder} tileSets={tileSets} />
            )}

            <MapController
              showDroneTiles={showDroneTiles}
              paddedMaxBounds={paddedMaxBounds}
              courseBoundBox={courseBoundBox}
            />

            {!showDroneTiles && courseBoundBox && <FitBounds bounds={courseBoundBox} />}

            {bounds && !showDroneTiles && (
              <Rectangle
                bounds={[
                  [bounds.south, bounds.west],
                  [bounds.north, bounds.east],
                ]}
                pathOptions={{
                  color: '#10b981',
                  fillColor: '#10b981',
                  fillOpacity: 0.12,
                  weight: 2,
                }}
              />
            )}

            {!showDroneTiles && (
              <Marker
                position={[selectedCourse!.center_lat!, selectedCourse!.center_lng!]}
              >
                <Popup>{selectedCourse!.name_ko}</Popup>
              </Marker>
            )}

            {/* Field photo pins are managed imperatively via markersLayerRef —
                see the useEffect above. No JSX markers here. */}
          </MapContainer>
        )}
      </div>
    </div>
  )
}
