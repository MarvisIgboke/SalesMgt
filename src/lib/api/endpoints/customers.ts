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

export interface CustomerProfileStats {
  total: number
  new_this_week: number
  wholesale: number
  vip: number
  walkin: number
}

export interface CustomerArStats {
  total: number
  accounts: number
  due_high: number
  credit_accounts: number
  current_accounts: number
  book_health_pct: number
  available: number
  utilisation_pct: number
}

export interface CustomerLoyaltyStats {
  repeat_buyers: number
  retention_pct: number
  lifetime_orders: number
}

export interface CustomerGmvStats {
  value: number
  orders: number
  average: number
  prev_value: number
  mom_pct: number
}

export interface CustomerFilterCounts {
  all: number
  wholesale: number
  vip: number
  credit_due: number
  walkin: number
}

export interface CustomerPipelineStats {
  outstanding: number
  accounts: number
  available: number
}

export interface CustomerCard {
  id: number
  name: string
  email?: string | null
  phone?: string | null
  address?: string | null
  account_code: string
  segment: string
  tier: string
  credit_limit: number | null
  outstanding_balance: number
  credit_remaining: number | null
  utilisation_pct: number
  over_limit: boolean
  lifetime_spend: number
  orders_total: number
  orders_30d: number
  spend_30d: number
  last_purchase_at?: string | null
  is_walkin: boolean
  created_at?: string | null
}

export interface CustomerSummary {
  business_id: number
  currency: string
  profiles: CustomerProfileStats
  ar: CustomerArStats
  loyalty: CustomerLoyaltyStats
  gmv_30d: CustomerGmvStats
  filters: CustomerFilterCounts
  pipeline: CustomerPipelineStats
  customers: CustomerCard[]
}

export const customersApi = {
  list: (params?: { page?: number; per_page?: number; search?: string }) =>
    http.get<Paginated<Customer>>('/customers', { params }),

  summary: () => http.get<ApiEnvelope<CustomerSummary>>('/customers/summary'),

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