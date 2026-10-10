import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { History, ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { PageHeader } from '@/components/common/page-header'
import { Pagination } from '@/components/common/pagination'
import { LoadingState } from '@/components/common/loading-state'
import { ErrorState } from '@/components/common/error-state'
import { EmptyState } from '@/components/common/empty-state'
import { StatusBadge } from '@/components/common/status-badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDateTime, formatNumber } from '@/lib/utils'
import { useAppStore } from '@/stores/app'
import { inventoryApi, type StockMovement } from '@/lib/api/endpoints/inventory'
import { productsApi, type Product } from '@/lib/api/endpoints/products'

const MOVEMENT_LABELS: Record<string, string> = {
  in: 'Stock added',
  out: 'Stock removed',
  adjustment: 'Adjustment',
  transfer_in: 'Transfer in',
  transfer_out: 'Transfer out',
  damage: 'Damage',
  expired: 'Expired',
}

export function StockTracePage() {
  const branches = useAppStore((s) => s.branches)
  const contextBranch = useAppStore((s) => s.context?.branch?.id)
  const [productId, setProductId] = useState<string>('')
  const [branchId, setBranchId] = useState<string>(contextBranch ? String(contextBranch) : '')
  const [page, setPage] = useState(1)

  const { data: productsData } = useQuery({
    queryKey: ['products', { per_page: 100 }],
    queryFn: () => productsApi.list({ per_page: 100 }),
    placeholderData: (prev) => prev,
  })
  const products = (productsData?.data as Product[] | undefined) ?? []

  const selectedProduct = products.find((p) => String(p.id) === productId)

  const {
    data: movementsData,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['inventory', 'trace', { productId, branchId, page }],
    queryFn: () =>
      inventoryApi.movements({
        page,
        per_page: 15,
        product_id: productId ? Number(productId) : undefined,
        branch_id: branchId ? Number(branchId) : undefined,
      }),
    enabled: !!productId,
    placeholderData: (prev) => prev,
  })

  const rows = (movementsData?.data as StockMovement[] | undefined) ?? []

  const totalIn = rows.filter((r) => r.quantity > 0).reduce((s, r) => s + r.quantity, 0)
  const totalOut = rows.filter((r) => r.quantity < 0).reduce((s, r) => s + Math.abs(r.quantity), 0)

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Product Stock Trace"
        description="Full audit trail of every addition and subtraction for a product, with staff and timestamps."
      >
        <History className="h-5 w-5 text-muted-foreground" />
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="grid gap-2">
          <Label htmlFor="trace-product">Product</Label>
          <Select
            value={productId}
            onValueChange={(v) => {
              setPage(1)
              setProductId(v)
            }}
          >
            <SelectTrigger id="trace-product" className="h-9 w-[280px]">
              <SelectValue placeholder="Select product" />
            </SelectTrigger>
            <SelectContent>
              {products.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.name} ({p.sku})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="trace-branch">Branch</Label>
          <Select
            value={branchId}
            onValueChange={(v) => {
              setPage(1)
              setBranchId(v)
            }}
          >
            <SelectTrigger id="trace-branch" className="h-9 w-[200px]">
              <SelectValue placeholder="All branches" />
            </SelectTrigger>
            <SelectContent>
              {branches.map((b) => (
                <SelectItem key={b.id} value={String(b.id)}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!productId && (
        <EmptyState
          title="Select a product"
          description="Choose a product above to view its complete stock trace."
        />
      )}

      {productId && (
        <>
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Product</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold">{selectedProduct?.name ?? '—'}</p>
                <p className="font-mono text-xs text-muted-foreground">{selectedProduct?.sku}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <ArrowDownRight className="h-3.5 w-3.5 text-success" /> Added (page)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold text-success">+{formatNumber(totalIn)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <ArrowUpRight className="h-3.5 w-3.5 text-destructive" /> Removed (page)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold text-destructive">-{formatNumber(totalOut)}</p>
              </CardContent>
            </Card>
          </div>

          {isLoading && <LoadingState variant="table" rows={8} />}
          {isError && <ErrorState error={error} onRetry={() => refetch()} />}
          {!isLoading && !isError && rows.length === 0 && (
            <EmptyState title="No stock activity" description="This product has no recorded movements yet." />
          )}
          {!isLoading && !isError && rows.length > 0 && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Activity</TableHead>
                    <TableHead>Variant</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Staff</TableHead>
                    <TableHead>Date &amp; time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <StatusBadge status={row.type} label={MOVEMENT_LABELS[row.type]} />
                      </TableCell>
                      <TableCell>{row.variant_name || '—'}</TableCell>
                      <TableCell
                        className={`font-semibold tabular-nums ${
                          row.quantity < 0 ? 'text-destructive' : 'text-success'
                        }`}
                      >
                        {row.quantity > 0 ? `+${formatNumber(row.quantity)}` : formatNumber(row.quantity)}
                      </TableCell>
                      <TableCell>{row.reason || '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{row.reference || '—'}</TableCell>
                      <TableCell className="text-sm">{row.staff_name || '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDateTime(row.happened_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {movementsData?.meta && movementsData.meta.last_page > 1 && (
                <Pagination
                  page={page}
                  lastPage={movementsData.meta.last_page}
                  total={movementsData.meta.total}
                  totalLabel="movements"
                  isFetching={isFetching}
                  onPageChange={(p) => setPage(p)}
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
