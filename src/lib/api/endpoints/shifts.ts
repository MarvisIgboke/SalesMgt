import { http } from '../client'
import type { ApiEnvelope, Paginated } from '../types'

export type ShiftStatus = 'open' | 'closed' | 'active'

export interface Shift {
  id: number
  branch_id: number
  branch_name: string
  branch_code?: string
  user_id: number
  user_name: string
  user_role?: string
  status: ShiftStatus
  opened_at: string
  closed_at?: string | null
  expected_cash: number
  opening_cash: number
  actual_cash?: number | null
  variance?: number | null
  notes?: string | null
}

export interface ShiftReconciliation {
  expected_cash: number
  actual_cash: number
  variance: number
  sales_total: number
  transaction_count: number
  refunds_total: number
  drops_total: number
  payouts_total: number
  expected_drawer: number
  payment_breakdown: Array<{ method: string; amount: number; count: number }>
}

export type ShiftSupervisor = {
  id: number
  name: string
  role: string
  email: string
}

export type ShiftJournalKind = 'opening' | 'cash_sales' | 'refund' | 'drop' | 'payout'

export interface ShiftJournalEvent {
  id: string
  kind: ShiftJournalKind
  label: string
  signed_amount: number
  happened_at: string
  reference: string | null
  note: string | null
  balance: number
}

export interface ShiftMovement {
  id: number
  type: 'drop' | 'payout'
  amount: number
  reference: string | null
  reason: string | null
  user_name?: string | null
  created_at: string
}

export interface ShiftDetail extends Shift {
  business_id: number
  branch_code: string
  terminal: string
  supervisor: ShiftSupervisor | null
  kpis: {
    opening_float: number
    gross_cash_sales: number
    cash_transactions: number
    net_cash_sales: number
    digital_pos: number
    digital_transactions: number
    refunds_total: number
    drops_total: number
    payouts_total: number
    gross_sales: number
    sales_transactions: number
    expected_drawer: number
  }
  reconciliation: ShiftReconciliation
  journal: ShiftJournalEvent[]
  movements: ShiftMovement[]
}

export interface ShiftConfig {
  shifts_enabled: boolean
  require_cash_reconciliation: boolean
}

export const shiftApi = {
  config: () => http.get<ApiEnvelope<ShiftConfig>>('/shifts/config'),

  setConfig: (input: Partial<ShiftConfig>) =>
    http.put<ApiEnvelope<ShiftConfig>>('/shifts/config', input),

  current: (branchId?: number) =>
    http.get<ApiEnvelope<Shift | null>>('/shifts/current', {
      params: branchId ? { branch_id: branchId } : undefined,
    }),

  open: (input: { branch_id?: number; opening_cash?: number }) =>
    http.post<ApiEnvelope<Shift>>('/shifts/open', input),

  close: (input: { actual_cash?: number; notes?: string; shift_id?: number }) =>
    http.post<ApiEnvelope<Shift & { reconciliation: ShiftReconciliation }>>(
      '/shifts/close',
      input,
    ),

  history: (params?: { page?: number; per_page?: number; status?: ShiftStatus }) =>
    http.get<Paginated<Shift>>('/shifts', { params }),

  detail: (shiftId: number | string) =>
    http.get<ApiEnvelope<ShiftDetail>>(`/shifts/${shiftId}`),

  recordMovement: (
    shiftId: number | string,
    input: { type: 'drop' | 'payout'; amount: number; reason?: string },
  ) =>
    http.post<ApiEnvelope<{ id: number; reference: string | null }>>(
      `/shifts/${shiftId}/movements`,
      input,
    ),

  reconcile: (input: { actual_cash: number; notes?: string }) =>
    http.post<ApiEnvelope<ShiftReconciliation>>('/shifts/reconcile', input),
}