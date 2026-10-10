import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowUpDown, SlidersHorizontal } from 'lucide-react'
import { PageHeader } from '@/components/common/page-header'
import { SearchInput } from '@/components/common/search-input'
import { Pagination } from '@/components/common/pagination'
import { LoadingState } from '@/components/common/loading-state'
import { ErrorState } from '@/components/common/error-state'
import { EmptyState } from '@/components/common/empty-state'
import { StatusBadge } from '@/components/common/status-badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from '@/components/ui/sonner'
import { ApiError } from '@/lib/api/errors'
import { formatCurrency, formatDateTime, formatNumber } from '@/lib/utils'
import { useAppStore } from '@/stores/app'
import { inventoryApi, type StockLevel, type StockMovement } from '@/lib/api/endpoints/inventory'
import { productsApi, type Product } from '@/lib/api/endpoints/products'

const MOVEMENT_LABELS: Record<string, string> = {
  in: 'Stock in',
  out: 'Stock out',
  adjustment: 'Adjustment',
  transfer_in: 'Transfer in',
  transfer_out: 'Transfer out',
  damage: 'Damage',
  expired: 'Expired',
}

const STATUS_LABELS: Record<string, string> = {
  all: 'All',
  in_stock: 'In stock',
  low: 'Low',
  out_of_stock: 'Out of stock',
}

const MOVEMENT_TYPES = ['in', 'out', 'adjustment', 'transfer_in', 'transfer_out', 'damage', 'expired'] as const

