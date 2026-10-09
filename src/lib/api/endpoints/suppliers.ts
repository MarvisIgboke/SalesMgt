import { http } from '../client'
import type { ApiEnvelope, Paginated } from '../types'

export interface Supplier {
  id: number
  name: string
  contact_name?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  outstanding_balance: number
  total_purchases: number
  created_at?: string
}

export interface SupplierInput {
  name: string
  contact_name?: string
  email?: string
  phone?: string
  address?: string
}

export const suppliersApi = {
  list: (params?: { page?: number; per_page?: number; search?: string }) =>
    http.get<Paginated<Supplier>>('/suppliers', { params }),

  get: (id: number) => http.get<ApiEnvelope<Supplier>>(`/suppliers/${id}`),

  create: (input: SupplierInput) => http.post<ApiEnvelope<Supplier>>('/suppliers', input),

  update: (id: number, input: Partial<SupplierInput>) =>
    http.put<ApiEnvelope<Supplier>>(`/suppliers/${id}`, input),

  purchases: (id: number, params?: { page?: number; per_page?: number }) =>
    http.get<Paginated<unknown>>(`/suppliers/${id}/purchases`, { params }),

  payments: (id: number, params?: { page?: number; per_page?: number }) =>
    http.get<Paginated<unknown>>(`/suppliers/${id}/payments`, { params }),
}