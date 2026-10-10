import { http } from '../client'
import type { ApiEnvelope, Paginated } from '../types'

export interface StockLevel {
  id: number
  product_id: number
  variant_id?: number | null
  product_name: string
  variant_name?: string | null
  sku: string
  branch_id: number
  branch_name: string
  quantity: number
  low_stock_threshold?: number | null
  status: 'in_stock' | 'low' | 'out_of_stock'
}

export interface StockDashboard {
  total_sku: number
  total_units: number
  inventory_value: number
  low_stock_count: number
  out_of_stock_count: number
  damaged_count: number
  expired_count: number
}

export interface StockMovement {
  id: number
  product_id?: number
  variant_id?: number | null
  product_name: string
  variant_name?: string | null
  type: 'in' | 'out' | 'adjustment' | 'transfer_in' | 'transfer_out' | 'damage' | 'expired'
  quantity: number
  direction?: 'in' | 'out'
  reason?: string | null
  reference?: string | null
  staff_name?: string | null
  happened_at: string
}

export interface StockAdjustmentInput {
  product_id: number
  variant_id?: number
  branch_id: number
  quantity: number
  reason?: string
}

export interface StockTransferInput {
  source_branch_id: number
  destination_branch_id: number
  items: Array<{ product_id: number; variant_id?: number; quantity: number }>
  notes?: string
}

export interface GoodsReceiptInput {
  purchase_order_id?: number
  supplier_id?: number
  branch_id: number
  reference?: string
  items: Array<{ product_id: number; variant_id?: number; quantity: number; cost_price?: number }>
  notes?: string
}

export const inventoryApi = {
  dashboard: (params?: { branch_id?: number }) =>
    http.get<ApiEnvelope<StockDashboard>>('/inventory/dashboard', { params }),

  levels: (params?: {
    page?: number
    per_page?: number
    search?: string
    branch_id?: number
    status?: string
    product_id?: number
  }) => http.get<Paginated<StockLevel>>('/inventory/levels', { params }),

  movements: (params?: {
    page?: number
    per_page?: number
    branch_id?: number
    type?: string
    product_id?: number
    variant_id?: number
  }) => http.get<Paginated<StockMovement>>('/inventory/movements', { params }),

  adjust: (input: StockAdjustmentInput) =>
    http.post<ApiEnvelope<StockMovement>>('/inventory/adjustments', input),

  transfer: (input: StockTransferInput) =>
    http.post<ApiEnvelope<{ id: number; reference: string; status: string }>>(
      '/inventory/transfers',
      input,
    ),

  transfers: (params?: { page?: number; per_page?: number; status?: string }) =>
    http.get<Paginated<unknown>>('/inventory/transfers', { params }),

  goodsReceived: (input: GoodsReceiptInput) =>
    http.post<ApiEnvelope<{ id: number; reference: string }>>('/inventory/goods-received', input),

  goodsReceivedList: (params?: { page?: number; per_page?: number }) =>
    http.get<Paginated<unknown>>('/inventory/goods-received', { params }),

  damaged: (params?: { page?: number; per_page?: number; branch_id?: number }) =>
    http.get<Paginated<unknown>>('/inventory/damaged', { params }),

  expired: (params?: { page?: number; per_page?: number; branch_id?: number }) =>
    http.get<Paginated<unknown>>('/inventory/expired', { params }),

  approvals: (params?: { page?: number; per_page?: number; status?: string }) =>
    http.get<Paginated<unknown>>('/inventory/approvals', { params }),

  approve: (id: number, decision: 'approved' | 'rejected', notes?: string) =>
    http.post<ApiEnvelope<unknown>>(`/inventory/approvals/${id}`, {
      decision,
      notes,
    }),
}