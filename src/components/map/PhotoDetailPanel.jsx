import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { updatePhotoStatus, resolveMediaUrl } from '../../services/courseMapService'

const STATUS_CHIPS = [
  { key: 'open', label: '열림', emoji: '🔴', active: 'bg-red-500 text-white border-red-500', inactive: 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50' },
  { key: 'in_progress', label: '진행중', emoji: '🟡', active: 'bg-amber-400 text-white border-amber-400', inactive: 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50' },
  { key: 'resolved', label: '해결됨', emoji: '🟢', active: 'bg-emerald-500 text-white border-emerald-500', inactive: 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50' },
]

function formatKoreanDateTime(dateString) {
  if (!dateString) return ''
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return dateString
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours()
  const minute = date.getMinutes()
  const ampm = hour < 12 ? '오전' : '오후'
  const hour12 = hour % 12 || 12
  return `${year}년 ${month}월 ${day}일 ${ampm} ${hour12}:${String(minute).padStart(2, '0')}`
}

function timeAgo(dateString) {
  if (!dateString) return ''
  const date = new Date(dateString)
  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return '방금 전'
  if (diffMin < 60) return `${diffMin}분 전`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour}시간 전`
  return `${Math.floor(diffHour / 24)}일 전`
}

export function PhotoDetailPanel({ photo, courseId, onClose, onStatusUpdate }) {
  const queryClient = useQueryClient()
  const [updating, setUpdating] = useState(false)
  const [currentStatus, setCurrentStatus] = useState(photo?.status ?? 'open')

  const imageUrl = resolveMediaUrl(photo?.image_url)
  const workerInitial = photo?.worker_name ? photo.worker_name.charAt(0) : '?'

  async function handleStatusClick(status) {
    if (status === currentStatus || updating) return
    setUpdating(true)
    try {
      await updatePhotoStatus(photo.id, status)
      setCurrentStatus(status)
      toast.success('상태가 업데이트되었습니다.')
      await queryClient.invalidateQueries({ queryKey: ['field-photos', courseId] })
      onStatusUpdate?.()
    } catch {
      toast.error('상태 업데이트에 실패했습니다.')
    } finally {
      setUpdating(false)
    }
  }

  if (!photo) return null

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className="fixed inset-0 z-[400] bg-black/30 md:hidden"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={[
          'fixed z-[500] bg-white shadow-2xl',
          // Mobile: slide up from bottom
          'bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto rounded-t-2xl',
          // Desktop: right sidebar
          'md:bottom-0 md:left-auto md:right-0 md:top-0 md:h-full md:w-[380px] md:max-h-none md:rounded-none md:rounded-l-2xl',
        ].join(' ')}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-base font-bold text-white">
            {workerInitial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-900">{photo.worker_name}</p>
            <p className="text-xs text-slate-400">{timeAgo(photo.created_at)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Photo */}
        <div className="px-5 pt-4">
          {imageUrl ? (
            <a href={imageUrl} target="_blank" rel="noopener noreferrer" className="block">
              <img
                src={imageUrl}
                alt="현장 사진"
                className="h-[220px] w-full rounded-xl object-cover"
              />
            </a>
          ) : (
            <div className="flex h-[220px] w-full items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-400">
              이미지 없음
            </div>
          )}
        </div>

        {/* Details */}
        <div className="space-y-3 px-5 py-4">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="mb-0.5 text-xs font-semibold text-slate-500">📍 GPS 위치</p>
            <p className="text-sm text-slate-700">
              {photo.gps_latitude != null && photo.gps_longitude != null
                ? `${Number(photo.gps_latitude).toFixed(6)}, ${Number(photo.gps_longitude).toFixed(6)}`
                : 'GPS 정보 없음'}
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 p-3">
            <p className="mb-0.5 text-xs font-semibold text-slate-500">📝 메모</p>
            {photo.notes ? (
              <p className="text-sm text-slate-700">{photo.notes}</p>
            ) : (
              <p className="text-sm italic text-slate-400">메모 없음</p>
            )}
          </div>

          <div className="rounded-xl bg-slate-50 p-3">
            <p className="mb-0.5 text-xs font-semibold text-slate-500">🕐 촬영 시간</p>
            <p className="text-sm text-slate-700">{formatKoreanDateTime(photo.created_at)}</p>
          </div>
        </div>

        {/* Status */}
        <div className="px-5 pb-4">
          <p className="mb-2 text-xs font-semibold text-slate-500">상태</p>
          <div className="flex gap-2">
            {STATUS_CHIPS.map((chip) => (
              <button
                key={chip.key}
                type="button"
                disabled={updating}
                onClick={() => handleStatusClick(chip.key)}
                className={`flex-1 rounded-xl border py-2 text-xs font-semibold transition-all disabled:opacity-60 ${
                  currentStatus === chip.key ? chip.active : chip.inactive
                }`}
              >
                {chip.emoji} {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 pb-6">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-sm font-semibold text-slate-600 transition-all hover:bg-slate-100"
          >
            닫기
          </button>
        </div>
      </div>
    </>
  )
}