function AdjustDialog({
  open,
  onClose,
  branchId,
}: {
  open: boolean
  onClose: () => void
  branchId: number | undefined
}) {
  const queryClient = useQueryClient()
  const branches = useAppStore((s) => s.branches)
  const [productId, setProductId] = useState<string>('')
  const [branchIdState, setBranchIdState] = useState<string>(branchId ? String(branchId) : '')
  const [quantity, setQuantity] = useState<string>('')
  const [reason, setReason] = useState<string>('')

  const { data: productsData } = useQuery({
    queryKey: ['products', { per_page: 50 }],
    queryFn: () => productsApi.list({ per_page: 50 }),
    placeholderData: (prev) => prev,
    enabled: open,
  })

  const products = (productsData?.data as Product[] | undefined) ?? []

  const { data: stockData } = useQuery({
    queryKey: ['inventory', 'product-stock', productId, branchIdState],
    queryFn: () =>
      inventoryApi.levels({
        product_id: Number(productId),
        branch_id: branchIdState ? Number(branchIdState) : undefined,
        per_page: 100,
      }),
    enabled: open && !!productId && !!branchIdState,
  })

  const currentStock = ((stockData?.data as StockLevel[] | undefined) ?? []).reduce(
    (sum, row) => sum + row.quantity,
    0,
  )

  const mutate = useMutation({
    mutationFn: (input: { product_id: number; branch_id: number; quantity: number; reason?: string }) =>
      inventoryApi.adjust({
        product_id: input.product_id,
        branch_id: input.branch_id,
        quantity: input.quantity,
        reason: input.reason,
      }),
    onSuccess: () => {
      toast.success('Stock adjusted')
      void queryClient.invalidateQueries({ queryKey: ['inventory'] })
      onClose()
      setProductId('')
      setQuantity('')
      setReason('')
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Could not adjust stock')
    },
  })

  const handleSubmit = () => {
    if (!productId || !branchIdState || !quantity) return
    mutate.mutate({
      product_id: Number(productId),
      branch_id: Number(branchIdState),
      quantity: Number(quantity),
      reason: reason || undefined,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adjust stock</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="product">Product</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger id="product">
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
            <Label htmlFor="branch">Branch</Label>
            <Select value={branchIdState} onValueChange={setBranchIdState}>
              <SelectTrigger id="branch">
                <SelectValue placeholder="Select branch" />
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
          {productId && branchIdState && (
            <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Current stock</span>
              <span className="font-semibold tabular-nums">
                {stockData ? formatNumber(currentStock) : '…'}
              </span>
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="quantity">Quantity (negative for out)</Label>
            <Input
              id="quantity"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="e.g. 10 or -5"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="reason">Reason</Label>
            <Input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Stock count adjustment"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutate.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={mutate.isPending} disabled={mutate.isPending}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function InventoryPage() {
  const branchId = useAppStore((s) => s.context?.branch?.id)
  const [search, setSearch] = useState('')
  const [levelsPage, setLevelsPage] = useState(1)
  const [movementsPage, setMovementsPage] = useState(1)
  const [levelStatus, setLevelStatus] = useState<string>('all')
  const [movementType, setMovementType] = useState<string>('all')
  const [adjustOpen, setAdjustOpen] = useState(false)

  const { data: dashboardData, isLoading: dashboardLoading, isError: dashboardError, error: dashboardErr, refetch: refetchDashboard } = useQuery({
    queryKey: ['inventory', 'dashboard', branchId],
    queryFn: () => inventoryApi.dashboard({ branch_id: branchId }),
    placeholderData: (prev) => prev,
  })

  const { data: levelsData, isFetching: levelsFetching, isLoading: levelsLoading, isError: levelsError, error: levelsErr, refetch: refetchLevels } = useQuery({
    queryKey: ['inventory', 'levels', { page: levelsPage, search, branchId, status: levelStatus }],
    queryFn: () =>
      inventoryApi.levels({
        page: levelsPage,
        per_page: 12,
        search: search || undefined,
        branch_id: branchId,
        status: levelStatus === 'all' ? undefined : levelStatus,
      }),
    placeholderData: (prev) => prev,
  })

  const { data: movementsData, isFetching: movementsFetching, isLoading: movementsLoading, isError: movementsError, error: movementsErr, refetch: refetchMovements } = useQuery({
    queryKey: ['inventory', 'movements', { page: movementsPage, branchId, type: movementType }],
    queryFn: () =>
      inventoryApi.movements({
        page: movementsPage,
        per_page: 12,
        branch_id: branchId,
        type: movementType === 'all' ? undefined : movementType,
      }),
    placeholderData: (prev) => prev,
  })

  const dashboard = dashboardData?.data
  const levelsRows = (levelsData?.data as StockLevel[] | undefined) ?? []
  const movementsRows = (movementsData?.data as StockMovement[] | undefined) ?? []

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Inventory"
        description="Track stock levels, movements and quality across all branches."
      >
        <Button size="sm" onClick={() => setAdjustOpen(true)}>
          <ArrowUpDown className="h-4 w-4" />
          Adjust stock
        </Button>
      </PageHeader>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="levels">Levels</TabsTrigger>
          <TabsTrigger value="movements">Movements</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          {dashboardLoading && <LoadingState variant="cards" rows={6} />}
          {dashboardError && <ErrorState error={dashboardErr} onRetry={() => refetchDashboard()} />}
          {dashboard && !dashboardLoading && !dashboardError && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">SKUs</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">{formatNumber(dashboard.total_sku)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Units</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">{formatNumber(dashboard.total_units)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Stock value</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">{formatCurrency(dashboard.inventory_value)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Low stock</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">{formatNumber(dashboard.low_stock_count)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Out of stock</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">{formatNumber(dashboard.out_of_stock_count)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Damaged</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">{formatNumber(dashboard.damaged_count)}</p>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="levels" className="mt-4">
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              placeholder="Search product, SKU, variant..."
              className="mb-4"
              onSearch={(value) => {
                setLevelsPage(1)
                setSearch(value)
              }}
            />
            <div className="mb-4 flex items-center gap-2">
              <Select
                value={levelStatus}
                onValueChange={(v) => {
                  setLevelsPage(1)
                  setLevelStatus(v)
                }}
              >
                <SelectTrigger className="h-9 w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => setAdjustOpen(true)}>
                <SlidersHorizontal className="h-4 w-4" />
                Adjust stock
              </Button>
            </div>
          </div>

          {levelsLoading && <LoadingState variant="table" rows={8} />}
          {levelsError && <ErrorState error={levelsErr} onRetry={() => refetchLevels()} />}
          {!levelsLoading && !levelsError && levelsRows.length === 0 && (
            <EmptyState title="No stock levels found" description="Try adjusting your search or filters." />
          )}
          {!levelsLoading && !levelsError && levelsRows.length > 0 && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Variant</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Threshold</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {levelsRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{row.product_name}</p>
                          <p className="truncate font-mono text-xs text-muted-foreground">{row.sku}</p>
                        </div>
                      </TableCell>
                      <TableCell>{row.variant_name || '—'}</TableCell>
                      <TableCell>{row.branch_name}</TableCell>
                      <TableCell className="font-semibold tabular-nums">{formatNumber(row.quantity)}</TableCell>
                      <TableCell>{row.low_stock_threshold != null ? formatNumber(row.low_stock_threshold) : '—'}</TableCell>
                      <TableCell>
                        <StatusBadge status={row.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {levelsData?.meta && levelsData.meta.last_page > 1 && (
                <Pagination
                  page={levelsPage}
                  lastPage={levelsData.meta.last_page}
                  total={levelsData.meta.total}
                  totalLabel="levels"
                  isFetching={levelsFetching}
                  onPageChange={(p) => setLevelsPage(p)}
                />
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="movements" className="mt-4">
          <div className="mb-4 flex items-center gap-2">
            <Select
              value={movementType}
              onValueChange={(v) => {
                setMovementsPage(1)
                setMovementType(v)
              }}
            >
              <SelectTrigger className="h-9 w-[200px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {MOVEMENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {MOVEMENT_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {movementsLoading && <LoadingState variant="table" rows={8} />}
          {movementsError && <ErrorState error={movementsErr} onRetry={() => refetchMovements()} />}
          {!movementsLoading && !movementsError && movementsRows.length === 0 && (
            <EmptyState title="No movements found" description="No stock movements for selected filters." />
          )}
          {!movementsLoading && !movementsError && movementsRows.length > 0 && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Staff</TableHead>
                    <TableHead>When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movementsRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <StatusBadge status={row.type} label={MOVEMENT_LABELS[row.type]} />
                      </TableCell>
                      <TableCell>
                        <div className="min-w-0">
                          <p className="truncate text-sm">{row.product_name}</p>
                          {row.variant_name && <p className="truncate text-xs text-muted-foreground">{row.variant_name}</p>}
                        </div>
                      </TableCell>
                      <TableCell
                        className={`font-semibold tabular-nums ${
                          row.quantity < 0 ? 'text-destructive' : 'text-success'
                        }`}
                      >
                        {row.quantity > 0 ? `+${formatNumber(row.quantity)}` : formatNumber(row.quantity)}
                      </TableCell>
                      <TableCell>{row.reason || '—'}</TableCell>
                      <TableCell>{row.reference || '—'}</TableCell>
                      <TableCell className="text-sm">{row.staff_name || '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDateTime(row.happened_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {movementsData?.meta && movementsData.meta.last_page > 1 && (
                <Pagination
                  page={movementsPage}
                  lastPage={movementsData.meta.last_page}
                  total={movementsData.meta.total}
                  totalLabel="movements"
                  isFetching={movementsFetching}
                  onPageChange={(p) => setMovementsPage(p)}
                />
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      <AdjustDialog open={adjustOpen} onClose={() => setAdjustOpen(false)} branchId={branchId} />
    </div>
  )
}