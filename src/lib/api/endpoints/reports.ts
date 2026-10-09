import { http } from '../client'
import type { ApiEnvelope } from '../types'

export type ReportType =
  | 'sales'
  | 'inventory-valuation'
  | 'inventory-movement'
  | 'low-stock'
  | 'expired'
  | 'expiring'
  | 'damaged'
  | 'transfers'
  | 'revenue'
  | 'expenses'
  | 'profit'
  | 'receivables'
  | 'payables'
  | 'reconciliation'
  | 'cash-variance'

export interface ReportParams {
  report_type?: ReportType
  from?: string
  to?: string
  branch_id?: number
  product_id?: number
  category_id?: number
  staff_id?: number
  customer_id?: number
  payment_method?: string
  group_by?: string
}

export interface ReportDataset {
  report_type: ReportType
  title: string
  period: { from?: string; to?: string }
  summary: Record<string, number | string>
  rows: unknown[]
  columns: string[]
  generated_at: string
}

export type ExportFormat = 'pdf' | 'excel' | 'csv'

export const reportsApi = {
  get: (params: ReportParams) =>
    http.get<ApiEnvelope<ReportDataset>>('/reports', { params }),

  export: (format: ExportFormat, params: ReportParams) =>
    http.get<ApiEnvelope<{ url: string; filename: string }>>(`/reports/export/${format}`, {
      params,
      responseType: 'text',
    }),
}