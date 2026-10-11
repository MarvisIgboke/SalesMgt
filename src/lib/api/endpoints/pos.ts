import { http } from '../client'
import type { ApiEnvelope, Paginated } from '../types'

export interface SellableVariant {
  id: number
  name: string
  sku: string
  barcode?: string | null
  price: number
  cost_price: number
  stock_qty: number
  is_sellable: boolean
  reason?: string | null
}

export interface SellableProduct {
  id: number
  name: string
  sku: string
  brand?: string | null
  category?: string | null
  unit?: string | null
  image_url?: string | null
  price: number
  cost_price: number
  discount?: number | null
  tax_rate?: number | null
  stock_qty: number
  low_stock_threshold?: number | null
  is_sellable: boolean
  reason?: string | null
  requires_expiry: boolean
  expiry_warning?: {
    status: 'expired' | 'expiring_soon' | 'ok'
    days?: number
    message?: string
  } | null
  variants?: SellableVariant[]
}

export interface CartItem {
  id: number
  product_id: number
  variant_id?: number | null
  product_name: string
  variant_name?: string | null
  sku: string
  quantity: number
  unit_price: number
  discount: number
  tax: number
  line_total: number
  stock_qty: number
  stock_warning?: string | null
  expiry_warning?: string | null
  requires_approval?: boolean
  approval_reasons?: string[]
}

export interface CartResponse {
  reference: string
  customer_id?: number | null
  items: CartItem[]
  subtotal: number
  discount_total: number
  tax_total: number
  total: number
  currency: string
  customer_credit: number
  requires_approval: boolean
  approval_reasons: string[]
  warnings: Array<{ code: string; message: string }>
}

export interface AddItemInput {
  product_id: number
  variant_id?: number
  quantity?: number
}

export interface UpdateItemInput {
  line_id: number
  quantity: number
}

export interface CartPayload {
  reference?: string
}

export type PaymentMethod =
  | 'cash'
  | 'bank_transfer'
  | 'card'
  | 'online'
  | 'credit'
  | 'split'

export interface PaymentInput {
  method: PaymentMethod
  amount?: number
  split?: Array<{ method: PaymentMethod; amount: number }>
  bank_reference?: string
  cash_received?: number
  customer_id?: number | null
  notes?: string
}

export interface SaleApproval {
  status: 'approved' | 'rejected' | 'pending' | 'awaiting_finance' | 'awaiting_manager' | 'awaiting_inventory'
  approved_by?: string | null
  approved_at?: string | null
  reason?: string | null
}

export interface Receipt {
  business_name: string
  branch_name: string
  receipt_number: string
  sale_reference: string
  customer_name?: string | null
  staff_name: string
  items: CartItem[]
  subtotal: number
  discount_total: number
  tax_total: number
  total: number
  amount_paid: number
  change_due: number
  payment_status: string
  payment_methods: Array<{ method: PaymentMethod; amount: number }>
  created_at: string
  qr_verification?: { payload: string; url?: string }
}

export interface SaleResult {
  status: 'completed' | 'queued' | 'awaiting_approval'
  client_request_id: string
  sale?: {
    id: number
    reference: string
    receipt: Receipt
    approval: SaleApproval
  }
  message?: string
}

export const posApi = {
  searchProducts: (params: { q?: string; category?: string; page?: number; per_page?: number }) =>
    http.get<Paginated<SellableProduct>>('/pos/search', { params }),

  lookupBarcode: (barcode: string) =>
    http.get<ApiEnvelope<SellableProduct>>(`/pos/barcode/${encodeURIComponent(barcode)}`),

  getCart: (reference?: string) =>
    http.get<ApiEnvelope<CartResponse>>('/pos/cart', {
      params: reference ? { reference } : undefined,
    }),

  addItem: (input: AddItemInput, reference?: string) =>
    http.post<ApiEnvelope<CartResponse>>('/pos/cart/items', {
      ...input,
      reference,
    }),

  updateItem: (input: UpdateItemInput, reference?: string) =>
    http.put<ApiEnvelope<CartResponse>>(`/pos/cart/items/${input.line_id}`, {
      quantity: input.quantity,
      reference,
    }),

  removeItem: (lineId: number, reference?: string) =>
    http.delete<ApiEnvelope<CartResponse>>(`/pos/cart/items/${lineId}`, {
      params: reference ? { reference } : undefined,
    }),

  setCustomer: (customerId: number | null, reference?: string) =>
    http.post<ApiEnvelope<CartResponse>>('/pos/cart/customer', {
      customer_id: customerId,
      reference,
    }),

  initializeSale: (payload: CartPayload) =>
    http.post<ApiEnvelope<CartResponse>>('/pos/sales/initialize', payload),

  charge: (payment: PaymentInput & CartPayload) =>
    http.post<ApiEnvelope<SaleResult>>('/pos/sales/charge', payment),

  getReceipt: (reference: string) =>
    http.get<ApiEnvelope<Receipt>>(`/pos/receipts/${encodeURIComponent(reference)}`),

  holdSale: (payload: CartPayload) =>
    http.post<ApiEnvelope<{ reference: string; held_until: string }>>(
      '/pos/sales/hold',
      payload,
    ),

  resumeSale: (reference: string) =>
    http.post<ApiEnvelope<CartResponse>>('/pos/sales/resume', { reference }),
}