import { http } from '../client'
import type { ApiEnvelope, Paginated } from '../types'

export type NotificationSeverity = 'critical' | 'warning' | 'info' | 'success'
export type NotificationCategory = 'sales' | 'inventory' | 'finance' | 'system'

export interface AppNotification {
  id: number
  type: string
  title: string
  body?: string
  is_read: boolean
  severity: NotificationSeverity
  category: NotificationCategory
  data?: Record<string, unknown>
  created_at: string
}

export interface UnreadCount {
  count: number
}

export interface NotificationSummary {
  total: number
  unread: number
  read: number
  read_rate_pct: number
  today: number
  this_week: number
  action_required: number
  by_category: Record<NotificationCategory, number>
  by_severity: Record<NotificationSeverity, number>
  filters: {
    all: number
    unread: number
    sales: number
    inventory: number
    finance: number
    system: number
  }
}

export const notificationsApi = {
  list: (params?: { page?: number; per_page?: number; unread?: boolean; category?: string }) =>
    http.get<Paginated<AppNotification>>('/notifications', { params }),

  summary: () => http.get<ApiEnvelope<NotificationSummary>>('/notifications/summary'),

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