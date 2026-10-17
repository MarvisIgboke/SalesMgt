import type { Receipt } from '@/lib/api/endpoints/pos'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { downloadPdf } from '@/lib/pdf'

function centerText(text: string, width: number): string {
  const pad = Math.max(0, Math.floor((width - text.length) / 2))
  return ' '.repeat(pad) + text
}

function itemLine(name: string, qty: number, total: string): string {
  const totalPart = total
  const leftPad = Math.max(1, 32 - name.length - qty.toString().length - totalPart.length - 2)
  return name + ' ' + qty + ' '.repeat(leftPad) + totalPart
}

function totalLine(label: string, value: string): string {
  const labelPart = label
  const totalW = 32
  const pad = Math.max(1, totalW - labelPart.length - value.length)
  return labelPart + ' '.repeat(pad) + value
}

function keyVal(k: string, v: string): string {
  const pad = Math.max(1, 28 - k.length - v.length)
  return k + ' '.repeat(pad) + v
}

function toLines(receipt: Receipt): string[] {
  const out: string[] = []
  const cfg = receipt.config

  out.push(centerText(receipt.business_name, 32))
  if (receipt.branch_name) out.push(centerText(receipt.branch_name, 32))
  if (cfg?.show_address && cfg.address) out.push(centerText(cfg.address, 32))
  if (cfg?.show_phone && cfg.phone) out.push(centerText('Tel: ' + cfg.phone, 32))
  if (cfg?.show_email && cfg.email) out.push(centerText(cfg.email, 32))
  if (cfg?.tax_id) out.push(centerText('TIN: ' + cfg.tax_id, 32))

  out.push('-'.repeat(32))

  out.push(keyVal('Receipt #', receipt.receipt_number))
  out.push(keyVal('Reference', receipt.sale_reference))
  if (cfg?.show_datetime ?? true) out.push(keyVal('Date', formatDateTime(receipt.created_at)))
  if (cfg?.show_customer ?? true) out.push(keyVal('Customer', receipt.customer_name ?? 'Walk-in'))
  if (cfg?.show_cashier ?? true) out.push(keyVal('Staff', receipt.staff_name))

  out.push('-'.repeat(32))

  receipt.items.forEach((item) => {
    const name = (item.product_name + (item.variant_name ? ' (' + item.variant_name + ')' : '')).slice(0, 24)
    const qtyStr = 'x' + item.quantity
    const totalStr = formatCurrency(item.line_total)
    out.push(itemLine(name, item.quantity, totalStr))
    const unitStr = formatCurrency(item.unit_price)
    out.push('  ' + unitStr + '  ' + qtyStr)
  })

  out.push('-'.repeat(32))

  out.push(totalLine('Subtotal', formatCurrency(receipt.subtotal)))
  if (receipt.discount_total > 0) {
    out.push(totalLine('Discount', '-' + formatCurrency(receipt.discount_total)))
  }
  if (cfg?.show_tax_breakdown ?? true) {
    out.push(totalLine('Tax', formatCurrency(receipt.tax_total)))
  }
  out.push(totalLine('TOTAL', formatCurrency(receipt.total)))
  out.push(totalLine('Amount Paid', formatCurrency(receipt.amount_paid)))
  if (receipt.change_due > 0) {
    out.push(totalLine('Change Due', formatCurrency(receipt.change_due)))
  }

  receipt.payment_methods.forEach((pm) => {
    out.push(totalLine('Paid via ' + pm.method, formatCurrency(pm.amount)))
  })

  out.push('')
  if (cfg?.show_qr ?? true) {
    if (receipt.qr_verification) {
      out.push('Verify at: ' + (receipt.qr_verification.url ?? 'QR code on receipt'))
    } else {
      out.push('Verification QR available on receipt')
    }
  }
  if (cfg?.footer) out.push(centerText(cfg.footer, 32))
  out.push('')
  out.push(centerText('Thank you', 32))
  return out
}

