import { http } from '../client'
import type { ApiEnvelope, Paginated } from '../types'

export interface SearchResult {
  id: number
  type: 'product' | 'customer' | 'sale' | 'supplier' | 'staff' | 'branch'
  label: string
  subtitle?: string
  meta?: Record<string, string | number | boolean | null>
}

export interface GlobalSearchResponse {
  groups: Array<{
    type: SearchResult['type']
    title: string
    results: SearchResult[]
  }>
}

export const searchApi = {
  global: (query?: string) =>
    http.get<ApiEnvelope<GlobalSearchResponse>>('/search', {
      params: { q: query?.trim() || undefined },
    }),

  products: (params: {
    q?: string
    page?: number
    per_page?: number
    branch_id?: number
  }) => http.get<Paginated<unknown>>('/pos/search', { params }),
}