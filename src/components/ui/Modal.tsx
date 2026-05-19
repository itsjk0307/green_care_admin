import { useEffect, type ReactNode } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'

type Props = {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  className?: string
}

export function Modal({ open, onClose, title, children, className = '' }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 transition-opacity duration-200"
        aria-label="닫기"
        onClick={onClose}
      />
      <div
        className={`relative z-10 w-full max-w-lg rounded-2xl bg-white p-6 shadow-[var(--shadow-gc-modal)] transition-all duration-200 ease-out ${className}`}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          {title ? (
            <h2 className="text-base font-semibold text-[#111827]">{title}</h2>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded-lg p-1 text-[#9CA3AF] transition-colors hover:bg-[#F3F4F6] hover:text-[#374151]"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
