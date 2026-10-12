import { http } from '../client'
import type { ApiEnvelope, PaginationLinks, PaginationMeta } from '../types'

export interface PlatformUser {
  id: number
  name: string
  email: string
  phone?: string | null
  avatar_url?: string | null
  roles: string[]
  business_id?: number | null
  business_name?: string | null
  branch_ids: number[]
  is_active: boolean
  last_active_at?: string | null
  created_at?: string | null
}

export interface UserStats {
  total: number
  business_admin: number
  store_manager: number
  sales_rep: number
}

export interface UsersList {
  data: PlatformUser[]
  meta: PaginationMeta & { stats: UserStats }
  links?: PaginationLinks
}

export interface UsersQuery {
  page?: number
  per_page?: number
  search?: string
  role?: string
}

export const usersApi = {
  list: (params?: UsersQuery) => http.get<UsersList>('/users', { params }),

  resetPassword: (id: number) =>
    http.post<ApiEnvelope<PlatformUser>>(`/users/${id}/reset-password`),

  toggleActive: (id: number) =>
    http.post<ApiEnvelope<PlatformUser>>(`/users/${id}/toggle-active`),
}
