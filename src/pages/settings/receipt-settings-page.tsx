import { useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlignLeft,
  Building2,
  Hash,
  Image as ImageIcon,
  Mail,
  MapPin,
  Phone,
  Printer,
  Save,
  ShieldAlert,
  Store,
  type LucideIcon,
} from 'lucide-react'
import { PageHeader } from '@/components/common/page-header'
import { ErrorState } from '@/components/common/error-state'
import { EmptyState } from '@/components/common/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  receiptSettingsApi,
  type ReceiptConfig,
  type ReceiptPaperWidth,
  type ReceiptSettingsPayload,
} from '@/lib/api/endpoints/settings'
import { usePermissions } from '@/lib/use-permissions'
import { useAppStore } from '@/stores/app'
import { toast } from '@/components/ui/sonner'
import { ApiError } from '@/lib/api/errors'
import { cn, formatCurrency } from '@/lib/utils'

const PAPER_LABEL: Record<ReceiptPaperWidth, string> = {
  '58mm': '58mm thermal',
  '80mm': '80mm thermal',
  a4: 'A4 / Letter',
}

const PAPER_WIDTHS: ReceiptPaperWidth[] = ['58mm', '80mm', 'a4']

const PREVIEW_WIDTH: Record<ReceiptPaperWidth, string> = {
  '58mm': 'max-w-[230px]',
  '80mm': 'max-w-[300px]',
  a4: 'max-w-[380px]',
}

const SAMPLE_ITEMS = [
  { name: 'Paracetamol 500mg ×24', qty: 2, price: 750 },
  { name: 'Vitamin C 1000mg', qty: 1, price: 2500 },
]

export function ReceiptSettingsPage() {
  const { canAny } = usePermissions()
  const allowed = canAny('settings.receipt', 'staff.permissions', 'wallet.manage')
  const branchId = useAppStore((s) => s.context?.branch?.id ?? null)

  const query = useQuery({
    queryKey: ['receipt-settings', branchId],
    queryFn: () => receiptSettingsApi.get().then((res) => res.data),
    enabled: allowed,
  })

  if (!allowed) {
    return (
      <div className="animate-fade-in max-w-3xl space-y-4">
        <PageHeader
          title="Receipt Settings"
          eyebrow="System"
          description="Brand and layout of the customer receipt."
        />
        <EmptyState
          title="You don't have access"
          description="Receipt settings are managed by a store manager or business administrator."
          icon={<ShieldAlert className="h-6 w-6" />}
        />
      </div>
    )
  }

  if (query.isLoading) {
    return (
      <div className="animate-fade-in space-y-4">
        <PageHeader
          title="Receipt Settings"
          eyebrow="System"
          description="Brand and layout of the customer receipt."
        />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <Skeleton className="h-64 w-full rounded-2xl" />
            <Skeleton className="h-48 w-full rounded-2xl" />
          </div>
          <Skeleton className="h-80 w-full rounded-2xl" />
        </div>
      </div>
    )
  }

  if (query.isError || !query.data) {
    return (
      <div className="animate-fade-in max-w-3xl space-y-4">
        <PageHeader
          title="Receipt Settings"
          eyebrow="System"
          description="Brand and layout of the customer receipt."
        />
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </div>
    )
  }

  return <ReceiptSettingsForm key={query.data.branch_id ?? 'all'} data={query.data} />
}

