import { http } from '../client'
import type { ApiEnvelope, PaginationLinks, PaginationMeta } from '../types'

export type InvoiceStatus = 'unpaid' | 'paid' | 'void'

export interface SubscriptionInvoice {
  id: number
  number: string
  status: InvoiceStatus
  business_id: number
  business_name?: string | null
  period_start?: string | null
  period_end?: string | null
  issued_at?: string | null
  due_at?: string | null
  amount: number
  currency: string
  paid_at?: string | null
  paid_by?: string | null
  payment_reference?: string | null
  notes?: string | null
  is_overdue: boolean
  created_at?: string | null
}

export interface InvoiceSummary {
  total: number
  paid: number
  unpaid: number
  overdue: number
  void: number
  collected: number
  outstanding: number
}

export interface InvoicePage {
  data: SubscriptionInvoice[]
  meta: PaginationMeta & { summary?: InvoiceSummary }
  links?: PaginationLinks
}

export interface InvoiceQuery {
  page?: number
  per_page?: number
  business_id?: number
  status?: InvoiceStatus | 'overdue'
  from?: string
  to?: string
  search?: string
}

export interface AllocationLimits {
  branch_limit: number | null
  staff_limit: number | null
}

export interface AllocationUsage {
  branches: number
  branches_allocated: number
  staff: number
  staff_allocated: number
}

export interface AllocationBranch {
  id: number
  name: string
  code?: string | null
  type?: string | null
  is_active: boolean
  allocated: boolean
}

export interface AllocationUser {
  id: number
  name: string
  email: string
  is_active: boolean
  allocated: boolean
  locked: boolean
  roles: string[]
}

export interface ResourceAllocation {
  plan: {
    name: string
    status: string
    expires_at?: string | null
    duration_months?: number | null
    grace_days?: number | null
  }
  limits: {
    branch_limit: number | null
    staff_limit: number | null
  }
  usage: {
    branches: number
    branches_allocated: number
    staff: number
    staff_allocated: number
  }
  branches: AllocationBranch[]
  users: AllocationUser[]
  allocated_at?: string | null
}

export const billingApi = {
  allocation: (params?: { business_id?: number }) =>
    http.get<ApiEnvelope<ResourceAllocation>>('/subscription/allocation', { params }),

  updateAllocation: (input: { branch_ids: number[]; user_ids: number[]; business_id?: number }) =>
    http.put<ApiEnvelope<ResourceAllocation>>('/subscription/allocation', input),

  myInvoices: (params?: { page?: number; per_page?: number; status?: string; from?: string; to?: string }) =>
    http.get<InvoicePage>('/subscription/invoices', { params }),

  invoices: (params?: {
    page?: number
    per_page?: number
    business_id?: number
    status?: InvoiceStatus | 'overdue'
    from?: string
    to?: string
    search?: string
  }) => http.get<InvoicePage>('/invoices', { params }),

  generate: (input?: { period?: string; business_id?: number; plan_id?: number }) =>
    http.post<ApiEnvelope<{ generated: number; invoices: SubscriptionInvoice[] }>>('/invoices/generate', input),

  invoice: (id: number) => http.get<ApiEnvelope<SubscriptionInvoice>>(`/invoices/${id}`),

  markPaid: (id: number, input?: { payment_reference?: string; notes?: string }) =>
    http.post<ApiEnvelope<SubscriptionInvoice>>(`/invoices/${id}/mark-paid`, input),

  markUnpaid: (id: number) =>
    http.post<ApiEnvelope<SubscriptionInvoice>>(`/invoices/${id}/mark-unpaid`),
}
