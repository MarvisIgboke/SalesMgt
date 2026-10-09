import { http } from '../client'
import type { ApiEnvelope, Paginated } from '../types'

export interface Expense {
  id: number
  reference: string
  description: string
  amount: number
  category?: string | null
  branch_id: number
  branch_name: string
  status: 'pending' | 'approved' | 'rejected' | 'awaiting_approval'
  submitted_by: string
  approved_by?: string | null
  created_at: string
}

export interface ExpenseInput {
  description: string
  amount: number
  category?: string
  branch_id?: number
  date?: string
}

export interface ExpenseCategory {
  id: number
  name: string
}

export const expensesApi = {
  dashboard: (params?: { branch_id?: number; period?: string }) =>
    http.get<ApiEnvelope<{ total: number; by_category: unknown[]; pending_count: number }>>(
      '/expenses/dashboard',
      { params },
    ),

  list: (params?: { page?: number; per_page?: number; status?: string; branch_id?: number }) =>
    http.get<Paginated<Expense>>('/expenses', { params }),

  create: (input: ExpenseInput) => http.post<ApiEnvelope<Expense>>('/expenses', input),

  categories: () => http.get<ApiEnvelope<ExpenseCategory[]>>('/expenses/categories'),

  approvals: (params?: { page?: number; per_page?: number }) =>
    http.get<Paginated<Expense>>('/expenses/approvals', { params }),

  decide: (id: number, decision: 'approved' | 'rejected', notes?: string) =>
    http.post<ApiEnvelope<Expense>>(`/expenses/${id}/decision`, { decision, notes }),
}