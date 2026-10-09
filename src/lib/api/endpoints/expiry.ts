import { http } from '../client'
import type { ApiEnvelope, Paginated } from '../types'

export interface ExpiryBucket {
  key: string
  label: string
  count: number
}

export interface ExpiryDashboard {
  buckets: ExpiryBucket[]
  total_expired: number
  total_quantity: number
  estimated_loss: number
}

export interface ExpiryItems {
  id: number
  product_name: string
  variant_name?: string | null
  batch_number?: string | null
  branch_name: string
  quantity: number
  expiry_date: string
  days_remaining: number
  risk: 'expired' | 'critical' | 'high' | 'medium' | 'low'
  recommended_action: string
  status: string
}

export const expiryApi = {
  dashboard: (params?: { branch_id?: number }) =>
    http.get<ApiEnvelope<ExpiryDashboard>>('/expiry/dashboard', { params }),

  items: (params?: {
    page?: number
    per_page?: number
    window?: string
    branch_id?: number
    search?: string
  }) => http.get<Paginated<ExpiryItems>>('/expiry/items', { params }),

  buckets: (params?: { branch_id?: number }) =>
    http.get<ApiEnvelope<ExpiryBucket[]>>('/expiry/buckets', { params }),
}