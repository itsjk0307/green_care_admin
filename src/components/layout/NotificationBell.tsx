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
    queryKey: ['unread-count'],
    queryFn: getUnreadCount,
    refetchInterval: 60_000,
    staleTime: 30_000,
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
        className="relative rounded-lg p-2 text-slate-400 transition-all duration-150 hover:bg-slate-100 hover:text-slate-700"
        aria-label="알림"
        aria-expanded={isOpen}
      >
        <BellIcon className="h-5 w-5" />
        {count > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
            {badgeLabel}
          </span>
        ) : null}
      </button>

      {isOpen ? <NotificationDropdown onClose={() => setIsOpen(false)} /> : null}
    </div>
  )
}
