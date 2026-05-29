import { BellIcon } from '@heroicons/react/24/outline'
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { NotificationItem } from './NotificationItem'
import {
  deleteNotification,
  getNotifications,
  markAllAsRead,
} from '../../services/notificationService'

type Props = {
  onClose: () => void
}

export function NotificationDropdown({ onClose }: Props) {
  const queryClient = useQueryClient()

  const notificationsQuery = useQuery({
    queryKey: ['notifications'],
    queryFn: () => getNotifications(1),
  })

  const markAllMutation = useMutation({
    mutationFn: markAllAsRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
      void queryClient.invalidateQueries({ queryKey: ['unread-count'] })
      void queryClient.invalidateQueries({ queryKey: ['notifications-infinite'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteNotification,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
      void queryClient.invalidateQueries({ queryKey: ['unread-count'] })
      void queryClient.invalidateQueries({ queryKey: ['notifications-infinite'] })
    },
  })

  const items = notificationsQuery.data?.items ?? []

  const handleRead = () => {
    void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    void queryClient.invalidateQueries({ queryKey: ['unread-count'] })
    void queryClient.invalidateQueries({ queryKey: ['notifications-infinite'] })
  }

  return (
    <div className="absolute right-0 top-12 z-50 max-h-[480px] w-[380px] overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-lg">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">알림</h2>
        <button
          type="button"
          onClick={() => markAllMutation.mutate()}
          disabled={markAllMutation.isPending || items.length === 0}
          className="text-xs text-slate-400 transition-colors hover:text-slate-700 disabled:opacity-40"
        >
          모두 읽음
        </button>
      </div>

      <div className="max-h-[400px] overflow-y-auto">
        {notificationsQuery.isLoading ? (
          <LoadingSpinner />
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
            <BellIcon className="h-10 w-10 text-slate-200" aria-hidden />
            <p className="text-sm text-slate-400">새로운 알림이 없습니다</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((notification) => (
              <li key={notification.id}>
                <NotificationItem
                  notification={notification}
                  onRead={handleRead}
                  onDelete={(id) => deleteMutation.mutate(id)}
                  onClose={onClose}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-slate-100 px-4 py-3 text-center">
        <Link
          to="/notifications"
          onClick={onClose}
          className="text-sm font-medium text-emerald-600 transition-colors hover:text-emerald-700"
        >
          모든 알림 보기
        </Link>
      </div>
    </div>
  )
}
