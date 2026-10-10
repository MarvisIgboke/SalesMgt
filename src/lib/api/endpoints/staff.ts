import { http } from '../client'
import type { ApiEnvelope, Paginated } from '../types'

export interface StaffMember {
  id: number
  user_id: number
  name: string
  email: string
  phone?: string | null
  avatar_url?: string | null
  roles: string[]
  branch_ids: number[]
  is_active: boolean
  last_active_at?: string | null
}

export interface Role {
  id: number
  name: string
  description?: string | null
  is_custom: boolean
  permissions: string[]
}

export interface StaffInput {
  name: string
  email: string
  password?: string
  phone?: string
  roles?: string[]
  branch_ids?: number[]
}

export interface ActivityLog {
  id: number
  user_id: number
  user_name: string
  action: string
  description?: string
  ip?: string
  created_at: string
}

export interface UserSession {
  id: number
  device: string
  ip?: string
  is_current: boolean
  last_active_at: string
}

export interface PermissionItem {
  key: string
  label: string
  group: string
}

export interface StaffPermissionDetail {
  user_id: number
  name: string
  roles: string[]
  permissions: string[]
  effective_permissions: string[]
  catalog: PermissionItem[]
}

export interface SyncPermissionsResult {
  user_id: number
  permissions: string[]
  effective_permissions: string[]
}

export const staffApi = {
  list: (params?: { page?: number; per_page?: number; search?: string }) =>
    http.get<Paginated<StaffMember>>('/staff', { params }),

  get: (id: number) => http.get<ApiEnvelope<StaffMember>>(`/staff/${id}`),

  create: (input: StaffInput) => http.post<ApiEnvelope<StaffMember>>('/staff', input),

  update: (id: number, input: Partial<StaffInput>) =>
    http.put<ApiEnvelope<StaffMember>>(`/staff/${id}`, input),

  roles: () => http.get<ApiEnvelope<Role[]>>('/staff/roles'),

  permissions: () =>
    http.get<ApiEnvelope<Array<{ key: string; label: string; group: string }>>>('/staff/permissions'),

  staffPermissions: (id: number) =>
    http.get<ApiEnvelope<StaffPermissionDetail>>(`/staff/${id}/permissions`),

  syncPermissions: (id: number, permissions: string[]) =>
    http.put<ApiEnvelope<SyncPermissionsResult>>(`/staff/${id}/permissions`, { permissions }),

  createRole: (input: { name: string; description?: string; permissions: string[] }) =>
    http.post<ApiEnvelope<Role>>('/staff/roles', input),

  activity: (params?: { page?: number; per_page?: number }) =>
    http.get<Paginated<ActivityLog>>('/staff/activity', { params }),

  sessions: () => http.get<ApiEnvelope<UserSession[]>>('/staff/sessions'),

  revokeSession: (id: number) => http.delete<ApiEnvelope<null>>(`/staff/sessions/${id}`),
}