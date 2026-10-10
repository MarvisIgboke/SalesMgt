import { http } from '../client'
import type { ApiEnvelope } from '../types'

export interface MoneySummary {
  amount: number
  currency: string
}

export interface DashboardKpis {
  period: 'today' | 'yesterday' | 'week' | 'month' | 'custom' | string
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
  currency?: string
}

export interface LatestSale {
  id: number
  reference: string
  total: number
  status: string
  payment_status: string
  created_at: string
  customer_name: string | null
  branch_name: string | null
}

export interface ActivityEntry {
  id: number
  action: string
  entity_type: string | null
  entity_id: number | null
  created_at: string
}

export interface LowStockItem {
  product_id: number
  product_name: string
  quantity: number
  low_stock_threshold: number
}

export interface ExpiringStockItem {
  id: number
  product_id: number
  product_name: string
  batch_number: string | null
  expiry_date: string
  quantity_available: number
  days_remaining: number
}

export interface DashboardData {
  kpis: DashboardKpis
  sales_trend: Array<{ label: string; value: number }>
  payment_breakdown: DashboardKpis['payment_breakdown']
  branch_performance: BranchPerformance[]
  staff_performance: StaffPerformance[]
  latest_sales: LatestSale[]
  low_stock: LowStockItem[]
  expiring_stock: ExpiringStockItem[]
  recent_activity: ActivityEntry[]
}

export type DashboardPeriod = 'today' | 'yesterday' | 'week' | 'month' | 'custom'

export const dashboardApi = {
  get: (params?: { period?: DashboardPeriod; branch_id?: number; from?: string; to?: string }) =>
    http.get<ApiEnvelope<DashboardData>>('/dashboard', { params }),
}