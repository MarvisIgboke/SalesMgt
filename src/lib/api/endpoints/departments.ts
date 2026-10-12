import { http } from '../client'
import type { ApiEnvelope } from '../types'

export interface Department {
  id: number
  name: string
  code: string
  description?: string | null
  is_active: boolean
  staff_count?: number
  products_count?: number
  created_at?: string | null
  updated_at?: string | null
}

export interface DepartmentInput {
  name: string
  code?: string
  description?: string
  is_active?: boolean
}

export const departmentsApi = {
  list: (params?: { with_counts?: boolean }) =>
    http.get<ApiEnvelope<Department[]>>('/departments', { params }),

  create: (input: DepartmentInput) => http.post<ApiEnvelope<Department>>('/departments', input),

  update: (id: number, input: Partial<DepartmentInput>) =>
    http.put<ApiEnvelope<Department>>(`/departments/${id}`, input),

  remove: (id: number) => http.delete<ApiEnvelope<null>>(`/departments/${id}`),
}
