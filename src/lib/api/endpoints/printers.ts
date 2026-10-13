import { http } from '../client'
import type { ApiEnvelope } from '../types'

export type PrinterType = 'receipt' | 'kitchen' | 'label' | 'a4' | 'report'
export type PrinterConnection = 'network' | 'usb' | 'bluetooth' | 'system'
export type PrinterStatus = 'online' | 'offline' | 'unknown'
export type PrinterPaperWidth = '58mm' | '80mm' | 'a4'

export interface Printer {
  id: number
  name: string
  type: PrinterType
  connection: PrinterConnection
  address: string | null
  paper_width: PrinterPaperWidth
  is_default: boolean
  is_active: boolean
  auto_print_receipts: boolean
  print_kitchen_tickets: boolean
  print_labels: boolean
  status: PrinterStatus
  last_seen_at: string | null
  branch_id: number | null
  branch_name: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface PrinterSummary {
  total: number
  online: number
  offline: number
  unknown: number
  inactive: number
  defaults: number
  by_type: Array<{ type: PrinterType; count: number }>
}

export interface PrinterOptions {
  types: PrinterType[]
  connections: PrinterConnection[]
  paper_widths: PrinterPaperWidth[]
}

export interface PrinterListPayload {
  printers: Printer[]
  summary: PrinterSummary
  options: PrinterOptions
}

export interface PrinterInput {
  name: string
  type?: PrinterType
  connection?: PrinterConnection
  address?: string | null
  paper_width?: PrinterPaperWidth
  branch_id?: number | null
  is_default?: boolean
  is_active?: boolean
  auto_print_receipts?: boolean
  print_kitchen_tickets?: boolean
  print_labels?: boolean
  notes?: string | null
}

export interface PrinterPingResult {
  printer: Printer
  reachable: boolean
  latency_ms: number | null
}

export const printersApi = {
  list: (params?: { branch_id?: number; type?: PrinterType; status?: string }) =>
    http.get<ApiEnvelope<PrinterListPayload>>('/printers', { params }),

  create: (input: PrinterInput) => http.post<ApiEnvelope<Printer>>('/printers', input),

  update: (id: number, input: Partial<PrinterInput>) =>
    http.put<ApiEnvelope<Printer>>(`/printers/${id}`, input),

  remove: (id: number) => http.delete<ApiEnvelope<null>>(`/printers/${id}`),

  setDefault: (id: number) => http.post<ApiEnvelope<Printer>>(`/printers/${id}/default`),

  ping: (id: number) => http.post<ApiEnvelope<PrinterPingResult>>(`/printers/${id}/ping`),
}
