import { useCallback, useEffect } from 'react'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'

type Props = {
  open: boolean
  images: string[]
  index: number
  caption: string
  onClose: () => void
  onIndexChange: (i: number) => void
}

export function PhotoViewerModal({
  open,
  images,
  index,
  caption,
  onClose,
  onIndexChange,
}: Props) {
  const hasMany = images.length > 1

  const prev = useCallback(() => {
    onIndexChange((index - 1 + images.length) % images.length)
  }, [images.length, index, onIndexChange])

  const next = useCallback(() => {
    onIndexChange((index + 1) % images.length)
  }, [images.length, index, onIndexChange])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, prev, next])

  if (!open || images.length === 0) return null

  const src = images[index] ?? images[0]

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90">
      <button
        type="button"
        className="absolute right-6 top-6 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
        onClick={onClose}
        aria-label="닫기"
      >
        <XMarkIcon className="h-6 w-6" />
      </button>

      {hasMany ? (
        <button
          type="button"
          className="absolute left-4 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 md:left-10"
          onClick={prev}
          aria-label="이전"
        >
          <ChevronLeftIcon className="h-7 w-7" />
        </button>
      ) : null}

      <div className="flex max-h-[80vh] max-w-[80vw] flex-col items-center px-16">
        <img
          src={src}
          alt=""
          className="max-h-[80vh] max-w-[80vw] rounded-xl object-contain shadow-2xl"
        />
        <p className="mt-4 text-center text-sm text-white/90">{caption}</p>
      </div>

      {hasMany ? (
        <button
          type="button"
          className="absolute right-4 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 md:right-10"
          onClick={next}
          aria-label="다음"
        >
          <ChevronRightIcon className="h-7 w-7" />
        </button>
      ) : null}
    </div>
  )
}
