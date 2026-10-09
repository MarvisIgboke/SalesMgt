import { http } from '../client'
import type { ApiEnvelope, Paginated } from '../types'

export type ShiftStatus = 'open' | 'closed' | 'active'

export interface Shift {
  id: number
  branch_id: number
  branch_name: string
  user_id: number
  user_name: string
  status: ShiftStatus
  opened_at: string
  closed_at?: string | null
  expected_cash: number
  opening_cash: number
}

export interface ShiftReconciliation {
  expected_cash: number
  actual_cash: number
  variance: number
  sales_total: number
  transaction_count: number
  payment_breakdown: Array<{ method: string; amount: number; count: number }>
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

  close: (input: { actual_cash?: number; notes?: string }) =>
    http.post<ApiEnvelope<Shift & { reconciliation: ShiftReconciliation }>>(
      '/shifts/close',
      input,
    ),

  history: (params?: { page?: number; per_page?: number; status?: ShiftStatus }) =>
    http.get<Paginated<Shift>>('/shifts', { params }),

  reconcile: (input: { actual_cash: number; notes?: string }) =>
    http.post<ApiEnvelope<ShiftReconciliation>>('/shifts/reconcile', input),
}