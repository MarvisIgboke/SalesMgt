import { http } from '../client'
import type { ApiEnvelope, Paginated } from '../types'

export type ShiftStatus = 'open' | 'closed'

export interface Shift {
  id: number
  reference: string | null
  branch_id: number
  branch_name: string
  branch_code?: string
  user_id: number
  user_name: string
  user_role?: string
  closed_by_name?: string | null
  status: ShiftStatus
  assigned_user_ids: number[]
  opened_at: string
  closed_at?: string | null
  expected_cash: number
  opening_cash: number
  actual_cash?: number | null
  variance?: number | null
  opening_stock_qty?: number
  opening_stock_value?: number
  closing_stock_qty?: number | null
  closing_stock_value?: number | null
  stock_variance?: number | null
  sales_count?: number
  notes?: string | null
  summary?: ShiftSummary | null
}

export interface ShiftReconciliation {
  from: string
  to: string
  expected_cash: number
  actual_cash: number
  variance: number
  cash_sales: number
  digital_sales: number
  refunds_total: number
  drops_total: number
  payouts_total: number
  sales_total: number
  sales_count: number
  cogs: number
  expected_drawer: number
  stock_variance?: number
  payment_breakdown: Array<{ method: string; amount: number; count: number }>
}

export type ShiftSupervisor = {
  id: number
  name: string
  role: string
  email: string
}

export type AssignedRep = {
  id: number
  name: string
  role: string
}

export type SaleSessionStatus = 'open' | 'closed'

export interface SaleSessionSummary {
  id: number
  reference: string
  status: SaleSessionStatus
  business_id: number
  business_name: string
  branch_id: number
  branch_name: string
  branch_code: string
  shift_id: number
  shift_reference: string | null
  user_id: number
  user_name: string
  user_role: string
  closed_by_name?: string | null
  opened_at: string
  closed_at?: string | null
  opening_balance: number
  closing_amount: number | null
  expected_cash: number
  variance: number | null
  opening_stock_qty: number
  opening_stock_value: number
  closing_stock_qty: number | null
  closing_stock_value: number | null
  stock_variance: number | null
  sales_total: number
  sales_count: number
  notes?: string | null
}

export interface SaleSessionReconciliation {
  from: string
  to: string
  opening_balance: number
  expected_cash: number
  closing_amount: number | null
  variance: number | null
  cash_sales: number
  digital_sales: number
  refunds_total: number
  drops_total: number
  payouts_total: number
  sales_total: number
  sales_count: number
  cogs: number
  sold_qty: number
  stock_variance?: number
  payment_breakdown: Array<{ method: string; amount: number; count: number }>
}

export interface SaleSessionSale {
  id: number
  reference: string | null
  customer_name?: string | null
  status: string
  payment_status: string
  total: number
  payment_methods: string[]
  created_at: string
}

export interface SaleSessionDetail extends SaleSessionSummary {
  reconciliation: SaleSessionReconciliation
  sales: SaleSessionSale[]
}

export interface ShiftDetail extends Shift {
  business_id: number
  business_name: string
  branch_code: string
  terminal: string
  supervisor: ShiftSupervisor | null
  assigned_reps: AssignedRep[]
  kpis: {
    opening_float: number
    sales_total: number
    sales_count: number
    cash_sales: number
    digital_sales: number
    refunds_total: number
    drops_total: number
    payouts_total: number
    expected_cash: number
    sale_count: number
    gross_sales: number
    net_cash_sales: number
    digital_pos: number
    expected_drawer: number
    sales_transactions: number
    cash_transactions: number
    digital_transactions: number
  }
  reconciliation: ShiftReconciliation
  journal: ShiftJournalEvent[]
  sale_sessions: SaleSessionSummary[]
}

export type ShiftJournalEvent = {
  id: string
  kind: 'opening' | 'cash_sales' | 'refund' | 'drop' | 'payout'
  label: string
  reference?: string | null
  note?: string | null
  signed_amount: number
  balance: number
  happened_at: string
}

