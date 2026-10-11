import { http } from '../client'
import type { ApiEnvelope } from '../types'

export type FinancialPeriod = 'today' | 'week' | 'month' | 'mtd' | 'custom'

export interface FinancialReportParams {
  period?: FinancialPeriod
  from?: string
  to?: string
  branch_id?: number
}

export interface FinancialRevenuePoint {
  label: string
  value: number
}

export interface FinancialKpiRevenue {
  value: number
  prev_value: number
  mom_pct: number | null
  orders: number
  trend: FinancialRevenuePoint[]
}

export interface FinancialKpiNetProfit {
  value: number
  margin_pct: number
  gross_profit: number
  expenses: number
}

export interface FinancialKpiCogs {
  value: number
  pct_of_gmv: number
}

export interface FinancialKpiTax {
  value: number
  rate: number
  taxed_orders: number
}

export interface FinancialKpis {
  gross_revenue: FinancialKpiRevenue
  net_profit: FinancialKpiNetProfit
  cogs: FinancialKpiCogs
  tax_vat: FinancialKpiTax
}

export interface FinancialChannel {
  key: string
  label: string
  amount: number
  orders: number
  pct: number
  aov: number
}

export interface FinancialTill {
  expected: number
  audited: number
  variance: number
  variance_pct: number
  tills: number
  closed: number
  balanced: number
  rate_pct: number
  cash_sales: number
}

export interface FinancialShrinkageCategory {
  name: string
  units: number
  value: number
}

export interface FinancialShrinkage {
  inventory_value: number
  waste_units: number
  waste_value: number
  waste_pct: number
  expired_value: number
  near_expiry_value: number
  categories: FinancialShrinkageCategory[]
}

export interface FinancialTax {
  output_vat: number
  taxable_base: number
  total_remittance: number
  rate: number
  taxed_orders: number
}

export interface FinancialPlan {
  plan: string
  status: string
  expires_at: string | null
  features: string[]
  limits: Record<string, number | null>
}

export interface FinancialReportSummary {
  business_id: number
  currency: string
  vat_rate: number
  period: {
    key: FinancialPeriod
    label: string
    from: string
    to: string
  }
  synced_at: string
  kpis: FinancialKpis
  channels: FinancialChannel[]
  till: FinancialTill
  shrinkage: FinancialShrinkage
  tax: FinancialTax
  plan: FinancialPlan | null
}

export const financialReportApi = {
  summary: (params: FinancialReportParams = {}) =>
    http.get<ApiEnvelope<FinancialReportSummary>>('/reports/financial', { params }),
}
