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
  name: string
  code?: string
  address?: string | null
  phone?: string | null
  type?: string
  is_active: boolean
  defaults?: {
    currency?: string
  }
}

export interface ActiveContext {
  business: Business
  branch: Branch | null
  subscription: SubscriptionInfo
  wallet: WalletInfo
}

export const businessApi = {
  getContext: () => http.get<ApiEnvelope<ActiveContext>>('/business/context'),

  listBranches: (params?: { page?: number; per_page?: number }) =>
    http.get<Paginated<Branch>>('/branches', { params }),

  listBusinesses: () => http.get<ApiEnvelope<Business[]>>('/businesses'),

  switchBranch: (branchId: number) =>
    http.post<ApiEnvelope<ActiveContext>>('/business/switch-branch', { branch_id: branchId }),
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

  plans: () => http.get<ApiEnvelope<unknown[]>>('/subscription/plans'),
}