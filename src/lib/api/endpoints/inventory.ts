import { http } from '../client'
import type { ApiEnvelope, Paginated, PaginationMeta } from '../types'

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
  barcode?: string | null
  category?: string | null
  brand?: string | null
  unit?: string | null
  image_url?: string | null
  requires_expiry?: boolean
  cost_price?: number
  selling_price?: number
  valuation?: number
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

export interface TraceBatch {
  batch_number: string | null
  expiry_date: string | null
  quantity_available: number
  days_remaining: number | null
  expiry_status: string
}

export interface TraceZone {
  branch_id: number
  branch_name: string | null
  quantity: number
}

export interface ProductTrace {
  product: {
    id: number
    name: string
    sku: string
    barcode: string | null
    category: string | null
    brand: string | null
    unit: string | null
    image_url: string | null
    requires_expiry: boolean
    cost_price: number
    selling_price: number
  }
  branch: { id: number; name: string } | null
  on_hand: number
  on_hand_value: number
  threshold: number | null
  intake: number
  dispensed: number
  adjustments: number
  damaged: number
  expired: number
  events: number
  sold_ratio: number
  first_event_at: string | null
  last_event_at: string | null
  active_batch: TraceBatch | null
  zones: TraceZone[]
  quarantine: number
  last_receipt: { reference: string; supplier_name: string | null; created_at: string | null } | null
}

export interface ExpiryRiskBucketStat {
  count: number
  quantity: number
  value: number
}

export type ExpiryRiskBucket = 'expired' | 'critical' | 'near' | 'at_risk' | 'stable'

export interface ExpirySummary {
  expired: ExpiryRiskBucketStat
  critical: ExpiryRiskBucketStat
  near: ExpiryRiskBucketStat
  at_risk: ExpiryRiskBucketStat
  stable: ExpiryRiskBucketStat
  all: ExpiryRiskBucketStat
}

export interface ExpiryBatch {
  id: number
  product_id: number
  product_name: string
  variant_name?: string | null
  sku: string
  barcode?: string | null
  batch_number?: string | null
  branch_id: number
  branch_name?: string | null
  supplier_name?: string | null
  quantity_available: number
  quantity_received: number
  cost_price: number
  value: number
  expiry_date?: string | null
  manufacturing_date?: string | null
  days_remaining: number | null
  expiry_status: string
  bucket: ExpiryRiskBucket
}

export interface ExpiryBatchesResponse extends Paginated<ExpiryBatch> {
  meta: PaginationMeta & { summary: ExpirySummary }
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
    types?: string
    product_id?: number
    variant_id?: number
  }) => http.get<Paginated<StockMovement>>('/inventory/movements', { params }),

  trace: (productId: number, params?: { branch_id?: number }) =>
    http.get<ApiEnvelope<ProductTrace>>(`/inventory/trace/${productId}`, { params }),

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

  batches: (params?: {
    page?: number
    per_page?: number
    branch_id?: number
    search?: string
    bucket?: ExpiryRiskBucket
  }) => http.get<ExpiryBatchesResponse>('/inventory/batches', { params }),

  approvals: (params?: { page?: number; per_page?: number; status?: string }) =>
    http.get<Paginated<unknown>>('/inventory/approvals', { params }),

  approve: (id: number, decision: 'approved' | 'rejected', notes?: string) =>
    http.post<ApiEnvelope<unknown>>(`/inventory/approvals/${id}`, {
      decision,
      notes,
    }),
}
