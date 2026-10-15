import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Banknote,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileText,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Undo2,
} from 'lucide-react'
import {
  billingApi,
  type InvoiceStatus,
  type InvoiceSummary,
  type SubscriptionInvoice,
} from '@/lib/api/endpoints/billing'
import { businessApi, subscriptionApi } from '@/lib/api/endpoints/business'
import { PageHeader } from '@/components/common/page-header'
import { LoadingState } from '@/components/common/loading-state'
import { ErrorState } from '@/components/common/error-state'
import { EmptyState } from '@/components/common/empty-state'
import { Pagination } from '@/components/common/pagination'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from '@/components/ui/sonner'
import { useAuthStore } from '@/stores/auth'
import { ApiError } from '@/lib/api/errors'
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils'

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  unpaid: 'Not Paid',
  paid: 'Paid',
  void: 'Void',
}

const STATUS_VARIANTS: Record<InvoiceStatus, 'success' | 'warning' | 'muted'> = {
  paid: 'success',
  unpaid: 'warning',
  void: 'muted',
}

export function InvoicesPage() {
  const isSuperAdmin = useAuthStore((s) => s.session?.user.roles.includes('Super Admin') ?? false)

  const [status, setStatus] = useState('all')
  const [businessId, setBusinessId] = useState('all')
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [generating, setGenerating] = useState(false)
  const [paying, setPaying] = useState<SubscriptionInvoice | null>(null)

  const queryClient = useQueryClient()

  const businesses = useQuery({
    queryKey: ['businesses'],
    queryFn: () => businessApi.listBusinesses(),
    enabled: isSuperAdmin,
    placeholderData: (prev) => prev,
  })

  const list = useQuery({
    queryKey: ['invoices', { status, businessId, search, from, to, page }],
    queryFn: () =>
      billingApi.invoices({
        page,
        per_page: 15,
        status: status === 'all' ? undefined : (status as InvoiceStatus | 'overdue'),
        business_id: businessId === 'all' ? undefined : Number(businessId),
        search: search.trim() || undefined,
        from: from || undefined,
        to: to || undefined,
      }),
    enabled: isSuperAdmin,
    placeholderData: (prev) => prev,
  })

  const summary: InvoiceSummary | undefined = list.data?.meta.summary
  const rows = useMemo(() => list.data?.data ?? [], [list.data])
  const businessOptions = useMemo(() => businesses.data?.data ?? [], [businesses.data])

  const markUnpaid = useMutation({
    mutationFn: (id: number) => billingApi.markUnpaid(id),
    onSuccess: () => {
      toast.success('Invoice returned to Not Paid')
      void queryClient.invalidateQueries({ queryKey: ['invoices'] })
    },
    onError: (err) =>
      toast.error('Could not update invoice', {
        description: err instanceof ApiError ? err.message : undefined,
      }),
  })

  if (!isSuperAdmin) {
    return (
      <div className="animate-fade-in space-y-4 pb-8">
        <PageHeader eyebrow="Platform · Billing" title="Subscription Invoices" />
        <EmptyState
          title="Super Admin only"
          description="Only platform administrators can manage subscription invoices."
          icon={<ShieldAlert className="h-6 w-6" />}
        />
      </div>
    )
  }

  return (
    <div className="animate-fade-in space-y-4 pb-8">
      <PageHeader
        eyebrow="Platform · Billing"
        title="Subscription Invoices"
        description="Generate monthly invoices, review payments and settle outstanding balances."
      >
        <Button size="sm" variant="outline" loading={list.isFetching} onClick={() => list.refetch()}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
        <Button size="sm" onClick={() => setGenerating(true)}>
          <Plus className="h-4 w-4" />
          Generate
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={<FileText className="h-4 w-4" />}
          label="Invoices"
          value={formatNumber(summary?.total ?? 0)}
        />
        <StatCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Paid"
          value={formatNumber(summary?.paid ?? 0)}
          tone="text-success"
        />
        <StatCard
          icon={<Clock3 className="h-4 w-4" />}
          label="Not Paid"
          value={formatNumber(summary?.unpaid ?? 0)}
          tone="text-warning"
        />
        <StatCard
          icon={<CircleDollarSign className="h-4 w-4" />}
          label="Collected"
          value={formatCurrency(summary?.collected ?? 0)}
          tone="text-primary"
        />
        <StatCard
          icon={<ShieldAlert className="h-4 w-4" />}
          label="Overdue"
          value={formatNumber(summary?.overdue ?? 0)}
          tone="text-destructive"
        />
        <StatCard
          icon={<Banknote className="h-4 w-4" />}
          label="Outstanding"
          value={formatCurrency(summary?.outstanding ?? 0)}
        />
        <StatCard
          icon={<Undo2 className="h-4 w-4" />}
          label="Void"
          value={formatNumber(summary?.void ?? 0)}
        />
        <StatCard
          icon={<Clock3 className="h-4 w-4" />}
          label="This page"
          value={formatNumber(rows.length)}
        />
      </div>

      <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="grid gap-2">
          <Label htmlFor="inv-search">Search</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="inv-search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Invoice # or business"
              className="pl-9"
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label>Business</Label>
          <Select
            value={businessId}
            onValueChange={(v) => {
              setBusinessId(v)
              setPage(1)
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All businesses</SelectItem>
              {businessOptions.map((business) => (
                <SelectItem key={business.id} value={String(business.id)}>
                  {business.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Status</Label>
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v)
              setPage(1)
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="unpaid">Not Paid</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="void">Void</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="inv-from">From</Label>
          <Input
            id="inv-from"
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value)
              setPage(1)
            }}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="inv-to">To</Label>
          <Input
            id="inv-to"
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value)
              setPage(1)
            }}
          />
        </div>
      </div>

      {list.isLoading && <LoadingState rows={4} />}
      {list.isError && <ErrorState error={list.error} onRetry={() => list.refetch()} />}

      {!list.isLoading && !list.isError && rows.length === 0 && (
        <EmptyState
          title="No invoices found"
          description="Adjust the filters or generate invoices for the current period."
          icon={<FileText className="h-6 w-6" />}
        />
      )}

      {rows.length > 0 && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Business</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Due</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-mono text-xs">{invoice.number}</TableCell>
                  <TableCell className="font-medium">{invoice.business_name ?? '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {invoice.period_start
                      ? formatDate(invoice.period_start, { dateStyle: 'medium' })
                      : '—'}
                  </TableCell>
                  <TableCell className="text-xs">
                    <span className={rowDueClass(invoice)}>
                      {invoice.due_at ? formatDate(invoice.due_at, { dateStyle: 'medium' }) : '—'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(invoice.amount, invoice.currency)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Badge variant={STATUS_VARIANTS[invoice.status]}>
                        {STATUS_LABELS[invoice.status]}
                      </Badge>
                      {invoice.is_overdue && invoice.status === 'unpaid' && (
                        <Badge variant="destructive" className="text-[10px]">
                          Overdue
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1.5">
                      {invoice.status === 'paid' ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          loading={markUnpaid.isPending && markUnpaid.variables === invoice.id}
                          onClick={() => markUnpaid.mutate(invoice.id)}
                        >
                          <Undo2 className="h-3.5 w-3.5" />
                          Mark unpaid
                        </Button>
                      ) : (
                        <Button variant="secondary" size="sm" onClick={() => setPaying(invoice)}>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Mark paid
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Pagination
            page={list.data?.meta.current_page ?? 1}
            lastPage={list.data?.meta.last_page ?? 1}
            total={list.data?.meta.total}
            totalLabel="invoices"
            isFetching={list.isFetching}
            onPageChange={setPage}
          />
        </>
      )}

      {generating && (
        <GenerateDialog
          businesses={businessOptions}
          onClose={() => setGenerating(false)}
          onGenerated={() => {
            void queryClient.invalidateQueries({ queryKey: ['invoices'] })
          }}
        />
      )}

      {paying && (
        <MarkPaidDialog invoice={paying} onClose={() => setPaying(null)} />
      )}
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: string
  tone?: string
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className={tone ?? 'text-muted-foreground'}>{icon}</span>
      </div>
      <p className="mt-1.5 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function rowDueClass(invoice: SubscriptionInvoice): string {
  return invoice.is_overdue && invoice.status === 'unpaid' ? 'text-destructive' : 'text-muted-foreground'
}

function MarkPaidDialog({
  invoice,
  onClose,
}: {
  invoice: SubscriptionInvoice
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')

  const markPaid = useMutation({
    mutationFn: () =>
      billingApi.markPaid(invoice.id, {
        payment_reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success('Invoice marked as paid')
      onClose()
      void queryClient.invalidateQueries({ queryKey: ['invoices'] })
    },
    onError: (err) =>
      toast.error('Could not mark invoice paid', {
        description: err instanceof ApiError ? err.message : undefined,
      }),
  })

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark {invoice.number} as paid</DialogTitle>
          <DialogDescription>
            Confirming payment reactivates the business and extends the subscription by one billing cycle.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="flex items-center justify-between rounded-xl border border-border/70 p-3">
            <span className="text-sm text-muted-foreground">Amount</span>
            <span className="text-sm font-semibold">
              {formatCurrency(invoice.amount, invoice.currency)}
            </span>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pay-ref">Payment reference</Label>
            <Input
              id="pay-ref"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Bank transfer / gateway reference"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pay-notes">Notes</Label>
            <Input
              id="pay-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional note"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" loading={markPaid.isPending} onClick={() => markPaid.mutate()}>
            Confirm payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function GenerateDialog({
  businesses,
  onClose,
  onGenerated,
}: {
  businesses: { id: number; name: string }[]
  onClose: () => void
  onGenerated: () => void
}) {
  const [period, setPeriod] = useState('')
  const [businessId, setBusinessId] = useState('all')
  const [planId, setPlanId] = useState('none')

  const plans = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: () => subscriptionApi.plans(),
  })

  const planOptions = plans.data?.data ?? []
  const selectedPlan = planOptions.find((plan) => String(plan.id) === planId)

  const generate = useMutation({
    mutationFn: () =>
      billingApi.generate({
        period: period || undefined,
        business_id: businessId === 'all' ? undefined : Number(businessId),
        plan_id: planId === 'none' ? undefined : Number(planId),
      }),
    onSuccess: (res) => {
      toast.success(res.message ?? 'Invoices generated', {
        description: `${res.data.generated} new invoice(s).`,
      })
      onGenerated()
      onClose()
    },
    onError: (err) =>
      toast.error('Could not generate invoices', {
        description: err instanceof ApiError ? err.message : undefined,
      }),
  })

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate subscription invoices</DialogTitle>
          <DialogDescription>
            Creates one invoice per business for the selected period. Existing invoices are skipped.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Business</Label>
            <Select value={businessId} onValueChange={setBusinessId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All businesses</SelectItem>
                {businesses.map((business) => (
                  <SelectItem key={business.id} value={String(business.id)}>
                    {business.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Plan</Label>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Use the business&apos;s own plan</SelectItem>
                {planOptions.map((plan) => (
                  <SelectItem key={plan.id} value={String(plan.id)}>
                    {plan.name}
                    {plan.monthly_price != null
                      ? ` · ${formatCurrency(plan.monthly_price, plan.currency)}`
                      : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {selectedPlan?.monthly_price != null
                ? `Invoice amount will be ${formatCurrency(selectedPlan.monthly_price, selectedPlan.currency)}.`
                : 'The invoice amount is taken from the selected plan.'}
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="gen-period">Period (optional)</Label>
            <Input
              id="gen-period"
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Defaults to the current month.</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" loading={generate.isPending} onClick={() => generate.mutate()}>
            Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
