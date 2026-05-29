import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import * as L from 'leaflet'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'
import { getCourse, getFieldPhotos, getActiveWorkers, resolveMediaUrl } from '../../services/courseMapService'
import { CalibrationModal } from './CalibrationModal'
import { LoadingSpinner } from '../ui/LoadingSpinner'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl })

const CALIB_KEY_PREFIX = 'greencare_calibration_'

function loadCalibration(courseId) {
  try {
    const raw = localStorage.getItem(`${CALIB_KEY_PREFIX}${courseId}`)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function saveCalibration(courseId, data) {
  localStorage.setItem(`${CALIB_KEY_PREFIX}${courseId}`, JSON.stringify(data))
}

function gpsToLeaflet(lat, lng, calibration, imageHeight) {
  const p1 = calibration.point1
  const p2 = calibration.point2
  const scaleX = (p2.pixel_x - p1.pixel_x) / (p2.lng - p1.lng)
  const scaleY = (p2.pixel_y - p1.pixel_y) / (p2.lat - p1.lat)
  const pixel_x = p1.pixel_x + (lng - p1.lng) * scaleX
  const pixel_y = p1.pixel_y + (lat - p1.lat) * scaleY
  return [imageHeight - pixel_y, pixel_x]
}

function timeAgo(dateString) {
  if (!dateString) return ''
  const diffMin = Math.floor((Date.now() - new Date(dateString).getTime()) / 60000)
  if (diffMin < 1) return '방금 전'
  if (diffMin < 60) return `${diffMin}분 전`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour}시간 전`
  return `${Math.floor(diffHour / 24)}일 전`
}

function createCameraIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="width:40px;height:40px;background:#1B5E20;border:3px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 3px 10px rgba(0,0,0,0.35);cursor:pointer;">📷</div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -22],
  })
}

function createWorkerIcon(name) {
  const initial = name ? name.charAt(0) : '?'
  return L.divIcon({
    className: '',
    html: `<div style="width:34px;height:34px;background:#3B82F6;border:3px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:white;box-shadow:0 3px 10px rgba(0,0,0,0.35);">${initial}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -19],
  })
}

