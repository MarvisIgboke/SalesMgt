import { http } from '../client'
import type { ApiEnvelope } from '../types'

export interface MoneySummary {
  amount: number
  currency: string
}

export interface DashboardKpis {
  period: 'today' | 'week' | 'month'
  sales: MoneySummary
  transaction_count: number
  gross_profit: MoneySummary
  expenses: MoneySummary
  customer_credit: MoneySummary
  wallet_balance: MoneySummary
  payment_breakdown: Array<{
    method: string
    amount: number
    count: number
  }>
  pending_payments: number
  pending_inventory_approvals: number
  low_stock_count: number
  expiring_stock_count: number
  expired_stock_count: number
}

export interface BranchPerformance {
  branch_id: number
  branch_name: string
  sales: number
  transactions: number
  trend_percent?: number
}

export interface StaffPerformance {
  staff_id: number
  staff_name: string
  sales: number
  transactions: number
}

export interface DashboardData {
  kpis: DashboardKpis
  sales_trend: Array<{ label: string; value: number }>
  payment_breakdown: DashboardKpis['payment_breakdown']
  branch_performance: BranchPerformance[]
  staff_performance: StaffPerformance[]
  latest_sales: unknown[]
  low_stock: unknown[]
  expiring_stock: unknown[]
  recent_activity: unknown[]
}

export const dashboardApi = {
  get: (params?: { period?: string; branch_id?: number }) =>
    http.get<ApiEnvelope<DashboardData>>('/dashboard', { params }),
}