import { apiRequest } from '../api/client'
import type {
  AppNotification,
  NotificationsPage,
  NotificationReadFilter,
  UnreadCount,
} from '../types/notification'

function normalizeNotificationsPage(
  data: NotificationsPage | AppNotification[],
  page: number,
  perPage: number,
): NotificationsPage {
  if (Array.isArray(data)) {
    const totalPages = Math.max(1, Math.ceil(data.length / perPage))
    return {
      items: data,
      total: data.length,
      page,
      page_size: perPage,
      total_pages: totalPages,
    }
  }
  return data
}

export function getNotifications(
  page = 1,
  filter: NotificationReadFilter = 'all',
  perPage = 20,
) {
  const params = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
  })
  if (filter === 'unread') params.set('is_read', 'false')
  if (filter === 'read') params.set('is_read', 'true')

  return apiRequest<NotificationsPage | AppNotification[]>(
    `/notifications/?${params}`,
  ).then((data) => normalizeNotificationsPage(data, page, perPage))
}

export function getUnreadCount() {
  return apiRequest<UnreadCount>('/notifications/unread-count')
}

export function markAsRead(notificationId: string) {
  return apiRequest<AppNotification>(`/notifications/${notificationId}/read`, {
    method: 'PATCH',
  })
}

export function markAllAsRead() {
  return apiRequest<void>('/notifications/read-all', {
    method: 'PATCH',
  })
}

export function deleteNotification(notificationId: string) {
  return apiRequest<void>(`/notifications/${notificationId}`, {
    method: 'DELETE',
  })
}
