import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeftIcon,
  CloudArrowUpIcon,
  PhotoIcon,
} from '@heroicons/react/24/outline'
import { apiRequest, ApiError } from '../api/client'
import { apiOrigin } from '../config'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import type { GolfCourse } from '../types/api'

const MAX_SIZE = 10 * 1024 * 1024
const ACCEPTED = ['image/jpeg', 'image/png']

function buildStaticMapUrl(courseId: string): string {
  return `${apiOrigin()}/storage/maps/${courseId}.jpg`
}

function buildUploadedMapUrl(mapUrl: string, bust: number): string {
  return `${apiOrigin()}${mapUrl}?t=${bust}`
}

export function CourseMapUploadPage() {
  const { courseId = '' } = useParams<{ courseId: string }>()

  const [course, setCourse] = useState<GolfCourse | null>(null)
  const [loadingCourse, setLoadingCourse] = useState(true)
  const [courseError, setCourseError] = useState<string | null>(null)

  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewFailed, setPreviewFailed] = useState(false)

  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<{ ok: boolean; message: string } | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!courseId) return
    setLoadingCourse(true)
    apiRequest<GolfCourse>(`/courses/${courseId}`)
      .then((data) => {
        setCourse(data)
        if (data.map_image_path !== null) {
          setPreviewUrl(buildStaticMapUrl(courseId))
        }
      })
      .catch((err: unknown) => {
        setCourseError(
          err instanceof ApiError ? err.message : '골프장 정보를 불러올 수 없습니다.',
        )
      })
      .finally(() => setLoadingCourse(false))
  }, [courseId])

  function validateAndSet(f: File | null) {
    setFileError(null)
    setUploadResult(null)
    if (!f) {
      setFile(null)
      return
    }
    if (!ACCEPTED.includes(f.type)) {
      setFileError('JPEG 또는 PNG 파일만 업로드할 수 있습니다.')
      setFile(null)
      return
    }
    if (f.size > MAX_SIZE) {
      setFileError(
        `파일 크기는 10MB를 초과할 수 없습니다. (현재: ${(f.size / 1024 / 1024).toFixed(1)} MB)`,
      )
      setFile(null)
      return
    }
    setFile(f)
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    validateAndSet(e.target.files?.[0] ?? null)
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    validateAndSet(e.dataTransfer.files[0] ?? null)
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => setDragging(false), [])

  async function handleUpload() {
    if (!file || uploading) return
    setUploading(true)
    setUploadResult(null)
    try {
      const fd = new FormData()
      fd.append('map_image', file)
      const result = await apiRequest<{ map_url: string }>(`/courses/${courseId}/map`, {
        method: 'POST',
        body: fd,
      })
      const bust = Date.now()
      setPreviewUrl(buildUploadedMapUrl(result.map_url, bust))
      setPreviewFailed(false)
      setFile(null)
      setUploadResult({ ok: true, message: '지도 이미지가 성공적으로 업로드되었습니다.' })
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : '업로드 중 오류가 발생했습니다.'
      setUploadResult({ ok: false, message: msg })
    } finally {
      setUploading(false)
    }
  }

  if (loadingCourse) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner message="골프장 정보 불러오는 중…" />
      </div>
    )
  }

  if (courseError) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <p className="text-sm text-red-500">{courseError}</p>
        <Link
          to="/course-map"
          className="text-sm font-medium text-emerald-600 transition-colors hover:text-emerald-700"
        >
          ← 현장 지도로 돌아가기
        </Link>
      </div>
    )
  }

  const courseName = course ? (course.name_ko || course.name) : courseId
  const hasMap = previewUrl !== null && !previewFailed

  return (
    <div className="mx-auto max-w-5xl">
      {/* Breadcrumb header */}
      <div className="mb-6 flex items-center gap-2">
        <Link
          to="/course-map"
          className="flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          현장 지도
        </Link>
        <span className="text-slate-300">/</span>
        <h1 className="text-base font-semibold text-slate-900">
          {courseName} — 지도 이미지 업로드
        </h1>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* ── Left: upload zone ── */}
        <Card padding="lg" className="flex flex-col gap-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">새 지도 이미지</h2>
            <p className="mt-1 text-xs text-slate-400">JPEG 또는 PNG · 최대 10 MB</p>
          </div>

          {/* Drop zone */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed py-14 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-emerald-400 ${
              dragging
                ? 'border-emerald-400 bg-emerald-50'
                : 'border-slate-200 hover:border-emerald-300 hover:bg-slate-50'
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={handleFileInput}
            />
            <CloudArrowUpIcon
              className={`h-10 w-10 transition-colors ${dragging ? 'text-emerald-500' : 'text-slate-300'}`}
            />
            {file ? (
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-800">{file.name}</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-sm font-medium text-slate-600">
                  클릭하거나 파일을 여기에 드래그하세요
                </p>
                <p className="mt-0.5 text-xs text-slate-400">JPEG, PNG</p>
              </div>
            )}
          </div>

          {fileError && (
            <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">{fileError}</p>
          )}

          {uploadResult && (
            <p
              className={`rounded-xl px-4 py-2.5 text-sm ${
                uploadResult.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
              }`}
            >
              {uploadResult.message}
            </p>
          )}

          <Button
            variant="primary"
            size="lg"
            disabled={!file}
            loading={uploading}
            onClick={handleUpload}
            className="w-full"
            icon={<CloudArrowUpIcon className="h-4 w-4" />}
          >
            업로드
          </Button>
        </Card>

        {/* ── Right: preview ── */}
        <Card padding="lg" className="flex flex-col gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">현재 지도 미리보기</h2>
            {hasMap && (
              <p className="mt-1 text-xs text-slate-400">업로드 후 자동으로 갱신됩니다</p>
            )}
          </div>

          {hasMap ? (
            <div className="overflow-hidden rounded-xl border border-slate-100">
              <img
                key={previewUrl}
                src={previewUrl ?? undefined}
                alt={`${courseName} 코스 지도`}
                className="h-auto w-full object-contain"
                onError={() => setPreviewFailed(true)}
              />
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-100 py-24">
              <PhotoIcon className="h-12 w-12 text-slate-200" />
              <p className="text-sm text-slate-400">등록된 지도 이미지가 없습니다</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
