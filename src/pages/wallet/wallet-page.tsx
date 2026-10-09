import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowDownLeft, ArrowUpRight, Wallet } from 'lucide-react'
import { walletApi } from '@/lib/api/endpoints/business'
import { PageHeader } from '@/components/common/page-header'
import { Pagination } from '@/components/common/pagination'
import { LoadingState } from '@/components/common/loading-state'
import { ErrorState } from '@/components/common/error-state'
import { EmptyState } from '@/components/common/empty-state'
import { StatusBadge } from '@/components/common/status-badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDateTime } from '@/lib/utils'

interface WalletTransactionRow {
  id: number
  reference?: string
  description?: string
  amount: number
  balance_after?: number
  type: string
  method?: string
  created_at: string
}

export function WalletPage() {
  const [page, setPage] = useState(1)
  const [type, setType] = useState<string>('all')

  const summary = useQuery({
    queryKey: ['wallet'],
    queryFn: () => walletApi.get(),
    placeholderData: (prev) => prev,
  })

  const transactions = useQuery({
    queryKey: ['wallet', 'transactions', { page, type }],
    queryFn: () =>
      walletApi.transactions({ page, per_page: 12, type: type === 'all' ? undefined : type }),
    placeholderData: (prev) => prev,
  })

  const wallet = summary.data?.data
  const rows = (transactions.data?.data as unknown as WalletTransactionRow[] | undefined) ?? []
  const meta = transactions.data?.meta

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Wallet"
        description="Authoritative balance and transaction history from the backend."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <Wallet className="h-4 w-4" />
            </span>
            <div>
              <CardTitle className="text-sm font-medium text-muted-foreground">Balance</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {summary.isLoading ? (
              <p className="text-xl font-bold text-foreground">…</p>
            ) : (
              <p className="text-2xl font-bold tracking-tight text-foreground">
                {formatCurrency(wallet?.balance, wallet?.currency)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-warning/10 text-warning">
              <ArrowDownLeft className="h-4 w-4" />
            </span>
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tracking-tight text-foreground">
              {wallet?.pending != null ? formatCurrency(wallet.pending, wallet.currency) : '—'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-success/10 text-success">
              <ArrowUpRight className="h-4 w-4" />
            </span>
            <CardTitle className="text-sm font-medium text-muted-foreground">Currency</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tracking-tight text-foreground">
              {wallet?.currency ?? '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mb-4 flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {meta ? `${meta.total} transactions` : 'Transaction history'}
        </p>
        <div className="w-44">
          <Select
            value={type}
            onValueChange={(value) => {
              setPage(1)
              setType(value)
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="credit">Credits</SelectItem>
              <SelectItem value="debit">Debits</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {transactions.isLoading && <LoadingState variant="table" rows={8} />}
      {transactions.isError && (
        <ErrorState error={transactions.error} onRetry={() => transactions.refetch()} />
      )}

      {!transactions.isLoading && !transactions.isError && rows.length === 0 && (
        <EmptyState
          title="No transactions found"
          description="Try a different type filter."
          icon={<Wallet className="h-6 w-6" />}
        />
      )}

      {!transactions.isLoading && !transactions.isError && rows.length > 0 && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Balance after</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((tx) => {
                const credit = tx.type === 'credit'
                const pending = tx.type === 'pending'
                return (
                  <TableRow key={tx.id}>
                    <TableCell className="font-mono text-xs text-foreground">
                      {tx.reference ?? `#${tx.id}`}
                    </TableCell>
                    <TableCell className="max-w-[15rem] truncate text-sm text-foreground">
                      {tx.description ?? '—'}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={tx.type.toLowerCase()} />
                    </TableCell>
                    <TableCell
                      className={
                        'text-right text-sm font-semibold tabular-nums ' +
                        (pending
                          ? 'text-muted-foreground'
                          : credit
                            ? 'text-success'
                            : 'text-destructive')
                      }
                    >
                      {credit ? '+' : pending ? '' : '-'}
                      {formatCurrency(tx.amount)}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                      {tx.balance_after != null ? formatCurrency(tx.balance_after) : '—'}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {formatDateTime(tx.created_at)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>

          <Pagination
            page={meta?.current_page ?? page}
            lastPage={meta?.last_page ?? 1}
            total={meta?.total}
            totalLabel="transactions"
            isFetching={transactions.isFetching}
            onPageChange={setPage}
          />
        </>
      )}

      {summary.data && summary.data.message && (
        <div className="mt-6 flex justify-end">
          <Badge variant="outline" className="text-muted-foreground">
            {summary.data.message}
          </Badge>
        </div>
      )}
    </div>
  )
}