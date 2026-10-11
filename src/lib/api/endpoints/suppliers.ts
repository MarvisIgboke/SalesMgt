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
  orders_count?: number
  in_transit_count?: number
  open_orders?: number
  last_order_at?: string | null
  created_at?: string
}

export interface SupplierInput {
  name: string
  contact_name?: string
  email?: string
  phone?: string
  address?: string
}

export interface SupplierPurchase {
  id: number
  reference: string
  status: string
  total: number
  expected_at?: string | null
  created_at?: string
}

export interface SupplierPaymentRecord {
  id: number
  amount: number
  method?: string | null
  reference?: string | null
  notes?: string | null
  created_at?: string
}

export interface SupplierSummary {
  active_suppliers: { count: number; with_orders: number }
  ap_outstanding: { count: number; value: number }
  purchases: { count: number; value: number }
  inbound: { count: number; value: number }
  ap_due_14d: { count: number; value: number }
  filters: { all: number; active: number; new: number; balance: number; clear: number }
}

export type SupplierFilter = 'all' | 'active' | 'new' | 'balance' | 'clear'

export const suppliersApi = {
  list: (params?: { page?: number; per_page?: number; search?: string; filter?: SupplierFilter }) =>
    http.get<Paginated<Supplier>>('/suppliers', { params }),

  get: (id: number) => http.get<ApiEnvelope<Supplier>>(`/suppliers/${id}`),

  create: (input: SupplierInput) => http.post<ApiEnvelope<Supplier>>('/suppliers', input),

  update: (id: number, input: Partial<SupplierInput>) =>
    http.put<ApiEnvelope<Supplier>>(`/suppliers/${id}`, input),

  summary: () => http.get<ApiEnvelope<SupplierSummary>>('/suppliers/summary'),

  purchases: (id: number, params?: { page?: number; per_page?: number }) =>
    http.get<Paginated<SupplierPurchase>>(`/suppliers/${id}/purchases`, { params }),

  payments: (id: number, params?: { page?: number; per_page?: number }) =>
    http.get<Paginated<SupplierPaymentRecord>>(`/suppliers/${id}/payments`, { params }),
}