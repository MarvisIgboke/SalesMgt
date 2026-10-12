import { http } from '../client'
import type { ApiEnvelope } from '../types'

export interface AuthUser {
  id: number
  name: string
  email: string
  phone?: string | null
  avatar_url?: string | null
  roles: string[]
  permissions: string[]
  business_id: number
  branch_ids: number[]
}

export interface SubscriptionInfo {
  status: 'active' | 'trial' | 'expired' | 'suspended' | 'none'
  plan: string
  expiry_date?: string | null
  trial_ends_at?: string | null
  limits?: Record<string, number | null>
}

export interface WalletInfo {
  balance: number
  currency: string
  pending?: number
}

export interface AuthSession {
  user: AuthUser
  access_token: string
  refresh_token?: string
  token_type: string
  expires_in?: number
  subscription: SubscriptionInfo
  wallet: WalletInfo
}

export interface LoginInput {
  email: string
  password: string
  device_name?: string
  remember?: boolean
}

export interface ProfileInput {
  name?: string
  phone?: string | null
  avatar_url?: string | null
  current_password?: string
  password?: string
  password_confirmation?: string
}

export const authApi = {
  login: (input: LoginInput) =>
    http.post<ApiEnvelope<AuthSession>>('/auth/login', input),

  me: () => http.get<ApiEnvelope<AuthSession>>('/auth/me'),

  updateProfile: (input: ProfileInput) =>
    http.put<ApiEnvelope<AuthSession>>('/auth/profile', input),

  logout: () => http.post<ApiEnvelope<null>>('/auth/logout'),

  refresh: (refreshToken: string) =>
    http.post<ApiEnvelope<{ access_token: string }>>('/auth/refresh', {
      refresh_token: refreshToken,
    }),

  register: (input: {
    business_name: string
    name: string
    email: string
    password: string
    password_confirmation: string
    phone?: string | null
    plan_id?: number
  }) => http.post<ApiEnvelope<AuthSession>>('/auth/register', input),
}