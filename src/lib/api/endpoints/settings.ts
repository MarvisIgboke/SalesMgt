import { http } from '../client'
import type { ApiEnvelope } from '../types'

export type ReceiptPaperWidth = '58mm' | '80mm' | 'a4'

export interface ReceiptConfig {
  name: string | null
  address: string | null
  phone: string | null
  email: string | null
  logo_url: string | null
  header: string | null
  footer: string | null
  tax_id: string | null
  show_logo: boolean
  show_address: boolean
  show_phone: boolean
  show_email: boolean
  show_tax_breakdown: boolean
  show_cashier: boolean
  show_customer: boolean
  show_qr: boolean
  show_datetime: boolean
  round_off: boolean
  paper_width: ReceiptPaperWidth
}

export interface ReceiptSettingsPayload {
  scope: 'business' | 'branch'
  branch_id: number | null
  branch_name: string | null
  business: {
    id: number | null
    name: string | null
    currency: string | null
  }
  defaults: {
    name: string | null
    address: string | null
    phone: string | null
    email: string | null
    logo_url: string | null
  }
  config: ReceiptConfig
  paper_widths: ReceiptPaperWidth[]
}

export interface ReceiptSettingsInput {
  scope?: 'business' | 'branch'
  branch_id?: number | null
  config: Partial<ReceiptConfig>
}

export const receiptSettingsApi = {
  get: () => http.get<ApiEnvelope<ReceiptSettingsPayload>>('/settings/receipt'),

  update: (input: ReceiptSettingsInput) =>
    http.put<ApiEnvelope<ReceiptSettingsPayload>>('/settings/receipt', input),
}
