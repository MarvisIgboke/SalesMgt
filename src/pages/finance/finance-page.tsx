import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, HandCoins, Landmark, ReceiptText, X } from 'lucide-react'
import { financeApi } from '@/lib/api/endpoints/finance'
import { PageHeader } from '@/components/common/page-header'
import { Pagination } from '@/components/common/pagination'
import { LoadingState } from '@/components/common/loading-state'
import { ErrorState } from '@/components/common/error-state'
import { EmptyState } from '@/components/common/empty-state'
import { StatusBadge } from '@/components/common/status-badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { toast } from '@/components/ui/sonner'
import { ApiError } from '@/lib/api/errors'

interface ReconciliationRow {
  id: number
  date: string
  reference?: string
  description?: string
  amount: number
  status: string
}

export function FinancePage() {
  const [status, setStatus] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [reconPage, setReconPage] = useState(1)

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Finance"
        description="Payment confirmation, approvals and reconciliation. Decision endpoints respect backend permissions."
      />

      <Tabs defaultValue="approvals">
        <TabsList>
          <TabsTrigger value="approvals">Approvals</TabsTrigger>
          <TabsTrigger value="receivables">Receivables & payables</TabsTrigger>
          <TabsTrigger value="reconciliation">Reconciliation</TabsTrigger>
        </TabsList>

        <TabsContent value="approvals" className="space-y-4">
          <ApprovalsTab status={status} setStatus={setStatus} page={page} setPage={setPage} />
        </TabsContent>

        <TabsContent value="receivables">
          <ReceivablesPayablesTab />
        </TabsContent>

        <TabsContent value="reconciliation" className="space-y-4">
          <ReconciliationTab page={reconPage} setPage={setReconPage} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ApprovalsTab({
  status,
  setStatus,
  page,
  setPage,
}: {
  status: string
  setStatus: (value: string) => void
  page: number
  setPage: (page: number) => void
}) {
  const queryClient = useQueryClient()

  const { data, isFetching, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['finance', 'approvals', { page, status }],
    queryFn: () =>
      financeApi.approvalsQueue({ page, per_page: 12, status: status === 'all' ? undefined : status }),
    placeholderData: (prev) => prev,
  })

  const rows = data?.data ?? []
  const meta = data?.meta

  const decide = useMutation({
    mutationFn: ({ id, decision, notes }: { id: number; decision: 'approved' | 'rejected'; notes?: string }) =>
      financeApi.approve(id, decision, notes),
    onSuccess: () => {
      toast.success('Decision recorded')
      void queryClient.invalidateQueries({ queryKey: ['finance'] })
    },
    onError: (err) => {
      toast.error('Could not record decision', {
        description: err instanceof ApiError ? err.message : undefined,
      })
    },
  })

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {meta ? `${meta.total} items` : 'Approval queue'}
        </p>
        <div className="w-44">
          <Select
            value={status}
            onValueChange={(value) => {
              setPage(1)
              setStatus(value)
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="awaiting_approval">Awaiting approval</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading && <LoadingState variant="table" rows={8} />}
      {isError && <ErrorState error={error} onRetry={() => refetch()} />}

      {!isLoading && !isError && rows.length === 0 && (
        <EmptyState
          title="Queue is clear"
          description="No items match the current filter."
          icon={<ReceiptText className="h-6 w-6" />}
        />
      )}

      {!isLoading && !isError && rows.length > 0 && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sale</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Match</TableHead>
                <TableHead>Branch / Rep</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs text-foreground">
                    {item.sale_reference}
                  </TableCell>
                  <TableCell className="max-w-[12rem] truncate text-sm text-muted-foreground">
                    {item.customer_name ?? 'Walk-in'}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium tabular-nums text-foreground">
                    {formatCurrency(item.amount)}
                    {item.bank_reference && (
                      <span className="mt-0.5 block max-w-[8rem] truncate font-mono text-[10px] text-muted-foreground">
                        {item.bank_reference}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm capitalize text-muted-foreground">
                    {item.payment_method.replace(/_/g, ' ')}
                  </TableCell>
                  <TableCell>
                    {item.match_result ? (
                      <StatusBadge status={item.match_result.status} label={item.match_result.status} />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {item.branch_name}
                    <span className="block text-[11px] text-muted-foreground/60">{item.sales_rep}</span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={item.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="outline"
                        size="icon-sm"
                        title="Approve"
                        disabled={decide.isPending}
                        onClick={() => decide.mutate({ id: item.id, decision: 'approved' })}
                      >
                        <Check className="h-4 w-4 text-success" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon-sm"
                        title="Reject"
                        disabled={decide.isPending}
                        onClick={() => decide.mutate({ id: item.id, decision: 'rejected' })}
                      >
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Pagination
            page={meta?.current_page ?? page}
            lastPage={meta?.last_page ?? 1}
            total={meta?.total}
            totalLabel="items"
            isFetching={isFetching}
            onPageChange={setPage}
          />
        </>
      )}
    </>
  )
}

function ReceivablesPayablesTab() {
  const receivables = useQuery({
    queryKey: ['finance', 'receivables'],
    queryFn: () => financeApi.receivables(),
    placeholderData: (prev) => prev,
  })

  const payables = useQuery({
    queryKey: ['finance', 'payables'],
    queryFn: () => financeApi.payables(),
    placeholderData: (prev) => prev,
  })

  if (receivables.isError || payables.isError) {
    return (
      <ErrorState
        error={receivables.error ?? payables.error}
        onRetry={() => {
          void receivables.refetch()
          void payables.refetch()
        }}
      />
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <HandCoins className="h-4 w-4 text-warning" />
            Receivables
          </CardTitle>
          <CardDescription>Customer credit owed to the business.</CardDescription>
        </CardHeader>
        <CardContent>
          <SummaryFigure
            loading={receivables.isLoading}
            data={receivables.data?.data}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <Landmark className="h-4 w-4 text-info" />
            Payables
          </CardTitle>
          <CardDescription>Money owed to suppliers.</CardDescription>
        </CardHeader>
        <CardContent>
          <SummaryFigure
            loading={payables.isLoading}
            data={payables.data?.data}
          />
        </CardContent>
      </Card>
    </div>
  )
}

function SummaryFigure({
  loading,
  data,
}: {
  loading: boolean
  data?: { total: number; outstanding: number; overdue: number }
}) {
  if (loading) return <LoadingState rows={2} />
  if (!data)
    return (
      <p className="rounded-xl border border-dashed border-border/70 py-8 text-center text-sm text-muted-foreground">
        No data reported.
      </p>
    )

  const figures = [
    { label: 'Total', value: data.total },
    { label: 'Outstanding', value: data.outstanding },
    { label: 'Overdue', value: data.overdue, warn: data.overdue > 0 },
  ]

  return (
    <div className="grid grid-cols-3 gap-3">
      {figures.map((figure) => (
        <div key={figure.label} className="rounded-xl border border-border/70 p-4">
          <p className="text-[11px] text-muted-foreground">{figure.label}</p>
          <p
            className={
              'mt-1 text-lg font-bold tabular-nums ' +
              (figure.warn ? 'text-warning' : 'text-foreground')
            }
          >
            {formatCurrency(figure.value)}
          </p>
        </div>
      ))}
    </div>
  )
}

function ReconciliationTab({
  page,
  setPage,
}: {
  page: number
  setPage: (page: number) => void
}) {
  const { data, isFetching, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['finance', 'reconciliation', { page }],
    queryFn: () => financeApi.reconciliation({ page, per_page: 12 }),
    placeholderData: (prev) => prev,
  })

  const rows = (data?.data as unknown as ReconciliationRow[] | undefined) ?? []
  const meta = data?.meta

  return (
    <>
      {isLoading && <LoadingState variant="table" rows={8} />}
      {isError && <ErrorState error={error} onRetry={() => refetch()} />}

      {!isLoading && !isError && rows.length === 0 && (
        <EmptyState
          title="Nothing to reconcile"
          description="Reconciliation records will appear here."
          icon={<ReceiptText className="h-6 w-6" />}
        />
      )}

      {!isLoading && !isError && rows.length > 0 && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-xs text-foreground">
                    {row.reference ?? `#${row.id}`}
                  </TableCell>
                  <TableCell className="max-w-[18rem] truncate text-sm text-foreground">
                    {row.description ?? '—'}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium tabular-nums text-foreground">
                    {formatCurrency(row.amount)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={row.status} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {formatDateTime(row.date)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Pagination
            page={meta?.current_page ?? page}
            lastPage={meta?.last_page ?? 1}
            total={meta?.total}
            totalLabel="records"
            isFetching={isFetching}
            onPageChange={setPage}
          />
        </>
      )}
    </>
  )
}