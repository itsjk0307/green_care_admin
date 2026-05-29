import { BellIcon } from '@heroicons/react/24/outline'
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { NotificationItem } from '../components/layout/NotificationItem'
import { Button } from '../components/ui/Button'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import {
  deleteNotification,
  getNotifications,
  markAllAsRead,
} from '../services/notificationService'
import type { NotificationReadFilter } from '../types/notification'

const TABS: { key: NotificationReadFilter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'unread', label: '읽지않음' },
  { key: 'read', label: '읽음' },
]

export function NotificationsPage() {
  const [filter, setFilter] = useState<NotificationReadFilter>('all')
  const queryClient = useQueryClient()

  const infiniteQuery = useInfiniteQuery({
    queryKey: ['notifications-infinite', filter],
    queryFn: ({ pageParam }) => getNotifications(pageParam, filter),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.total_pages ? lastPage.page + 1 : undefined,
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

  const notifications = useMemo(
    () => infiniteQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [infiniteQuery.data],
  )

  const handleRead = () => {
    void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    void queryClient.invalidateQueries({ queryKey: ['unread-count'] })
    void queryClient.invalidateQueries({ queryKey: ['notifications-infinite'] })
  }

  const emptyMessage =
    filter === 'unread' ? '모든 알림을 읽었습니다 ✓' : '알림이 없습니다'

  return (
    <div className="mx-auto max-w-3xl">
      {/* ── Page header ── */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">알림</h1>
          <p className="mt-0.5 text-sm text-slate-400">모든 알림을 확인하세요</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          loading={markAllMutation.isPending}
          onClick={() => markAllMutation.mutate()}
          disabled={notifications.length === 0}
        >
          모두 읽음
        </Button>
      </div>

      {/* ── Filter tabs ── */}
      <div className="mb-4 flex gap-1.5">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-all duration-150 ${
              filter === key
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'border border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Notification list ── */}
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        {infiniteQuery.isLoading ? (
          <LoadingSpinner />
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
            {filter === 'unread' ? (
              <>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50">
                  <span className="text-2xl">✓</span>
                </div>
                <p className="text-base font-semibold text-emerald-700">{emptyMessage}</p>
              </>
            ) : (
              <>
                <BellIcon className="h-12 w-12 text-slate-200" aria-hidden />
                <p className="text-sm text-slate-400">{emptyMessage}</p>
              </>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {notifications.map((notification) => (
              <li key={notification.id}>
                <NotificationItem
                  notification={notification}
                  onRead={handleRead}
                  onDelete={(id) => deleteMutation.mutate(id)}
                />
              </li>
            ))}
          </ul>
        )}

        {infiniteQuery.hasNextPage ? (
          <div className="border-t border-slate-100 p-4 text-center">
            <Button
              variant="secondary"
              size="sm"
              loading={infiniteQuery.isFetchingNextPage}
              onClick={() => infiniteQuery.fetchNextPage()}
            >
              더 보기
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
