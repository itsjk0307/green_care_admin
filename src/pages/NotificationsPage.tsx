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
      void queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] })
      void queryClient.invalidateQueries({ queryKey: ['notifications-infinite'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteNotification,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
      void queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] })
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
    <div className="page-enter mx-auto max-w-3xl pb-6 sm:pb-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[#121820]">
            <BellIcon className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">
              알림
            </span>
          </div>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            알림
          </h1>
          <p className="mt-1 text-sm text-slate-500">모든 알림을 확인하세요</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          loading={markAllMutation.isPending}
          onClick={() => markAllMutation.mutate()}
          disabled={notifications.length === 0}
          className="border-slate-200 text-slate-700 hover:bg-[#f4f5f7]"
        >
          모두 읽음
        </Button>
      </div>

      <div className="mb-4 flex gap-1 rounded-xl bg-slate-100/90 p-1">
        {TABS.map(({ key, label }) => {
          const active = filter === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                active
                  ? 'bg-[#121820] text-white shadow-[0_4px_12px_rgba(18,24,32,0.22)]'
                  : 'text-slate-500 hover:bg-white/70 hover:text-slate-700'
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[var(--shadow-gc-card)]">
        {infiniteQuery.isLoading ? (
          <LoadingSpinner />
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
            {filter === 'unread' ? (
              <>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#121820] to-[#2a3441] shadow-[0_8px_20px_rgba(18,24,32,0.22)]">
                  <span className="text-2xl text-white">✓</span>
                </div>
                <p className="text-base font-semibold text-slate-800">
                  {emptyMessage}
                </p>
              </>
            ) : (
              <>
                <BellIcon className="h-12 w-12 text-slate-300" aria-hidden />
                <p className="text-sm text-slate-500">{emptyMessage}</p>
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
              className="border-slate-200 text-slate-700 hover:bg-[#f4f5f7]"
            >
              더 보기
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
