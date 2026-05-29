import { useState, useEffect, useCallback } from 'react'
import { Map, Rectangle } from 'react-kakao-maps-sdk'
import { useQuery, useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { CheckIcon, MapPinIcon } from '@heroicons/react/24/outline'
import { fetchCourses } from '../api/courses'
import { apiRequest, ApiError } from '../api/client'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'

const COURSE_STORAGE_KEY = 'greencare-course-map-course-id'

interface CourseGpsData {
  center_lat: number | null
  center_lng: number | null
  bound_north: number | null
  bound_south: number | null
  bound_east: number | null
  bound_west: number | null
  default_zoom: number | null
}

interface BoundsState {
  north: number
  south: number
  east: number
  west: number
}

function hasGps(
  data: CourseGpsData,
): data is CourseGpsData & { center_lat: number; center_lng: number } {
  return data.center_lat != null && data.center_lng != null
}

function hasBounds(
  data: CourseGpsData,
): data is CourseGpsData & {
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

function fetchCourseDetail(courseId: string): Promise<CourseGpsData> {
  return apiRequest<CourseGpsData>(`/courses/${courseId}`)
}

function patchCourseBounds(courseId: string, bounds: BoundsState): Promise<CourseGpsData> {
  return apiRequest<CourseGpsData>(`/courses/${courseId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      bound_north: bounds.north,
      bound_south: bounds.south,
      bound_east: bounds.east,
      bound_west: bounds.west,
    }),
  })
}

export function CourseMapPage() {
  const [courseId, setCourseId] = useState(
    () => localStorage.getItem(COURSE_STORAGE_KEY) ?? '',
  )
  const [bounds, setBounds] = useState<BoundsState | null>(null)
  const [isDirty, setIsDirty] = useState(false)

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

  const gpsQuery = useQuery({
    queryKey: ['course-gps', courseId],
    queryFn: () => fetchCourseDetail(courseId),
    enabled: !!courseId,
  })

  useEffect(() => {
    if (!gpsQuery.data) return
    const data = gpsQuery.data
    if (hasBounds(data)) {
      setBounds({
        north: data.bound_north,
        south: data.bound_south,
        east: data.bound_east,
        west: data.bound_west,
      })
    } else {
      setBounds(null)
    }
    setIsDirty(false)
  }, [gpsQuery.data])

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleDragEnd = useCallback((target: any) => {
    const nb = target.getBounds()
    const sw = nb.getSouthWest()
    const ne = nb.getNorthEast()
    setBounds({
      north: ne.getLat() as number,
      south: sw.getLat() as number,
      east: ne.getLng() as number,
      west: sw.getLng() as number,
    })
    setIsDirty(true)
  }, [])

  const selectedCourse = courses.find((c) => c.id === courseId)
  const gpsData = gpsQuery.data

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
            {selectedCourse
              ? (selectedCourse.name_ko || selectedCourse.name)
              : '코스 경계 설정'}
          </span>
          {courses.length > 1 && (
            <select
              value={courseId}
              onChange={(e) => {
                setCourseId(e.target.value)
                setBounds(null)
                setIsDirty(false)
              }}
              className="h-8 cursor-pointer rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name_ko || c.name}
                </option>
              ))}
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
      <div className="relative flex-1 overflow-hidden">
        {/* Loading GPS data */}
        {gpsQuery.isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-sm">
            <LoadingSpinner message="GPS 데이터 불러오는 중…" />
          </div>
        )}

        {/* No GPS coordinates set */}
        {!gpsQuery.isLoading && gpsData && !hasGps(gpsData) && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-50">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
              <MapPinIcon className="h-8 w-8 text-slate-300" />
            </div>
            <p className="text-[15px] font-semibold text-slate-600">
              GPS 좌표를 먼저 설정하세요
            </p>
            <p className="text-sm text-slate-400">
              코스 설정에서 중심 좌표를 입력한 후 다시 방문해주세요.
            </p>
          </div>
        )}

        {/* API error */}
        {gpsQuery.isError && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-slate-50">
            <p className="text-sm font-semibold text-red-500">
              {gpsQuery.error instanceof ApiError
                ? gpsQuery.error.message
                : '데이터를 불러올 수 없습니다'}
            </p>
          </div>
        )}

        {/* Kakao satellite map */}
        {gpsData && hasGps(gpsData) && (
          <Map
            key={courseId}
            center={{ lat: gpsData.center_lat, lng: gpsData.center_lng }}
            level={gpsData.default_zoom ?? 5}
            style={{ width: '100%', height: '100%' }}
            onCreate={(map) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const k = (window as any).kakao?.maps
              if (k) map.setMapTypeId(k.MapTypeId.SKYVIEW)
            }}
          >
            {bounds && (
              <Rectangle
                bounds={{
                  sw: { lat: bounds.south, lng: bounds.west },
                  ne: { lat: bounds.north, lng: bounds.east },
                }}
                strokeWeight={2}
                strokeColor="#10b981"
                strokeOpacity={1}
                strokeStyle="solid"
                fillColor="#10b981"
                fillOpacity={0.12}
                draggable
                onDragEnd={handleDragEnd}
              />
            )}
          </Map>
        )}
      </div>
    </div>
  )
}
