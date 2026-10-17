import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  Banknote,
  Landmark,
  CreditCard,
  Globe,
  Wallet,
  CheckCircle2,
  Clock3,
  Printer,
  FileText,
  MessageCircle,
  Share2,
  AlertTriangle,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn, formatCurrency, formatDateTime } from '@/lib/utils'
import { posApi, type PaymentMethod, type Receipt, type SaleResult } from '@/lib/api/endpoints/pos'
import { ApiError } from '@/lib/api/errors'
import { toast } from '@/components/ui/sonner'
import { usePosCart } from './use-pos-cart'
import { usePosStore } from './pos-store'
import {
  thermalPrint,
  downloadReceiptPdf,
  whatsappShare,
  nativeShare,
} from './receipt-actions'

const methods: Array<{
  value: PaymentMethod
  label: string
  icon: typeof Banknote
}> = [
  { value: 'cash', label: 'Cash', icon: Banknote },
  { value: 'bank_transfer', label: 'Bank transfer', icon: Landmark },
  { value: 'card', label: 'Card', icon: CreditCard },
  { value: 'online', label: 'Online', icon: Globe },
  { value: 'credit', label: 'Credit', icon: Wallet },
]

interface PaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PaymentDialog({ open, onOpenChange }: PaymentDialogProps) {
  const { cart, clearCart } = usePosCart()
  const cartReference = usePosStore((s) => s.cartReference)
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [cashReceived, setCashReceived] = useState('')
  const [bankReference, setBankReference] = useState('')
  const [result, setResult] = useState<SaleResult | null>(null)

  const charge = useMutation({
    mutationFn: () =>
      posApi.charge({
        reference: cartReference ?? undefined,
        method,
        cash_received: cashReceived ? Number(cashReceived) : undefined,
        bank_reference: bankReference || undefined,
      }),
    onSuccess: ({ data }) => {
      setResult(data)
    },
    onError: (error) => {
      const msg = error instanceof ApiError ? error.message : 'Payment could not be processed.'
      toast.error(msg)
    },
  })

  const reset = () => {
    setResult(null)
    setMethod('cash')
    setCashReceived('')
    setBankReference('')
  }

  const handleClose = () => {
    reset()
    onOpenChange(false)
  }

