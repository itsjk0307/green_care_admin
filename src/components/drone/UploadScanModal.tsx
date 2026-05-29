import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react'
import toast from 'react-hot-toast'
import { ApiError } from '../../api/client'
import {
  analyzeScan,
  getGolfCourses,
  uploadDroneScan,
} from '../../services/droneScanService'
import { formatFileSize, todayLocalDate } from '../../lib/formatScanDate'
import { Button } from '../ui/Button'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { Modal } from '../ui/Modal'

const MAX_BYTES = 50 * 1024 * 1024
const ACCEPTED = ['image/jpeg', 'image/png']

type Props = {
  open: boolean
  onClose: () => void
  defaultCourseId?: string
  onSuccess: (scanId: string) => void
}

type Step = 'idle' | 'uploading' | 'analyzing' | 'done'

const inputClass =
  'h-10 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#111827] outline-none focus:border-[#1B5E20]'
const labelClass = 'mb-1.5 block text-[13px] font-bold text-[#374151]'

export function UploadScanModal({
  open,
  onClose,
  defaultCourseId,
  onSuccess,
}: Props) {
  const queryClient = useQueryClient()
  const [courseId, setCourseId] = useState(defaultCourseId ?? '')
  const [scanDate, setScanDate] = useState(todayLocalDate())
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [step, setStep] = useState<Step>('idle')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const coursesQuery = useQuery({
    queryKey: ['golf-courses'],
    queryFn: getGolfCourses,
    enabled: open,
  })

  useEffect(() => {
    if (open && defaultCourseId) setCourseId(defaultCourseId)
  }, [open, defaultCourseId])

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const resetForm = useCallback(() => {
    setScanDate(todayLocalDate())
    setNotes('')
    setFile(null)
    setDragOver(false)
    setStep('idle')
    if (!defaultCourseId) setCourseId('')
  }, [defaultCourseId])

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!courseId) throw new ApiError('골프장을 선택하세요.', 400)
      if (!file) throw new ApiError('이미지를 업로드하세요.', 400)

      const formData = new FormData()
      formData.append('course_id', courseId)
      formData.append('scan_date', scanDate)
      if (notes.trim()) formData.append('notes', notes.trim())
      formData.append('image', file)

      setStep('uploading')
      const uploaded = await uploadDroneScan(formData)

      setStep('analyzing')
      await analyzeScan(uploaded.id)
      return uploaded.id
    },
    onSuccess: (scanId) => {
      setStep('done')
      toast.success('AI 분석 요청 완료! 결과를 기다려주세요.', {
        className: 'gc-toast-success',
      })
      void queryClient.invalidateQueries({ queryKey: ['drone-scans'] })
      resetForm()
      onSuccess(scanId)
      onClose()
    },
    onError: (err) => {
      setStep('idle')
      const message =
        err instanceof ApiError ? err.message : '업로드에 실패했습니다.'
      toast.error(message, { className: 'gc-toast-error' })
    },
  })

  function validateFile(next: File): boolean {
    if (!ACCEPTED.includes(next.type)) {
      toast.error('JPG 또는 PNG 파일만 업로드 가능합니다', {
        className: 'gc-toast-error',
      })
      return false
    }
    if (next.size > MAX_BYTES) {
      toast.error('파일 크기는 50MB 이하여야 합니다', {
        className: 'gc-toast-error',
      })
      return false
    }
    return true
  }

  function pickFile(next: File | null) {
    if (!next) return
    if (!validateFile(next)) return
    setFile(next)
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer.files?.[0]
    if (dropped) pickFile(dropped)
  }

  function handleClose() {
    if (submitMutation.isPending) return
    resetForm()
    onClose()
  }

  const busy = submitMutation.isPending
  const courses = coursesQuery.data ?? []

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="새 드론 스캔 업로드"
      className="max-w-xl"
    >
      {coursesQuery.isLoading ? (
        <LoadingSpinner message="골프장 목록 불러오는 중…" />
      ) : coursesQuery.isError ? (
        <p className="text-sm text-[#DC2626]">
          골프장 목록을 불러오지 못했습니다.
        </p>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            submitMutation.mutate()
          }}
        >
          <div>
            <label htmlFor="upload-course" className={labelClass}>
              골프장 선택 <span className="text-[#EF4444]">*</span>
            </label>
            <select
              id="upload-course"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className={inputClass}
              required
              disabled={busy}
            >
              <option value="">선택하세요</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name_ko || c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="upload-date" className={labelClass}>
              스캔 날짜 <span className="text-[#EF4444]">*</span>
            </label>
            <input
              id="upload-date"
              type="date"
              value={scanDate}
              onChange={(e) => setScanDate(e.target.value)}
              className={inputClass}
              required
              disabled={busy}
            />
          </div>

          <div>
            <label htmlFor="upload-notes" className={labelClass}>
              메모
            </label>
            <textarea
              id="upload-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="스캔에 대한 메모를 입력하세요"
              disabled={busy}
              className="w-full resize-none rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#1B5E20] disabled:opacity-60"
            />
          </div>

          <div>
            <p className={labelClass}>
              이미지 업로드 <span className="text-[#EF4444]">*</span>
            </p>
            <div
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click()
              }}
              onClick={() => !busy && fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={`flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
                dragOver
                  ? 'border-[#1B5E20] bg-[#F0FDF4]'
                  : 'border-[#E5E7EB] bg-[#F9FAFB] hover:border-[#1B5E20]/40'
              } ${busy ? 'pointer-events-none opacity-60' : ''}`}
            >
              <p className="text-sm font-medium text-[#374151]">
                여기에 이미지를 드래그하거나 클릭하여 선택
              </p>
              <p className="mt-1 text-xs text-[#6B7280]">JPG, PNG · 최대 50MB</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              disabled={busy}
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
            {file && previewUrl ? (
              <div className="mt-3 rounded-xl border border-[#EEEEEE] p-3">
                <img
                  src={previewUrl}
                  alt="미리보기"
                  className="mb-2 max-h-40 w-full rounded-lg object-contain bg-[#111827]/5"
                />
                <p className="text-sm font-medium text-[#111827]">{file.name}</p>
                <p className="text-xs text-[#6B7280]">{formatFileSize(file.size)}</p>
                <button
                  type="button"
                  className="mt-2 text-xs font-semibold text-[#1B5E20] underline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busy}
                >
                  다른 파일 선택
                </button>
              </div>
            ) : null}
          </div>

          {step === 'uploading' ? (
            <p className="rounded-lg bg-[#F0FDF4] px-3 py-2 text-sm text-[#166534]">
              업로드 완료 ✓ → AI 분석 시작 중...
            </p>
          ) : null}
          {step === 'analyzing' ? (
            <p className="flex items-center gap-2 rounded-lg bg-[#FFFBEB] px-3 py-2 text-sm text-[#92400E]">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#F59E0B] border-t-transparent" />
              AI 분석 요청 중...
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={handleClose}
              disabled={busy}
            >
              취소
            </Button>
            <Button type="submit" loading={busy}>
              업로드 후 AI 분석 시작 →
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
