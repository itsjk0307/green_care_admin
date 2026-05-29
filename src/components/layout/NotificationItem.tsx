import type { KeyboardEvent, MouseEvent } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { timeAgo } from '../../lib/issueUi'
import { notificationDotColor, notificationTargetPath } from '../../lib/notificationUi'
import { markAsRead } from '../../services/notificationService'
import type { AppNotification } from '../../types/notification'

type Props = {
  notification: AppNotification
  onRead?: () => void
  onDelete?: (id: string) => void
  onClose?: () => void
}

export function NotificationItem({
  notification,
  onRead,
  onDelete,
  onClose,
}: Props) {
  const navigate = useNavigate()

  const readMutation = useMutation({
    mutationFn: () => markAsRead(notification.id),
    onSuccess: () => onRead?.(),
  })

  const handleNavigate = () => {
    const path = notificationTargetPath(notification.reference_type)
    if (!notification.is_read) {
      readMutation.mutate()
    }
    if (path) {
      navigate(path)
      onClose?.()
    }
  }

  const handleDelete = (e: MouseEvent) => {
    e.stopPropagation()
    onDelete?.(notification.id)
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleNavigate()
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleNavigate}
      onKeyDown={handleKeyDown}
      className={`group flex cursor-pointer gap-3 px-4 py-3 transition hover:bg-[#F9FAFB] ${
        notification.is_read
          ? 'border-l-4 border-transparent bg-white'
          : 'border-l-4 border-[#60A5FA] bg-[#EFF6FF]'
      }`}
    >
      <span
        className={`mt-1.5 h-3 w-3 shrink-0 rounded-full ${notificationDotColor(notification.type)}`}
        aria-hidden
      />

      <div className="min-w-0 flex-1">
        <p
          className={`text-sm text-[#111827] ${
            notification.is_read ? 'font-normal' : 'font-medium'
          }`}
        >
          {notification.title_ko}
        </p>
        <p className="mt-0.5 line-clamp-2 text-sm text-[#6B7280]">
          {notification.body_ko}
        </p>
        <p className="mt-1 text-xs text-[#9CA3AF]">
          {timeAgo(notification.created_at)}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-2">
        {!notification.is_read ? (
          <span
            className="mt-1 h-2 w-2 rounded-full bg-[#10B981]"
            aria-label="읽지 않음"
          />
        ) : (
          <span className="mt-1 h-2 w-2" aria-hidden />
        )}
        <button
          type="button"
          onClick={handleDelete}
          className="rounded p-0.5 text-[#9CA3AF] opacity-0 transition hover:bg-[#F3F4F6] hover:text-[#374151] group-hover:opacity-100"
          aria-label="알림 삭제"
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
