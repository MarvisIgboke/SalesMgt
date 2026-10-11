import { http } from '../client'
import type { ApiEnvelope, Paginated, PaginationMeta } from '../types'

export type SaleStatus =
  | 'completed'
  | 'partially_refunded'
  | 'refunded'
  | 'cancelled'
  | 'awaiting_approval'

export interface SaleListItem {
  id: number
  reference: string
  customer_id?: number | null
  customer_name?: string | null
  branch_id?: number | null
  branch_name?: string | null
  user_id?: number | null
  sales_rep: string
  status: SaleStatus
  payment_status: string
  subtotal: number
  discount_total: number
  tax_total: number
  total: number
  paid_amount: number
  change_due: number
  currency: string
  item_count: number
  refunded_total: number
  payment_methods: string[]
  created_at: string
}

export interface SaleItemLine {
  id: number
  product_id?: number | null
  variant_id?: number | null
  name: string
  variant_name?: string | null
  sku?: string | null
  quantity: number
  refunded_quantity: number
  unit_price: number
  cost_price: number
  discount: number
  tax: number
  line_total: number
}

export interface SalePayment {
  id: number
  reference?: string | null
  method: string
  amount: number
  status: string
  created_at: string
}

export interface SaleRefund {
  id: number
  reference: string
  total: number
  reason?: string | null
  status: string
  created_at: string
  items: Array<{
    sale_item_id: number
    product_id?: number | null
    quantity: number
    amount: number
  }>
}

export interface SaleHistoryEntry {
  from_status?: string | null
  to_status: string
  user?: string | null
  reason?: string | null
  created_at: string
}

export interface SaleDetail extends SaleListItem {
  items: SaleItemLine[]
  payments: SalePayment[]
  refunds: SaleRefund[]
  history: SaleHistoryEntry[]
}

export interface SaleListParams {
  page?: number
  per_page?: number
  status?: string
  payment_status?: string
  customer_id?: number
  branch_id?: number
  user_id?: number
  payment_method?: string
  product_id?: number
  from?: string
  to?: string
  search?: string
}

export interface SaleTender {
  method: string
  amount: number
}

export interface SaleSummary {
  gross_total: number
  count: number
  avg_total: number
  void_count: number
  void_amount: number
  tenders: SaleTender[]
}

export interface SaleListPage extends Paginated<SaleListItem> {
  meta: PaginationMeta & { summary?: SaleSummary }
}

export const salesApi = {
  list: (params?: SaleListParams) => http.get<SaleListPage>('/sales', { params }),

  get: (id: number) => http.get<ApiEnvelope<SaleDetail>>(`/sales/${id}`),

  cancel: (id: number, reason?: string) =>
    http.post<ApiEnvelope<SaleDetail>>(`/sales/${id}/cancel`, { reason }),

  refund: (
    id: number,
    input: {
      reason?: string
      items: Array<{ sale_item_id: number; quantity: number }>
    },
  ) => http.post<ApiEnvelope<{ refund: SaleRefund; sale: SaleDetail }>>(`/sales/${id}/refund`, input),
}
