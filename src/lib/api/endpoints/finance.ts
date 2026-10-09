import { http } from '../client'
import type { ApiEnvelope, Paginated } from '../types'

export interface FinanceQueueItem {
  id: number
  sale_reference: string
  customer_name?: string | null
  amount: number
  payment_method: string
  bank_reference?: string | null
  match_result?: {
    status: 'matched' | 'partial' | 'unmatched'
    confidence?: number
  } | null
  branch_name: string
  sales_rep: string
  created_at: string
  status: string
}

export interface ApprovalAction {
  id: number
  decision: 'approved' | 'rejected'
  notes?: string
}

export const financeApi = {
  approvalsQueue: (params?: { page?: number; per_page?: number; status?: string }) =>
    http.get<Paginated<FinanceQueueItem>>('/finance/approvals', { params }),

  approve: (id: number, decision: 'approved' | 'rejected', notes?: string) =>
    http.post<ApiEnvelope<FinanceQueueItem>>(`/finance/approvals/${id}`, {
      decision,
      notes,
    }),

  reconciliation: (params?: { page?: number; per_page?: number; status?: string }) =>
    http.get<Paginated<unknown>>('/finance/reconciliation', { params }),

  receivables: () =>
    http.get<ApiEnvelope<{ total: number; outstanding: number; overdue: number }>>(
      '/finance/receivables-summary',
    ),

  payables: () =>
    http.get<ApiEnvelope<{ total: number; outstanding: number; overdue: number }>>(
      '/finance/payables-summary',
    ),
}

export const settingsApi = {
  get: () => http.get<ApiEnvelope<Record<string, unknown>>>('/settings'),

  update: (input: Record<string, unknown>) =>
    http.put<ApiEnvelope<Record<string, unknown>>>('/settings', input),

  preferences: () => http.get<ApiEnvelope<Record<string, unknown>>>('/settings/preferences'),
}