function ReceiptSettingsForm({ data }: { data: ReceiptSettingsPayload }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<ReceiptConfig>(() => ({ ...data.config }))

  const patch = (change: Partial<ReceiptConfig>) => setForm((prev) => ({ ...prev, ...change }))

  const save = useMutation({
    mutationFn: () =>
      receiptSettingsApi.update({ scope: data.scope, branch_id: data.branch_id, config: form }),
    onSuccess: (res) => {
      toast.success('Receipt settings saved', {
        description: data.branch_name
          ? `Applies to ${data.branch_name}.`
          : 'Applies to all branches.',
      })
      queryClient.setQueryData(['receipt-settings', res.data.branch_id ?? null], res.data)
    },
    onError: (err) => {
      toast.error('Could not save receipt settings', {
        description: err instanceof ApiError ? err.message : undefined,
      })
    },
  })

  const preview = useMemo(() => {
    const currency = data.business.currency ?? 'NGN'
    const subtotal = SAMPLE_ITEMS.reduce((sum, item) => sum + item.price * item.qty, 0)
    const discount = 200
    const taxable = subtotal - discount
    const tax = form.show_tax_breakdown ? Math.round(taxable * 0.075 * 100) / 100 : 0
    const rawTotal = taxable + tax
    const total = form.round_off ? Math.round(rawTotal) : rawTotal

    return {
      currency,
      subtotal,
      discount,
      tax,
      total,
      name: form.name?.trim() || data.defaults.name || 'Your business',
      address: form.show_address ? form.address?.trim() || data.defaults.address : null,
      phone: form.show_phone ? form.phone?.trim() || data.defaults.phone : null,
      email: form.show_email ? form.email?.trim() || data.defaults.email : null,
      logo: form.show_logo ? form.logo_url?.trim() || data.defaults.logo_url : null,
    }
  }, [form, data])

  return (
    <div className="animate-fade-in space-y-4">
      <PageHeader
        title="Receipt Settings"
        eyebrow="System"
        description={
          data.branch_name
            ? `Configure what prints on receipts for the ${data.branch_name} branch.`
            : 'Configure what prints on receipts across every branch.'
        }
      >
        <Button size="sm" loading={save.isPending} onClick={() => save.mutate()}>
          <Save className="h-4 w-4" />
          Save changes
        </Button>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <SectionCard
            icon={Store}
            title="Store identity"
            description="Shown at the top of every receipt. Leave a field blank to fall back to the branch and business defaults."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Display name"
                icon={Building2}
                value={form.name ?? ''}
                placeholder={data.defaults.name ?? 'Business name'}
                onChange={(value) => patch({ name: value })}
                className="sm:col-span-2"
              />
              <Field
                label="Address"
                icon={MapPin}
                value={form.address ?? ''}
                placeholder={data.defaults.address ?? 'Street, city, state'}
                onChange={(value) => patch({ address: value })}
                className="sm:col-span-2"
              />
              <Field
                label="Phone"
                icon={Phone}
                value={form.phone ?? ''}
                placeholder={data.defaults.phone ?? '+234 800 000 0000'}
                onChange={(value) => patch({ phone: value })}
              />
              <Field
                label="Email"
                icon={Mail}
                value={form.email ?? ''}
                placeholder={data.defaults.email ?? 'store@example.com'}
                onChange={(value) => patch({ email: value })}
              />
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="receipt-logo">Logo URL</Label>
                <div className="flex items-center gap-3">
                  <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-surface-sunken">
                    {preview.logo ? (
                      <img
                        src={preview.logo}
                        alt="Receipt logo"
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    )}
                  </span>
                  <Input
                    id="receipt-logo"
                    value={form.logo_url ?? ''}
                    placeholder={data.defaults.logo_url ?? 'https://…/logo.png'}
                    onChange={(event) => patch({ logo_url: event.target.value })}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Use a high-contrast PNG with a transparent or white background. Thermal prints are
                  monochrome.
                </p>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            icon={AlignLeft}
            title="Receipt content"
            description="Optional header and footer copy plus your tax identifier."
          >
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="receipt-header">Header line</Label>
                <Input
                  id="receipt-header"
                  value={form.header ?? ''}
                  placeholder="e.g. Thank you for shopping with us"
                  onChange={(event) => patch({ header: event.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="receipt-footer">Footer note</Label>
                <textarea
                  id="receipt-footer"
                  value={form.footer ?? ''}
                  placeholder="e.g. Goods sold in good condition are not returnable after 7 days."
                  onChange={(event) => patch({ footer: event.target.value })}
                  rows={3}
                  className="flex min-h-[72px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <Field
                label="Tax / VAT ID"
                icon={Hash}
                value={form.tax_id ?? ''}
                placeholder="e.g. TIN-12345678"
                onChange={(value) => patch({ tax_id: value })}
              />
            </div>
          </SectionCard>

          <SectionCard
            icon={Printer}
            title="Layout & display"
            description="Choose the paper width and which lines appear on the printed receipt."
          >
            <div className="grid gap-2 sm:max-w-xs">
              <Label>Paper width</Label>
              <Select
                value={form.paper_width}
                onValueChange={(value) => patch({ paper_width: value as ReceiptPaperWidth })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(data.paper_widths?.length ? data.paper_widths : PAPER_WIDTHS).map((width) => (
                    <SelectItem key={width} value={width}>
                      {PAPER_LABEL[width] ?? width}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="mt-4 space-y-4">
              <ToggleRow
                label="Show logo"
                description="Print the logo above the business name."
                checked={form.show_logo}
                onChange={(value) => patch({ show_logo: value })}
              />
              <ToggleRow
                label="Show address"
                description="Print the store address."
                checked={form.show_address}
                onChange={(value) => patch({ show_address: value })}
              />
              <ToggleRow
                label="Show phone"
                description="Print the contact phone number."
                checked={form.show_phone}
                onChange={(value) => patch({ show_phone: value })}
              />
              <ToggleRow
                label="Show email"
                description="Print the contact email address."
                checked={form.show_email}
                onChange={(value) => patch({ show_email: value })}
              />
              <ToggleRow
                label="Show tax breakdown"
                description="Include the VAT line on the receipt."
                checked={form.show_tax_breakdown}
                onChange={(value) => patch({ show_tax_breakdown: value })}
              />
              <ToggleRow
                label="Show cashier"
                description="Print the staff member who took the sale."
                checked={form.show_cashier}
                onChange={(value) => patch({ show_cashier: value })}
              />
              <ToggleRow
                label="Show customer"
                description="Print the customer name when attached to a sale."
                checked={form.show_customer}
                onChange={(value) => patch({ show_customer: value })}
              />
              <ToggleRow
                label="Show date & time"
                description="Print the transaction timestamp."
                checked={form.show_datetime}
                onChange={(value) => patch({ show_datetime: value })}
              />
              <ToggleRow
                label="Verification QR"
                description="Embed the QR code used to verify the sale."
                checked={form.show_qr}
                onChange={(value) => patch({ show_qr: value })}
              />
              <ToggleRow
                label="Round off total"
                description="Round the grand total to the nearest whole unit."
                checked={form.round_off}
                onChange={(value) => patch({ round_off: value })}
              />
            </div>
          </SectionCard>
        </div>

        <div className="lg:sticky lg:top-4 lg:self-start">
          <ReceiptPreview
            config={form}
            preview={preview}
            scope={data.scope}
            branchName={data.branch_name}
          />
        </div>
      </div>

      <div className="flex justify-end pb-8">
        <Button loading={save.isPending} onClick={() => save.mutate()}>
          <Save className="h-4 w-4" />
          Save changes
        </Button>
      </div>
    </div>
  )
}

interface PreviewValues {
  currency: string
  subtotal: number
  discount: number
  tax: number
  total: number
  name: string
  address: string | null | undefined
  phone: string | null | undefined
  email: string | null | undefined
  logo: string | null | undefined
}

function ReceiptPreview({
  config,
  preview,
  scope,
  branchName,
}: {
  config: ReceiptConfig
  preview: PreviewValues
  scope: 'business' | 'branch'
  branchName: string | null
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface-sunken p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Live preview
        </span>
        <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-primary">
          {scope === 'branch' ? branchName ?? 'This branch' : 'All branches'}
        </span>
      </div>

      <div className="max-h-[70vh] overflow-y-auto rounded-xl bg-white p-4 text-[11px] text-neutral-900 shadow-inner">
        <div className={cn('mx-auto font-mono leading-relaxed', PREVIEW_WIDTH[config.paper_width])}>
          {preview.logo && (
            <div className="mb-2 flex justify-center">
              <img src={preview.logo} alt="" className="h-10 object-contain" />
            </div>
          )}
          <p className="text-center text-[13px] font-bold uppercase">{preview.name}</p>
          {preview.address && <p className="text-center text-[10px]">{preview.address}</p>}
          {preview.phone && <p className="text-center text-[10px]">Tel: {preview.phone}</p>}
          {preview.email && <p className="text-center text-[10px]">{preview.email}</p>}
          {config.tax_id && <p className="text-center text-[10px]">TIN: {config.tax_id}</p>}

          <Dashed />

          {config.header && <p className="mb-1 text-center">{config.header}</p>}
          <p className="flex justify-between">
            <span>Receipt</span>
            <span>RCP-000128</span>
          </p>
          {config.show_datetime && (
            <p className="flex justify-between">
              <span>Date</span>
              <span>13/10/2026 14:32</span>
            </p>
          )}
          {config.show_cashier && (
            <p className="flex justify-between">
              <span>Served by</span>
              <span>Ade Balogun</span>
            </p>
          )}
          {config.show_customer && (
            <p className="flex justify-between">
              <span>Customer</span>
              <span>Walk-in</span>
            </p>
          )}

          <Dashed />

          {SAMPLE_ITEMS.map((item) => (
            <div key={item.name} className="mb-1">
              <p className="truncate">{item.name}</p>
              <p className="flex justify-between text-[10px]">
                <span>
                  {item.qty} × {formatCurrency(item.price, preview.currency)}
                </span>
                <span>{formatCurrency(item.price * item.qty, preview.currency)}</span>
              </p>
            </div>
          ))}

          <Dashed />

          <p className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatCurrency(preview.subtotal, preview.currency)}</span>
          </p>
          {preview.discount > 0 && (
            <p className="flex justify-between">
              <span>Discount</span>
              <span>-{formatCurrency(preview.discount, preview.currency)}</span>
            </p>
          )}
          {config.show_tax_breakdown && preview.tax > 0 && (
            <p className="flex justify-between">
              <span>VAT 7.5%</span>
              <span>{formatCurrency(preview.tax, preview.currency)}</span>
            </p>
          )}
          <p className="mt-1 flex justify-between border-t border-neutral-300 pt-1 text-[12px] font-bold">
            <span>TOTAL</span>
            <span>{formatCurrency(preview.total, preview.currency)}</span>
          </p>

          {config.show_qr && (
            <div className="mt-2 flex justify-center">
              <span className="grid h-10 w-10 place-items-center bg-neutral-900 text-[8px] text-white">
                QR
              </span>
            </div>
          )}

          {config.footer && (
            <>
              <Dashed />
              <p className="text-center text-[10px]">{config.footer}</p>
            </>
          )}
          <p className="mt-1 text-center text-[9px] text-neutral-500">Powered by SalesMgt</p>
        </div>
      </div>

      <p className="mt-2 text-center text-[10px] text-muted-foreground">
        Sample data · {PAPER_LABEL[config.paper_width]}
      </p>
    </div>
  )
}

function Dashed() {
  return <div className="my-2 border-t border-dashed border-neutral-400" />
}

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface-elevated p-4">
      <div className="mb-4 flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

function Field({
  label,
  icon: Icon,
  value,
  placeholder,
  onChange,
  className,
}: {
  label: string
  icon: LucideIcon
  value: string
  placeholder?: string
  onChange: (value: string) => void
  className?: string
}) {
  const id = `receipt-${label.toLowerCase().replace(/\s+/g, '-')}`
  return (
    <div className={cn('grid gap-2', className)}>
      <Label htmlFor={id} className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        {label}
      </Label>
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <Label className="leading-tight">{label}</Label>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}
