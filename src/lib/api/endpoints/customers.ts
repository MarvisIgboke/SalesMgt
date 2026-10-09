import { http } from '../client'
import type { ApiEnvelope, Paginated } from '../types'

export interface Customer {
  id: number
  name: string
  email?: string | null
  phone?: string | null
  address?: string | null
  credit_limit?: number | null
  outstanding_balance: number
  credit_remaining?: number | null
  total_purchases: number
  created_at?: string
}

export interface CustomerInput {
  name: string
  email?: string
  phone?: string
  address?: string
  credit_limit?: number
}

export interface CustomerStatement {
  customer_id: number
  opening_balance: number
  charges: number
  payments: number
  closing_balance: number
  entries: Array<{
    id: number
    date: string
    description: string
    debit: number
    credit: number
    balance: number
  }>
}

export interface CustomerPaymentInput {
  customer_id: number
  amount: number
  method: string
  reference?: string
  notes?: string
}

export const customersApi = {
  list: (params?: { page?: number; per_page?: number; search?: string }) =>
    http.get<Paginated<Customer>>('/customers', { params }),

  get: (id: number) => http.get<ApiEnvelope<Customer>>(`/customers/${id}`),

  create: (input: CustomerInput) => http.post<ApiEnvelope<Customer>>('/customers', input),

  update: (id: number, input: Partial<CustomerInput>) =>
    http.put<ApiEnvelope<Customer>>(`/customers/${id}`, input),

  statement: (id: number, params?: { from?: string; to?: string }) =>
    http.get<ApiEnvelope<CustomerStatement>>(`/customers/${id}/statement`, { params }),

  history: (id: number, params?: { page?: number; per_page?: number }) =>
    http.get<Paginated<unknown>>(`/customers/${id}/purchases`, { params }),

  pay: (input: CustomerPaymentInput) =>
    http.post<ApiEnvelope<{ id: number }>>('/customer-payments', input),

  payments: (id: number, params?: { page?: number; per_page?: number }) =>
    http.get<Paginated<unknown>>(`/customers/${id}/payments`, { params }),
}