  // Receipt view after a completed/awaiting sale.
  if (result) {
    const receipt = result.sale?.receipt

    const requireReceipt = (action: (r: Receipt) => void) => () => {
      if (!receipt) {
        toast.error('Receipt is not available yet for this sale.')
        return
      }
      action(receipt)
    }

    const handlePrint = requireReceipt((r) => {
      if (!thermalPrint(r)) toast.error('Allow pop-ups to print the receipt.')
    })

    const handlePdf = requireReceipt((r) => {
      downloadReceiptPdf(r)
      toast.success('Receipt PDF downloaded.')
    })

    const handleShare = requireReceipt((r) => {
      void (async () => {
        const outcome = await nativeShare(r)
        if (outcome === 'copied') toast.success('Receipt details copied to clipboard.')
        else if (outcome === 'shared') toast.success('Receipt shared.')
        else if (outcome === 'failed') toast.error('Could not share the receipt on this device.')
      })()
    })

    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              {result.status === 'completed' ? (
                <CheckCircle2 className="h-5 w-5 text-success" />
              ) : (
                <Clock3 className="h-5 w-5 text-warning" />
              )}
              <DialogTitle>
                {result.status === 'completed'
                  ? 'Sale completed'
                  : result.status === 'awaiting_approval'
                    ? 'Awaiting approval'
                    : 'Queued'}
              </DialogTitle>
            </div>
            <DialogDescription>
              {result.message ??
                (result.status === 'completed'
                  ? 'The backend has finalized this sale.'
                  : 'This sale is pending backend confirmation. Do not assume it is accepted until Laravel confirms it.')}
            </DialogDescription>
          </DialogHeader>

          {(result.status === 'awaiting_approval' || result.sale?.approval) && (
            <div className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-xs text-warning">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                Approval status:{' '}
                <strong className="capitalize">
                  {result.sale?.approval.status.replace(/_/g, ' ')}
                </strong>
              </span>
            </div>
          )}

          {receipt && (
            <div className="rounded-xl border border-border/60 bg-surface p-4">
              {receipt.config?.show_logo && receipt.config.logo_url && (
                <div className="mb-2 flex justify-center">
                  <img src={receipt.config.logo_url} alt="" className="h-10 object-contain" />
                </div>
              )}
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-foreground">
                  {receipt.config?.name || receipt.business_name}
                </p>
                <Badge variant={result.status === 'completed' ? 'success' : 'warning'}>
                  {receipt.payment_status.replace(/_/g, ' ')}
                </Badge>
              </div>
              {receipt.config?.header && (
                <p className="mt-1 text-[11px] text-muted-foreground">{receipt.config.header}</p>
              )}
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {receipt.branch_name} · {receipt.receipt_number}
              </p>
              {(receipt.config?.show_address ||
                receipt.config?.show_phone ||
                receipt.config?.show_email) && (
                <div className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
                  {receipt.config?.show_address && receipt.config.address && (
                    <p>{receipt.config.address}</p>
                  )}
                  {receipt.config?.show_phone && receipt.config.phone && (
                    <p>Tel: {receipt.config.phone}</p>
                  )}
                  {receipt.config?.show_email && receipt.config.email && (
                    <p>{receipt.config.email}</p>
                  )}
                </div>
              )}
              {receipt.config?.tax_id && (
                <p className="mt-0.5 text-[11px] text-muted-foreground">TIN: {receipt.config.tax_id}</p>
              )}

              <div className="mt-3 max-h-40 space-y-2 overflow-y-auto">
                {receipt.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-xs">
                    <span className="truncate pr-2 text-foreground">
                      {item.product_name} ×{item.quantity}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {formatCurrency(item.line_total)}
                    </span>
                  </div>
                ))}
              </div>

              <Separator className="my-3" />
              <div className="space-y-1 text-xs">
                <Row label="Subtotal" value={formatCurrency(receipt.subtotal)} />
                {receipt.discount_total > 0 && (
                  <Row label="Discount" value={`-${formatCurrency(receipt.discount_total)}`} />
                )}
                {(receipt.config?.show_tax_breakdown ?? true) && (
                  <Row label="Tax" value={formatCurrency(receipt.tax_total)} />
                )}
                <div className="mt-1 flex items-center justify-between text-sm font-bold text-foreground">
                  <span>Total</span>
                  <span className="tabular-nums">{formatCurrency(receipt.total)}</span>
                </div>
                {receipt.change_due > 0 && (
                  <Row label="Change due" value={formatCurrency(receipt.change_due)} />
                )}
              </div>

              <Separator className="my-3" />
              <p className="flex items-center justify-between text-[11px] text-muted-foreground">
                {(receipt.config?.show_customer ?? true) ? (
                  <span>{receipt.customer_name ?? 'Walk-in customer'}</span>
                ) : (
                  <span />
                )}
                {(receipt.config?.show_datetime ?? true) && (
                  <span>{formatDateTime(receipt.created_at)}</span>
                )}
              </p>
              {(receipt.config?.show_cashier ?? true) && (
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Served by {receipt.staff_name}
                </p>
              )}
              {(receipt.config?.show_qr ?? true) && receipt.qr_verification && (
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-border/60 bg-surface-sunken p-2">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded bg-foreground text-[8px] font-bold text-background">
                    QR
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    Verification QR embedded in the receipt payload.
                  </span>
                </div>
              )}
              {receipt.config?.footer && (
                <>
                  <Separator className="my-3" />
                  <p className="text-center text-[10px] text-muted-foreground">
                    {receipt.config.footer}
                  </p>
                </>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <ReceiptAction icon={Printer} label="Thermal print" onClick={handlePrint} />
            <ReceiptAction icon={FileText} label="PDF" onClick={handlePdf} />
            <ReceiptAction icon={MessageCircle} label="WhatsApp" onClick={requireReceipt(whatsappShare)} />
            <ReceiptAction icon={Share2} label="Share" onClick={handleShare} />
          </div>

          <Button className="w-full" onClick={() => { clearCart(); handleClose() }}>
            New sale
          </Button>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose()
      }}
    >
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Take payment</DialogTitle>
          <DialogDescription>
            Allowed methods and amounts are validated by the backend.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Payment method
            </p>
            <div className="grid grid-cols-3 gap-2">
              {methods.map((m) => {
                const Icon = m.icon
                const active = method === m.value
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setMethod(m.value)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-medium transition-all',
                      active
                        ? 'border-primary/60 bg-primary/10 text-primary'
                        : 'border-border/70 text-muted-foreground hover:bg-accent',
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {m.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border/60 bg-surface px-4 py-3">
            <span className="text-sm text-muted-foreground">Amount due</span>
            <span className="text-xl font-bold tabular-nums text-foreground">
              {cart ? formatCurrency(cart.total) : '—'}
            </span>
          </div>

          {method === 'cash' && (
            <div className="space-y-2">
              <Label htmlFor="cash">Cash received</Label>
              <Input
                id="cash"
                type="number"
                inputMode="decimal"
                placeholder="Enter cash tendered"
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
              />
            </div>
          )}

          {(method === 'bank_transfer' || method === 'online') && (
            <div className="space-y-2">
              <Label htmlFor="bankref">Transaction / bank reference</Label>
              <Input
                id="bankref"
                placeholder="e.g. BNK-2026-000123"
                value={bankReference}
                onChange={(e) => setBankReference(e.target.value)}
              />
            </div>
          )}

          {method === 'credit' && (
            <p className="text-xs text-muted-foreground">
              Credit eligibility is determined by the backend for the selected customer.
            </p>
          )}

          <Button
            size="xl"
            className="w-full"
            loading={charge.isPending}
            onClick={() => charge.mutate()}
          >
            Confirm payment
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums text-foreground">{value}</span>
    </div>
  )
}

function ReceiptAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Printer
  label: string
  onClick: () => void
}) {
  return (
    <Button variant="outline" size="sm" className="flex-col gap-1 py-2 text-[10px]" onClick={onClick}>
      <Icon className="h-4 w-4" />
      {label}
    </Button>
  )
}