function toWhatsAppText(receipt: Receipt): string {
  const cfg = receipt.config
  const header = cfg?.header || 'Purchase Receipt'
  const lines: string[] = []
  lines.push('🧾 *' + receipt.business_name + '*')
  if (receipt.branch_name) lines.push(receipt.branch_name)
  if (cfg?.show_phone && cfg.phone) lines.push('Tel: ' + cfg.phone)
  lines.push('')
  lines.push('*' + header + '*')
  lines.push('Receipt #' + receipt.receipt_number)
  lines.push('Ref: ' + receipt.sale_reference)
  lines.push('Date: ' + formatDateTime(receipt.created_at))
  if (cfg?.show_customer ?? true) lines.push('Customer: ' + (receipt.customer_name ?? 'Walk-in'))
  if (cfg?.show_cashier ?? true) lines.push('Staff: ' + receipt.staff_name)
  lines.push('')
  lines.push('*Items*')
  receipt.items.forEach((item) => {
    const name = item.product_name + (item.variant_name ? ' (' + item.variant_name + ')' : '')
    lines.push('• ' + name + ' x' + item.quantity + ' = ' + formatCurrency(item.line_total))
  })
  lines.push('')
  lines.push('Subtotal: ' + formatCurrency(receipt.subtotal))
  if (receipt.discount_total > 0) lines.push('Discount: -' + formatCurrency(receipt.discount_total))
  if (cfg?.show_tax_breakdown ?? true) lines.push('Tax: ' + formatCurrency(receipt.tax_total))
  lines.push('*Total: ' + formatCurrency(receipt.total) + '*')
  lines.push('Amount Paid: ' + formatCurrency(receipt.amount_paid))
  if (receipt.change_due > 0) lines.push('Change Due: ' + formatCurrency(receipt.change_due))
  lines.push('')
  receipt.payment_methods.forEach((pm) => {
    lines.push('Paid via ' + pm.method + ': ' + formatCurrency(pm.amount))
  })
  if (cfg?.footer) {
    lines.push('')
    lines.push(cfg.footer)
  }
  return lines.join('\n')
}

function toShareText(receipt: Receipt): string {
  const cfg = receipt.config
  const lines: string[] = []
  lines.push(receipt.business_name)
  if (receipt.branch_name) lines.push(receipt.branch_name)
  lines.push('')
  lines.push('Receipt ' + receipt.receipt_number)
  lines.push('Ref ' + receipt.sale_reference)
  lines.push(formatDateTime(receipt.created_at))
  lines.push('')
  lines.push('Items:')
  receipt.items.forEach((item) => {
    lines.push(
      '- ' + item.product_name + (item.variant_name ? ' (' + item.variant_name + ')' : '') +
      ' x' + item.quantity + ' @ ' + formatCurrency(item.unit_price) +
      ' = ' + formatCurrency(item.line_total)
    )
  })
  lines.push('')
  lines.push('Subtotal: ' + formatCurrency(receipt.subtotal))
  if (receipt.discount_total > 0) lines.push('Discount: -' + formatCurrency(receipt.discount_total))
  lines.push('Total: ' + formatCurrency(receipt.total))
  lines.push('Paid: ' + formatCurrency(receipt.amount_paid))
  if (receipt.change_due > 0) lines.push('Change: ' + formatCurrency(receipt.change_due))
  if (cfg?.footer) lines.push(cfg.footer)
  return lines.join('\n')
}

export function thermalPrint(receipt: Receipt): boolean {
  const cfg = receipt.config
  const paper = cfg?.paper_width === '58mm' ? '58mm' : '80mm'
  const bodyWidth = paper === '58mm' ? '50mm' : '72mm'
  const win = window.open('', '_blank', 'width=640,height=880')
  if (!win) return false
  const body = toLines(receipt)
    .map((l) => {
      const text = l.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      return '<div style="font-family:monospace;white-space:pre;line-height:1.45">' + text + '</div>'
    })
    .join('')
  win.document.write(
    '<!doctype html><html><head><title>Receipt ' + receipt.receipt_number + '</title>' +
    '<style>@page{size:' + paper + ' auto;margin:4mm}body{margin:0;padding:4mm;width:' + bodyWidth + ';background:#fff;color:#000;font-size:11px}</style>' +
    '</head><body>' + body + '</body></html>'
  )
  win.document.close()
  win.focus()
  win.onload = () => setTimeout(() => win.print(), 180)
  return true
}

export function downloadReceiptPdf(receipt: Receipt): void {
  const cfg = receipt.config
  const filename = 'receipt-' + receipt.receipt_number.replace(/[^A-Za-z0-9-]/g, '') + '.pdf'
  downloadPdf(toLines(receipt), filename, {
    pageWidth: cfg?.paper_width === 'a4' ? 595 : 226.8,
    pageHeight: cfg?.paper_width === 'a4' ? 842 : 1440,
    margin: cfg?.paper_width === 'a4' ? 48 : 28,
    fontSize: 9.5,
    leading: 13,
    font: 'Courier',
  })
}

export function whatsappShare(receipt: Receipt): void {
  const url = 'https://api.whatsapp.com/send?text=' + encodeURIComponent(toWhatsAppText(receipt))
  window.open(url, '_blank', 'noopener,noreferrer')
}

export async function nativeShare(receipt: Receipt): Promise<'shared' | 'copied' | 'cancelled'> {
  const shareData = {
    title: 'Receipt ' + receipt.receipt_number,
    text: toShareText(receipt),
  }
  if (navigator.share) {
    try {
      await navigator.share(shareData)
      return 'shared'
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return 'cancelled'
    }
  }
  try {
    await navigator.clipboard.writeText(shareData.text)
    return 'copied'
  } catch {
    return 'cancelled'
  }
}
