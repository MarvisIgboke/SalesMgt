import { http } from '../client'
import type { ApiEnvelope, Paginated } from '../types'

export interface PurchaseOrder {
  id: number
  reference: string
  supplier_id?: number | null
  supplier_name?: string | null
  branch_id: number
  branch_name: string
  status: string
  expected_at?: string | null
  total: number
  created_by: string
  created_at: string
}

export interface PurchaseOrderInput {
  supplier_id?: number
  branch_id: number
  expected_at?: string
  items: Array<{ product_id: number; quantity: number; unit_cost?: number }>
  notes?: string
}

export interface PurchaseRequisition {
  id: number
  reference: string
  product_name: string
  quantity: number
  branch_name: string
  requested_by: string
  status: string
  created_at: string
}

export const purchasingApi = {
  requisitions: (params?: { page?: number; per_page?: number; status?: string }) =>
    http.get<Paginated<PurchaseRequisition>>('/purchasing/requisitions', { params }),

  createRequisition: (input: {
    product_id: number
    quantity: number
    branch_id: number
    notes?: string
  }) => http.post<ApiEnvelope<PurchaseRequisition>>('/purchasing/requisitions', input),

  orders: (params?: { page?: number; per_page?: number; status?: string }) =>
    http.get<Paginated<PurchaseOrder>>('/purchasing/orders', { params }),

  createOrder: (input: PurchaseOrderInput) =>
    http.post<ApiEnvelope<PurchaseOrder>>('/purchasing/orders', input),

  order: (id: number) => http.get<ApiEnvelope<PurchaseOrder>>(`/purchasing/orders/${id}`),

  updateOrderStatus: (id: number, status: string) =>
    http.post<ApiEnvelope<PurchaseOrder>>(`/purchasing/orders/${id}/status`, { status }),

  invoices: (params?: { page?: number; per_page?: number }) =>
    http.get<Paginated<unknown>>('/purchasing/invoices', { params }),

  supplierPayments: (params?: { page?: number; per_page?: number }) =>
    http.get<Paginated<unknown>>('/purchasing/payments', { params }),

  returns: (params?: { page?: number; per_page?: number }) =>
    http.get<Paginated<unknown>>('/purchasing/returns', { params }),
}