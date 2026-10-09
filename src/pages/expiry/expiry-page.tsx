import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { inventoryApi } from '@/lib/api/endpoints/inventory'
import { reportsApi } from '@/lib/api/endpoints/reports'
import { useAppStore } from '@/stores/app'
import { PageHeader } from '@/components/common/page-header'
import { Pagination } from '@/components/common/pagination'
import { LoadingState } from '@/components/common/loading-state'
import { ErrorState } from '@/components/common/error-state'
import { EmptyState } from '@/components/common/empty-state'
import { StatusBadge } from '@/components/common/status-badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate, formatNumber } from '@/lib/utils'

interface ExpiredStockRow {
  id: number
  product_name: string
  variant_name?: string | null
  sku: string
  branch_name: string
  quantity: number
  expires_at: string
  status: string
}

function renderCell(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'number') return formatNumber(value)
  return String(value)
}

export function ExpiryPage() {
  const branchId = useAppStore((s) => s.context?.branch?.id)

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Expiry"
        description="Stock flagged for expiration or already expired — computed by the backend."
      />

      <Tabs defaultValue="expired">
        <TabsList>
          <TabsTrigger value="expired">Expired</TabsTrigger>
          <TabsTrigger value="expiring">Expiring</TabsTrigger>
        </TabsList>

        <TabsContent value="expired">
          <ExpiredTab branchId={branchId} />
        </TabsContent>

        <TabsContent value="expiring">
          <ExpiringTab branchId={branchId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ExpiredTab({ branchId }: { branchId?: number }) {
  const [page, setPage] = useState(1)

  const { data, isFetching, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['expiry', 'expired', { page, branchId }],
    queryFn: () => inventoryApi.expired({ page, per_page: 12, branch_id: branchId }),
    placeholderData: (prev) => prev,
  })

  const rows = (data?.data ?? []) as unknown as ExpiredStockRow[]
  const meta = data?.meta

  if (isLoading) return <LoadingState variant="table" rows={8} />
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />

  if (rows.length === 0) {
    return (
      <EmptyState
        title="No expired stock"
        description="Nothing has been flagged as expired. The backend computes expiry from recorded batches."
      />
    )
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead>Variant</TableHead>
            <TableHead>Branch</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{row.product_name}</p>
                  <p className="truncate font-mono text-[11px] text-muted-foreground">{row.sku}</p>
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {row.variant_name ?? '—'}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{row.branch_name}</TableCell>
              <TableCell className="text-sm font-semibold tabular-nums text-foreground">
                {formatNumber(row.quantity)}
              </TableCell>
              <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                {formatDate(row.expires_at, { year: 'numeric', month: 'short', day: 'numeric' })}
              </TableCell>
              <TableCell>
                <StatusBadge status={row.status} />
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
  )
}

function ExpiringTab({ branchId }: { branchId?: number }) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['expiry', 'expiring', branchId],
    queryFn: () => reportsApi.get({ report_type: 'expiring', branch_id: branchId }),
    placeholderData: (prev) => prev,
  })

  if (isLoading) return <LoadingState variant="table" rows={8} />
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />

  const dataset = data?.data
  if (!dataset) {
    return <EmptyState title="No expiring stock" description="The backend returned no dataset." />
  }

  const rows = dataset.rows as unknown as Array<Record<string, string | number>>
  const columns = dataset.columns
  const from = dataset.period?.from
  const to = dataset.period?.to
  const periodLabel =
    from || to ? `${from ? formatDate(from) : '—'} – ${to ? formatDate(to) : '—'}` : undefined

  return (
    <Card>
      <CardHeader>
        <CardTitle>{dataset.title}</CardTitle>
        {periodLabel && <CardDescription>{periodLabel}</CardDescription>}
        {Object.keys(dataset.summary).length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-2">
            {Object.entries(dataset.summary).map(([key, value]) => (
              <Badge key={key} variant="outline">
                {key}: {value}
              </Badge>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <EmptyState
            title="No expiring stock"
            description="No batches are approaching expiry in the selected scope."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((column) => (
                  <TableHead key={column}>{column}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={index}>
                  {columns.map((column) => (
                    <TableCell key={column} className="text-sm text-foreground">
                      {renderCell(row[column])}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
