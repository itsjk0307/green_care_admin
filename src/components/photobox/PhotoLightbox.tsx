import { useCallback, useEffect } from 'react'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { formatKoreanScanDate } from '../../lib/formatScanDate'
import { photoFullUrl } from '../../services/photoService'
import type { WorkPhoto } from '../../types/photo'

type Props = {
  photos: WorkPhoto[]
  index: number
  onClose: () => void
  onIndexChange: (index: number) => void
}

function photoTypeLabel(type: WorkPhoto['photo_type']): string {
  if (type === 'before') return '작업전'
  if (type === 'after') return '작업후'
  return '—'
}

export function PhotoLightbox({
  photos,
  index,
  onClose,
  onIndexChange,
}: Props) {
  const photo = photos[index]
  const hasMany = photos.length > 1

  const prev = useCallback(() => {
    onIndexChange((index - 1 + photos.length) % photos.length)
  }, [photos.length, index, onIndexChange])

  const next = useCallback(() => {
    onIndexChange((index + 1) % photos.length)
  }, [photos.length, index, onIndexChange])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, prev, next])

  if (!photo) return null

  const src = photoFullUrl(photo)
  const date = photo.taken_at ?? photo.created_at
  const workTypes = photo.work_types?.join(', ') ?? '—'

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/90">
      <button
        type="button"
        className="absolute right-6 top-6 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
        onClick={onClose}
        aria-label="닫기"
      >
        <XMarkIcon className="h-6 w-6" />
      </button>

      {hasMany ? (
        <button
          type="button"
          className="absolute left-4 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 md:left-10"
          onClick={prev}
          aria-label="이전"
        >
          <ChevronLeftIcon className="h-7 w-7" />
        </button>
      ) : null}

      <div className="flex flex-1 items-center justify-center px-4 pt-16 pb-28">
        <img
          src={src}
          alt=""
          className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain"
        />
      </div>

      {hasMany ? (
        <button
          type="button"
          className="absolute right-4 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 md:right-10"
          onClick={next}
          aria-label="다음"
        >
          <ChevronRightIcon className="h-7 w-7" />
        </button>
      ) : null}

      <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-6 py-4 text-sm text-white">
        <p className="flex flex-wrap gap-x-4 gap-y-1">
          <span>
            <strong className="font-semibold text-white/70">홀</strong>{' '}
            {photo.hole_number}홀
          </span>
          <span>
            <strong className="font-semibold text-white/70">날짜</strong>{' '}
            {formatKoreanScanDate(date)}
          </span>
          <span>
            <strong className="font-semibold text-white/70">작업자</strong>{' '}
            {photo.worker_name ?? '—'}
          </span>
          <span>
            <strong className="font-semibold text-white/70">유형</strong>{' '}
            {photoTypeLabel(photo.photo_type)}
          </span>
          <span>
            <strong className="font-semibold text-white/70">작업</strong>{' '}
            {workTypes}
          </span>
        </p>
        {photo.notes ? (
          <p className="mt-2 text-white/80">
            <strong className="text-white/70">메모</strong> {photo.notes}
          </p>
        ) : null}
      </div>
    </div>
  )
}
