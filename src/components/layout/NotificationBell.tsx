import { BellIcon } from '@heroicons/react/24/outline'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { getUnreadCount } from '../../services/notificationService'
import { NotificationDropdown } from './NotificationDropdown'

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()

  const unreadQuery = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: getUnreadCount,
    refetchInterval: 15_000,
    refetchIntervalInBackground: true,
  })

  const count = unreadQuery.data?.count ?? 0
  const badgeLabel = count > 99 ? '99+' : String(count)

  useEffect(() => {
    if (!isOpen) return
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [isOpen])

  const toggleOpen = () => {
    setIsOpen((prev) => {
      const next = !prev
      if (next) {
        void queryClient.invalidateQueries({ queryKey: ['notifications'] })
      }
      return next
    })
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        className={`relative flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-150 ${
          isOpen
            ? 'bg-[#121820] text-white shadow-[0_4px_12px_rgba(18,24,32,0.25)]'
            : 'text-slate-400 hover:bg-[#f0f4f1] hover:text-slate-700'
        }`}
        aria-label="알림"
        aria-expanded={isOpen}
      >
        <BellIcon className="h-5 w-5" />
        {count > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#ef4444] px-1 text-[10px] font-bold leading-none text-white shadow-[0_2px_6px_rgba(239,68,68,0.45)]">
            {badgeLabel}
          </span>
        ) : null}
      </button>

      {isOpen ? <NotificationDropdown onClose={() => setIsOpen(false)} /> : null}
    </div>
  )
}
