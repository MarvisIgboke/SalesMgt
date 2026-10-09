import { http } from '../client'
import type { ApiEnvelope, Paginated } from '../types'

export interface AppNotification {
  id: number
  type: string
  title: string
  body?: string
  is_read: boolean
  data?: Record<string, unknown>
  created_at: string
}

export interface UnreadCount {
  count: number
}

export const notificationsApi = {
  list: (params?: { page?: number; per_page?: number; unread?: boolean }) =>
    http.get<Paginated<AppNotification>>('/notifications', { params }),

  unreadCount: () => http.get<ApiEnvelope<UnreadCount>>('/notifications/unread-count'),

  markRead: (id: number) =>
    http.post<ApiEnvelope<AppNotification>>(`/notifications/${id}/read`),

  markAllRead: () => http.post<ApiEnvelope<null>>('/notifications/read-all'),

  subscribeDevice: (subscription: PushSubscription) =>
    http.post<ApiEnvelope<{ id: string }>>('/notifications/subscribe', {
      endpoint: subscription.endpoint,
      keys: subscription.toJSON() as unknown as Record<string, string>,
    }),
}