export interface ShiftConfig {
  shifts_enabled: boolean
  require_cash_reconciliation: boolean
  require_sale_session: boolean
}

export interface ShiftSummary {
  shift_id: number
  status: ShiftStatus
  opening_cash: number
  cash_sales: number
  digital_sales: number
  refunds_total: number
  drops_total: number
  payouts_total: number
  sales_total: number
  sales_count: number
  expected_cash: number
  actual_cash: number | null
  variance: number | null
  payment_breakdown: Array<{ method: string; amount: number; count: number }>
}

export interface ShiftHistorySummary {
  branch_id: number | null
  range: { from: string | null; to: string | null }
  totals: {
    total_count: number
    closed_count: number
    open_count: number
    cash_sales: number
    digital_sales: number
    refunds_total: number
    drops_total: number
    payouts_total: number
    sales_count: number
    cash_reconciled: number
    net_variance: number
    accuracy_pct: number
  }
  filters: { all: number; balanced: number; overage: number; variance: number }
}

export const shiftApi = {
  config: () => http.get<ApiEnvelope<ShiftConfig>>('/shifts/config'),

  setConfig: (input: Partial<ShiftConfig>) =>
    http.put<ApiEnvelope<ShiftConfig>>('/shifts/config', input),

  current: (branchId?: number) =>
    http.get<ApiEnvelope<Shift | null>>('/shifts/current', {
      params: branchId ? { branch_id: branchId } : undefined,
    }),

  open: (input: { branch_id?: number; opening_cash?: number; assigned_user_ids?: number[] }) =>
    http.post<ApiEnvelope<Shift>>('/shifts/open', input),

  close: (input: { actual_cash?: number; notes?: string; shift_id?: number }) =>
    http.post<ApiEnvelope<Shift & { reconciliation: ShiftReconciliation }>>(
      '/shifts/close',
      input,
    ),

  history: (params?: { page?: number; per_page?: number; status?: ShiftStatus }) =>
    http.get<Paginated<Shift>>('/shifts', { params }),

  historySummary: (params?: { branch_id?: number; from?: string; to?: string }) =>
    http.get<ApiEnvelope<ShiftHistorySummary>>('/shifts/history/summary', { params }),

  detail: (shiftId: number | string) =>
    http.get<ApiEnvelope<ShiftDetail>>(`/shifts/${shiftId}`),

  recordMovement: (
    shiftId: number | string,
    input: { type: 'drop' | 'payout'; amount: number; reason?: string; sale_session_id?: number },
  ) =>
    http.post<ApiEnvelope<{ id: number; reference: string | null }>>(
      `/shifts/${shiftId}/movements`,
      input,
    ),

  reconcile: (input: { actual_cash: number; notes?: string }) =>
    http.post<ApiEnvelope<ShiftReconciliation>>('/shifts/reconcile', input),
}

export const saleSessionApi = {
  current: (params?: { user_id?: number; branch_id?: number }) =>
    http.get<ApiEnvelope<SaleSessionSummary | null>>('/sale-sessions/current', { params }),

  open: (input: { shift_id?: number; opening_balance?: number }) =>
    http.post<ApiEnvelope<SaleSessionSummary>>('/sale-sessions/open', input),

  close: (sessionId: number | string, input: { closing_amount: number; notes?: string }) =>
    http.post<ApiEnvelope<SaleSessionSummary & { reconciliation: SaleSessionReconciliation }>>(
      `/sale-sessions/${sessionId}/close`,
      input,
    ),

  detail: (sessionId: number | string) =>
    http.get<ApiEnvelope<SaleSessionDetail>>(`/sale-sessions/${sessionId}`),

  list: (params?: { page?: number; per_page?: number; shift_id?: number; user_id?: number; status?: SaleSessionStatus }) =>
    http.get<Paginated<SaleSessionSummary>>('/sale-sessions', { params }),
}