export function LeafletMap({ courseId, onPhotoClick }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const imageHeightRef = useRef(0)
  const imageWidthRef = useRef(0)
  const photoMarkersRef = useRef([])
  const workerMarkersRef = useRef([])
  const [mapReady, setMapReady] = useState(false)

  const [calibration, setCalibration] = useState(() => loadCalibration(courseId))
  const [calibrationStep, setCalibrationStep] = useState(0)
  const [pendingPixel, setPendingPixel] = useState(null)
  const [showCalibModal, setShowCalibModal] = useState(false)
  const [tempPoint1, setTempPoint1] = useState(null)

  const calibrationStepRef = useRef(0)
  const onPhotoClickRef = useRef(onPhotoClick)
  useEffect(() => { onPhotoClickRef.current = onPhotoClick }, [onPhotoClick])
  useEffect(() => { calibrationStepRef.current = calibrationStep }, [calibrationStep])

  const courseQuery = useQuery({
    queryKey: ['course-detail', courseId],
    queryFn: () => getCourse(courseId),
    enabled: Boolean(courseId),
    staleTime: 5 * 60_000,
  })

  const photosQuery = useQuery({
    queryKey: ['field-photos', courseId],
    queryFn: () => getFieldPhotos(courseId),
    enabled: Boolean(courseId),
    refetchInterval: 30_000,
  })

  const workersQuery = useQuery({
    queryKey: ['active-workers', courseId],
    queryFn: () => getActiveWorkers(courseId),
    enabled: Boolean(courseId),
    refetchInterval: 30_000,
  })

  const imageUrl = resolveMediaUrl(courseQuery.data?.map_image_path)
  const photos = Array.isArray(photosQuery.data) ? photosQuery.data : []
  const workers = Array.isArray(workersQuery.data) ? workersQuery.data : []

  // ── Map initialization ──────────────────────────────────────────────────
  useEffect(() => {
    if (!imageUrl) return
    let mounted = true
    let mapInstance = null

    const img = new Image()
    img.onload = () => {
      if (!mounted || !containerRef.current) return

      const h = img.naturalHeight
      const w = img.naturalWidth
      imageHeightRef.current = h
      imageWidthRef.current = w

      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }

      mapInstance = L.map(containerRef.current, {
        crs: L.CRS.Simple,
        minZoom: -2,
        maxZoom: 2,
        zoomSnap: 0.25,
        attributionControl: false,
        zoomControl: true,
      })

      const bounds = [[0, 0], [h, w]]
      L.imageOverlay(imageUrl, bounds).addTo(mapInstance)
      mapInstance.fitBounds(bounds)

      mapRef.current = mapInstance
      setMapReady(true)
    }

    img.src = imageUrl

    return () => {
      mounted = false
      if (mapInstance) {
        mapInstance.remove()
      }
      mapRef.current = null
      photoMarkersRef.current = []
      workerMarkersRef.current = []
      setMapReady(false)
    }
  }, [imageUrl])

  // ── Calibration click listener ──────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return

    const map = mapRef.current

    function onMapClick(e) {
      if (calibrationStepRef.current === 0) return
      const pixel_x = e.latlng.lng
      const pixel_y = imageHeightRef.current - e.latlng.lat
      setPendingPixel({ x: pixel_x, y: pixel_y })
      setShowCalibModal(true)
    }

    map.on('click', onMapClick)
    return () => { map.off('click', onMapClick) }
  }, [mapReady])

  // ── Photo markers ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return

    photoMarkersRef.current.forEach((m) => m.remove())
    photoMarkersRef.current = []

    const map = mapRef.current
    const h = imageHeightRef.current
    const cameraIcon = createCameraIcon()

    photos.forEach((photo) => {
      let pos

      if (
        calibration &&
        photo.gps_latitude != null &&
        photo.gps_longitude != null
      ) {
        pos = gpsToLeaflet(
          Number(photo.gps_latitude),
          Number(photo.gps_longitude),
          calibration,
          h,
        )
      } else if (!calibration && photo.gps_latitude != null) {
        // No calibration — skip GPS markers (banner explains why)
        return
      } else {
        return
      }

      const marker = L.marker(pos, { icon: cameraIcon })

      const tooltipContent = `
        <div style="min-width:140px;padding:2px 0">
          <div style="font-weight:700;font-size:13px;color:#111827">${photo.worker_name ?? ''}</div>
          ${photo.notes ? `<div style="margin-top:3px;font-size:12px;color:#6B7280">${photo.notes}</div>` : ''}
          <div style="margin-top:4px;font-size:11px;color:#9CA3AF">${timeAgo(photo.created_at)}</div>
        </div>
      `
      marker.bindTooltip(tooltipContent, { direction: 'top', offset: [0, -22] })

      marker.on('click', () => {
        onPhotoClickRef.current?.(photo)
      })

      marker.addTo(map)
      photoMarkersRef.current.push(marker)
    })
  }, [mapReady, photos, calibration])

  // ── Worker markers ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return

    workerMarkersRef.current.forEach((m) => m.remove())
    workerMarkersRef.current = []

    if (!calibration) return

    const map = mapRef.current
    const h = imageHeightRef.current

    workers.forEach((worker) => {
      if (worker.latitude == null || worker.longitude == null) return

      const pos = gpsToLeaflet(
        Number(worker.latitude),
        Number(worker.longitude),
        calibration,
        h,
      )

      const marker = L.marker(pos, { icon: createWorkerIcon(worker.worker_name) })

      const tooltipContent = `
        <div style="text-align:center;padding:2px 0">
          <div style="font-weight:700;font-size:12px;color:#111827">${worker.worker_name ?? ''}</div>
          <div style="font-size:10px;color:#6B7280;margin-top:2px">실시간 위치</div>
        </div>
      `
      marker.bindTooltip(tooltipContent, {
        permanent: true,
        direction: 'bottom',
        offset: [0, 14],
        className: 'leaflet-tooltip-worker',
      })

      marker.addTo(map)
      workerMarkersRef.current.push(marker)
    })
  }, [mapReady, workers, calibration])

  // ── Calibration modal confirm ───────────────────────────────────────────
  function handleCalibConfirm({ lat, lng }) {
    setShowCalibModal(false)

    if (calibrationStep === 1) {
      setTempPoint1({ pixel_x: pendingPixel.x, pixel_y: pendingPixel.y, lat, lng })
      setPendingPixel(null)
      setCalibrationStep(2)
    } else if (calibrationStep === 2) {
      const newCalib = {
        point1: tempPoint1,
        point2: { pixel_x: pendingPixel.x, pixel_y: pendingPixel.y, lat, lng },
      }
      saveCalibration(courseId, newCalib)
      setCalibration(newCalib)
      setTempPoint1(null)
      setPendingPixel(null)
      setCalibrationStep(0)
      toast.success('보정 완료! 이제 GPS 핀이 정확한 위치에 표시됩니다.')
    }
  }

  function handleCalibCancel() {
    setShowCalibModal(false)
    setPendingPixel(null)
    setCalibrationStep(0)
    setTempPoint1(null)
  }

  function startCalibration() {
    setCalibrationStep(1)
    setTempPoint1(null)
  }

  function resetCalibration() {
    localStorage.removeItem(`${CALIB_KEY_PREFIX}${courseId}`)
    setCalibration(null)
    setCalibrationStep(0)
    setTempPoint1(null)
  }

  // ── Render states ───────────────────────────────────────────────────────
  if (!courseId) {
    return (
      <div className="flex h-full items-center justify-center bg-[#F7F8F7] text-sm text-slate-400">
        골프장을 선택하세요
      </div>
    )
  }

  if (courseQuery.isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#F7F8F7]">
        <LoadingSpinner message="코스 지도 불러오는 중…" />
      </div>
    )
  }

  if (courseQuery.isError || !imageUrl) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 bg-[#F7F8F7] text-sm text-slate-400">
        <span className="text-3xl">🗺️</span>
        <p>코스 지도 이미지를 불러올 수 없습니다</p>
        <p className="text-xs">관리자에게 문의하거나 코스 설정에서 지도 이미지를 업로드하세요</p>
      </div>
    )
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-900">
      {/* Leaflet map container — must have explicit height for Leaflet */}
      <div
        ref={containerRef}
        style={{ height: '100%', width: '100%' }}
      />

      {/* No calibration banner */}
      {mapReady && !calibration && calibrationStep === 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-4 z-[1000] flex justify-center px-4">
          <div className="pointer-events-auto max-w-lg rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-xl">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 shrink-0 text-xl">📍</span>
              <div className="flex-1">
                <p className="font-bold text-amber-900">지도 보정이 필요합니다</p>
                <p className="mt-1 text-sm text-amber-700">
                  두 지점을 클릭하여 실제 GPS 좌표를 입력하면 작업자 위치와 사진 핀이 정확하게 표시됩니다.
                </p>
                <button
                  type="button"
                  onClick={startCalibration}
                  className="mt-3 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
                >
                  보정 시작하기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Calibration step 1 banner */}
      {calibrationStep === 1 && (
        <div className="pointer-events-none absolute inset-x-0 top-4 z-[1000] flex justify-center px-4">
          <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-3.5 shadow-xl">
            <span className="text-lg">🖱️</span>
            <div>
              <p className="font-bold text-blue-900">1번 지점을 지도에서 클릭하세요</p>
              <p className="text-sm text-blue-700">예: 클럽하우스 모서리</p>
            </div>
            <button
              type="button"
              onClick={handleCalibCancel}
              className="ml-2 rounded-lg px-3 py-1.5 text-xs font-semibold text-blue-500 transition-colors hover:bg-blue-100"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* Calibration step 2 banner */}
      {calibrationStep === 2 && (
        <div className="pointer-events-none absolute inset-x-0 top-4 z-[1000] flex justify-center px-4">
          <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-3.5 shadow-xl">
            <span className="text-lg">🖱️</span>
            <div>
              <p className="font-bold text-blue-900">2번 지점을 클릭하세요</p>
              <p className="text-sm text-blue-700">1번 지점과 멀리 떨어진 곳을 선택하세요</p>
            </div>
            <button
              type="button"
              onClick={handleCalibCancel}
              className="ml-2 rounded-lg px-3 py-1.5 text-xs font-semibold text-blue-500 transition-colors hover:bg-blue-100"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* Calibration complete — reset button */}
      {mapReady && calibration && calibrationStep === 0 && (
        <div className="absolute bottom-4 right-4 z-[1000]">
          <button
            type="button"
            onClick={resetCalibration}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-500 shadow-md transition-all hover:bg-slate-50 hover:text-slate-700"
          >
            🔧 보정 초기화
          </button>
        </div>
      )}

      {/* Calibration cursor indicator */}
      {calibrationStep > 0 && (
        <style>{`
          .leaflet-container { cursor: crosshair !important; }
        `}</style>
      )}

      {/* Photo count badge */}
      {mapReady && photos.length > 0 && (
        <div className="absolute bottom-4 left-4 z-[1000] flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-md">
          <span>📷 {photos.length}장</span>
          {workers.length > 0 && <span className="text-slate-300">|</span>}
          {workers.length > 0 && <span>🔵 작업자 {workers.length}명</span>}
        </div>
      )}

      {/* Calibration modal */}
      {showCalibModal && (
        <CalibrationModal
          onConfirm={handleCalibConfirm}
          onCancel={handleCalibCancel}
        />
      )}
    </div>
  )
}
