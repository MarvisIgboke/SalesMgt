import { http } from '../client'
import type { ApiEnvelope, Paginated } from '../types'
import type { SubscriptionInfo, WalletInfo } from './auth'

export interface Business {
  id: number
  name: string
  slug?: string
  logo_url?: string | null
  currency: string
  timezone: string
  address?: string | null
  email?: string | null
  phone?: string | null
  subscription: SubscriptionInfo
}

export interface Branch {
  id: number
  business_id?: number
  name: string
  code?: string
  address?: string | null
  phone?: string | null
  type?: string
  is_active: boolean
  defaults?: {
    currency?: string
  }
  manager?: string | null
  today_sales?: number
  today_orders?: number
  stock_value?: number
  stock_skus?: number
  open_tills?: number
  variance?: number
}

export interface BranchTypeCount {
  type: string
  count: number
}

export interface BranchSummary {
  business_id: number
  currency: string
  nodes: {
    total: number
    active: number
    inactive: number
    by_type: BranchTypeCount[]
  }
  gmv_24h: {
    value: number
    orders: number
    average: number
  }
  registers: {
    open: number
    variance: number
    branches: number
  }
  inventory: {
    value: number
    skus: number
    in_stock_pct: number
  }
  branches: Branch[]
}

export interface ActiveContext {
  business: Business
  branch: Branch | null
  subscription: SubscriptionInfo
  wallet: WalletInfo
}

export const businessApi = {
  getContext: () => http.get<ApiEnvelope<ActiveContext>>('/business/context'),

  listBranches: (params?: { page?: number; per_page?: number; business_id?: number }) =>
    http.get<Paginated<Branch>>('/branches', { params }),

  branchSummary: (params?: { business_id?: number }) =>
    http.get<ApiEnvelope<BranchSummary>>('/branches/summary', { params }),

  listBusinesses: () => http.get<ApiEnvelope<Business[]>>('/businesses'),

  createBusiness: (input: {
    name: string
    slug?: string
    currency?: string
    timezone?: string
    address?: string
    email?: string
    phone?: string
    plan_id?: number
  }) => http.post<ApiEnvelope<Business>>('/businesses', input),

  assignPlan: (
    businessId: number,
    input: {
      plan_id: number
      status?: 'active' | 'trial' | 'expired' | 'suspended'
      starts_at?: string
      expires_at?: string
      trial_ends_at?: string
      grace_ends_at?: string
    },
  ) => http.post<ApiEnvelope<Business>>(`/businesses/${businessId}/plan`, input),

  switchBranch: (branchId: number | null) =>
    http.post<ApiEnvelope<ActiveContext>>('/business/switch-branch', { branch_id: branchId }),

  createBranch: (input: {
    business_id?: number
    name: string
    code?: string
    address?: string
    phone?: string
    type?: string
    is_active?: boolean
  }) => http.post<ApiEnvelope<Branch>>('/branches', input),

  updateBranch: (
    id: number,
    input: {
      name: string
      code?: string
      address?: string
      phone?: string
      type?: string
      is_active?: boolean
    },
  ) => http.put<ApiEnvelope<Branch>>(`/branches/${id}`, input),

  deleteBranch: (id: number) => http.delete<ApiEnvelope<null>>(`/branches/${id}`),
}

export interface SubscriptionPlan {
  id: number
  slug: string
  name: string
  description?: string | null
  staff_limit?: number | null
  branch_limit?: number | null
  product_limit?: number | null
  transaction_limit?: number | null
  monthly_price?: number | null
  quarterly_price?: number | null
  annual_price?: number | null
  currency?: string
  grace_days?: number
  features?: string[]
  is_active?: boolean
  limits?: Record<string, number | null>
}

export interface PlanInput {
  slug: string
  name: string
  description?: string | null
  staff_limit?: number | null
  branch_limit?: number | null
  product_limit?: number | null
  transaction_limit?: number | null
  monthly_price?: number | null
  quarterly_price?: number | null
  annual_price?: number | null
  currency?: string
  grace_days?: number
  features?: string[]
  is_active?: boolean
}

export const walletApi = {
  get: () => http.get<ApiEnvelope<WalletInfo>>('/wallet'),

  transactions: (params?: {
    page?: number
    per_page?: number
    type?: string
  }) => http.get<Paginated<unknown>>('/wallet/transactions', { params }),
}

export const subscriptionApi = {
  get: () => http.get<ApiEnvelope<SubscriptionInfo>>('/subscription'),

  plans: () => http.get<ApiEnvelope<SubscriptionPlan[]>>('/subscription/plans'),

  createPlan: (input: PlanInput) => http.post<ApiEnvelope<SubscriptionPlan>>('/subscription/plans', input),

  updatePlan: (id: number, input: Partial<PlanInput>) =>
    http.put<ApiEnvelope<SubscriptionPlan>>(`/subscription/plans/${id}`, input),

  deletePlan: (id: number) => http.delete<ApiEnvelope<null>>(`/subscription/plans/${id}`),
}