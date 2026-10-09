import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2,
  ClipboardPlus,
  MoreHorizontal,
  PackageCheck,
  PackagePlus,
  Plus,
  Trash2,
  XCircle,
} from 'lucide-react'
import {
  purchasingApi,
  type PurchaseOrder,
  type PurchaseOrderInput,
  type PurchaseRequisition,
} from '@/lib/api/endpoints/purchasing'
import { suppliersApi } from '@/lib/api/endpoints/suppliers'
import { productsApi } from '@/lib/api/endpoints/products'
import type { Branch } from '@/lib/api/endpoints/business'
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from '@/components/ui/sonner'
import { ApiError } from '@/lib/api/errors'
import { formatCurrency, formatDate, formatDateTime, formatNumber } from '@/lib/utils'

const STATUS_OPTIONS = ['all', 'draft', 'pending', 'approved', 'received', 'cancelled'] as const

type Option = { id: number; name: string }
type ProductOption = { id: number; name: string; sku: string }

interface OrderLine {
  key: number
  productId: string
  quantity: string
  unitCost: string
}

export function PurchasingPage() {
  const queryClient = useQueryClient()
  const branchId = useAppStore((s) => s.context?.branch?.id)
  const branches = useAppStore((s) => s.branches)
  const [tab, setTab] = useState('orders')
  const [ordersPage, setOrdersPage] = useState(1)
  const [ordersStatus, setOrdersStatus] = useState('all')
  const [requisitionsPage, setRequisitionsPage] = useState(1)
  const [requisitionsStatus, setRequisitionsStatus] = useState('all')
  const [orderDialogOpen, setOrderDialogOpen] = useState(false)
  const [requisitionDialogOpen, setRequisitionDialogOpen] = useState(false)

  const productsQuery = useQuery({
    queryKey: ['products', 'options'],
    queryFn: () => productsApi.list({ per_page: 50 }),
    staleTime: 60_000,
  })

  const suppliersQuery = useQuery({
    queryKey: ['suppliers', 'options'],
    queryFn: () => suppliersApi.list({ per_page: 50 }),
    staleTime: 60_000,
  })

  const products = productsQuery.data?.data ?? []
  const suppliers = suppliersQuery.data?.data ?? []

  const ordersQuery = useQuery({
    queryKey: ['purchasing', 'orders', { page: ordersPage, status: ordersStatus }],
    queryFn: () =>
      purchasingApi.orders({
        page: ordersPage,
        per_page: 12,
        status: ordersStatus === 'all' ? undefined : ordersStatus,
      }),
    placeholderData: (prev) => prev,
  })

  const requisitionsQuery = useQuery({
    queryKey: ['purchasing', 'requisitions', { page: requisitionsPage, status: requisitionsStatus }],
    queryFn: () =>
      purchasingApi.requisitions({
        page: requisitionsPage,
        per_page: 12,
        status: requisitionsStatus === 'all' ? undefined : requisitionsStatus,
      }),
    placeholderData: (prev) => prev,
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      purchasingApi.updateOrderStatus(id, status),
    onSuccess: () => {
      toast.success('Order updated')
      void queryClient.invalidateQueries({ queryKey: ['purchasing'] })
    },
    onError: (err) => {
      toast.error('Could not update order', {
        description: err instanceof ApiError ? err.message : undefined,
      })
    },
  })

  const orders: PurchaseOrder[] = ordersQuery.data?.data ?? []
  const ordersMeta = ordersQuery.data?.meta
  const requisitions: PurchaseRequisition[] = requisitionsQuery.data?.data ?? []
  const requisitionsMeta = requisitionsQuery.data?.meta

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Purchasing"
        description="Purchase orders, requisitions and supplier commitments."
      >
        {tab === 'orders' ? (
          <Button size="sm" onClick={() => setOrderDialogOpen(true)}>
            <PackagePlus className="h-4 w-4" />
            New order
          </Button>
        ) : (
          <Button size="sm" onClick={() => setRequisitionDialogOpen(true)}>
            <ClipboardPlus className="h-4 w-4" />
            New requisition
          </Button>
        )}
      </PageHeader>

      <Tabs defaultValue="orders" onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="requisitions">Requisitions</TabsTrigger>
        </TabsList>

        <TabsContent value="orders">
          <div className="mb-4 flex items-center gap-2">
            <Select
              value={ordersStatus}
              onValueChange={(value) => {
                setOrdersPage(1)
                setOrdersStatus(value)
              }}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status === 'all' ? 'All statuses' : status.replace(/_/g, ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {ordersQuery.isLoading && <LoadingState variant="table" rows={6} />}
          {ordersQuery.isError && (
            <ErrorState error={ordersQuery.error} onRetry={() => ordersQuery.refetch()} />
          )}

          {!ordersQuery.isLoading && !ordersQuery.isError && orders.length === 0 && (
            <EmptyState
              title="No purchase orders found"
              description="Adjust the status filter or create your first purchase order."
              icon={<PackagePlus className="h-6 w-6" />}
              action={
                <Button variant="outline" size="sm" onClick={() => setOrderDialogOpen(true)}>
                  New order
                </Button>
              }
            />
          )}

          {!ordersQuery.isLoading && !ordersQuery.isError && orders.length > 0 && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expected</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Created by</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>
                        <span className="font-mono text-xs font-semibold text-foreground">
                          {order.reference}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {order.supplier_name ?? '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {order.branch_name}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={order.status} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(order.expected_at)}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium tabular-nums text-foreground">
                        {formatCurrency(order.total)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {order.created_by}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTime(order.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm">
                              <span className="sr-only">Actions</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => updateStatus.mutate({ id: order.id, status: 'received' })}
                            >
                              <PackageCheck className="h-4 w-4" />
                              Mark received
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => updateStatus.mutate({ id: order.id, status: 'approved' })}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              Mark approved
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => updateStatus.mutate({ id: order.id, status: 'cancelled' })}
                            >
                              <XCircle className="h-4 w-4" />
                              Mark cancelled
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Pagination
                page={ordersMeta?.current_page ?? ordersPage}
                lastPage={ordersMeta?.last_page ?? 1}
                total={ordersMeta?.total}
                totalLabel="orders"
                isFetching={ordersQuery.isFetching}
                onPageChange={setOrdersPage}
              />
            </>
          )}
        </TabsContent>

        <TabsContent value="requisitions">
          <div className="mb-4 flex items-center gap-2">
            <Select
              value={requisitionsStatus}
              onValueChange={(value) => {
                setRequisitionsPage(1)
                setRequisitionsStatus(value)
              }}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status === 'all' ? 'All statuses' : status.replace(/_/g, ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {requisitionsQuery.isLoading && <LoadingState variant="table" rows={6} />}
          {requisitionsQuery.isError && (
            <ErrorState
              error={requisitionsQuery.error}
              onRetry={() => requisitionsQuery.refetch()}
            />
          )}

          {!requisitionsQuery.isLoading &&
            !requisitionsQuery.isError &&
            requisitions.length === 0 && (
              <EmptyState
                title="No requisitions found"
                description="Adjust the status filter or raise your first requisition."
                icon={<ClipboardPlus className="h-6 w-6" />}
                action={
                  <Button variant="outline" size="sm" onClick={() => setRequisitionDialogOpen(true)}>
                    New requisition
                  </Button>
                }
              />
            )}

          {!requisitionsQuery.isLoading &&
            !requisitionsQuery.isError &&
            requisitions.length > 0 && (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reference</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead>Branch</TableHead>
                      <TableHead>Requested by</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requisitions.map((requisition) => (
                      <TableRow key={requisition.id}>
                        <TableCell>
                          <span className="font-mono text-xs font-semibold text-foreground">
                            {requisition.reference}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-foreground">
                          {requisition.product_name}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                          {formatNumber(requisition.quantity)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {requisition.branch_name}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {requisition.requested_by}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={requisition.status} />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(requisition.created_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <Pagination
                  page={requisitionsMeta?.current_page ?? requisitionsPage}
                  lastPage={requisitionsMeta?.last_page ?? 1}
                  total={requisitionsMeta?.total}
                  totalLabel="requisitions"
                  isFetching={requisitionsQuery.isFetching}
                  onPageChange={setRequisitionsPage}
                />
              </>
            )}
        </TabsContent>
      </Tabs>

      {orderDialogOpen && (
        <OrderDialog
          suppliers={suppliers}
          products={products}
          branches={branches}
          defaultBranchId={branchId}
          onClose={() => setOrderDialogOpen(false)}
        />
      )}

      {requisitionDialogOpen && (
        <RequisitionDialog
          products={products}
          defaultBranchId={branchId}
          onClose={() => setRequisitionDialogOpen(false)}
        />
      )}
    </div>
  )
}

interface OrderDialogProps {
  suppliers: Option[]
  products: ProductOption[]
  branches: Branch[]
  defaultBranchId?: number
  onClose: () => void
}

function OrderDialog({
  suppliers,
  products,
  branches,
  defaultBranchId,
  onClose,
}: OrderDialogProps) {
  const queryClient = useQueryClient()
  const nextKey = useRef(2)
  const [supplierId, setSupplierId] = useState('none')
  const [branch, setBranch] = useState(defaultBranchId ? String(defaultBranchId) : '')
  const [expectedAt, setExpectedAt] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<OrderLine[]>([
    { key: 1, productId: '', quantity: '1', unitCost: '' },
  ])

  const createOrder = useMutation({
    mutationFn: (input: PurchaseOrderInput) => purchasingApi.createOrder(input),
    onSuccess: () => {
      toast.success('Order created')
      onClose()
      void queryClient.invalidateQueries({ queryKey: ['purchasing'] })
    },
    onError: (err) => {
      toast.error('Could not create order', {
        description: err instanceof ApiError ? err.message : undefined,
      })
    },
  })

  const updateLine = (key: number, patch: Partial<OrderLine>) => {
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)))
  }

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      { key: nextKey.current++, productId: '', quantity: '1', unitCost: '' },
    ])
  }

  const removeLine = (key: number) => {
    setLines((prev) => prev.filter((line) => line.key !== key))
  }

  const hasProduct = lines.some((line) => line.productId)

  const submit = () => {
    const rows = lines.filter((line) => line.productId)
    if (rows.length === 0) {
      toast.error('Add at least one product line')
      return
    }
    if (!branch) {
      toast.error('Select a branch')
      return
    }
    createOrder.mutate({
      supplier_id: supplierId === 'none' ? undefined : Number(supplierId),
      branch_id: Number(branch),
      expected_at: expectedAt || undefined,
      items: rows.map((line) => ({
        product_id: Number(line.productId),
        quantity: Number(line.quantity) || 1,
        unit_cost: line.unitCost ? Number(line.unitCost) : undefined,
      })),
      notes: notes.trim() || undefined,
    })
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New purchase order</DialogTitle>
          <DialogDescription>
            Commit a supplier order. Totals and stock effects are calculated by the backend.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Supplier</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No supplier</SelectItem>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={String(supplier.id)}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Branch</Label>
              <Select value={branch} onValueChange={setBranch}>
                <SelectTrigger>
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((item) => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="order-expected">Expected date</Label>
            <Input
              id="order-expected"
              type="date"
              value={expectedAt}
              onChange={(e) => setExpectedAt(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label>Items</Label>
            <div className="grid gap-3 rounded-xl border border-border/70 p-3">
              {lines.map((line) => (
                <div key={line.key} className="grid grid-cols-12 items-end gap-2">
                  <div className="col-span-6 grid gap-1">
                    <Label className="text-[11px] text-muted-foreground">Product</Label>
                    <Select
                      value={line.productId}
                      onValueChange={(value) => updateLine(line.key, { productId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select product" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={String(product.id)}>
                            {product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 grid gap-1">
                    <Label className="text-[11px] text-muted-foreground">Qty</Label>
                    <Input
                      type="number"
                      min={1}
                      value={line.quantity}
                      onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                    />
                  </div>
                  <div className="col-span-3 grid gap-1">
                    <Label className="text-[11px] text-muted-foreground">Unit cost</Label>
                    <Input
                      type="number"
                      min={0}
                      value={line.unitCost}
                      onChange={(e) => updateLine(line.key, { unitCost: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={lines.length === 1}
                      onClick={() => removeLine(line.key)}
                    >
                      <span className="sr-only">Remove line</span>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={addLine}>
                <Plus className="h-4 w-4" />
                Add line
              </Button>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="order-notes">Notes</Label>
            <Input
              id="order-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Delivery instructions, terms…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            loading={createOrder.isPending}
            disabled={!hasProduct || !branch}
            onClick={submit}
          >
            Create order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface RequisitionDialogProps {
  products: ProductOption[]
  defaultBranchId?: number
  onClose: () => void
}

function RequisitionDialog({ products, defaultBranchId, onClose }: RequisitionDialogProps) {
  const queryClient = useQueryClient()
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [notes, setNotes] = useState('')

  const createRequisition = useMutation({
    mutationFn: (input: {
      product_id: number
      quantity: number
      branch_id: number
      notes?: string
    }) => purchasingApi.createRequisition(input),
    onSuccess: () => {
      toast.success('Requisition created')
      onClose()
      void queryClient.invalidateQueries({ queryKey: ['purchasing'] })
    },
    onError: (err) => {
      toast.error('Could not create requisition', {
        description: err instanceof ApiError ? err.message : undefined,
      })
    },
  })

  const submit = () => {
    if (!productId) {
      toast.error('Select a product')
      return
    }
    if (!defaultBranchId) {
      toast.error('No active branch selected')
      return
    }
    createRequisition.mutate({
      product_id: Number(productId),
      quantity: Number(quantity) || 1,
      branch_id: defaultBranchId,
      notes: notes.trim() || undefined,
    })
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New requisition</DialogTitle>
          <DialogDescription>
            Request stock replenishment for the active branch.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Product</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger>
                <SelectValue placeholder="Select product" />
              </SelectTrigger>
              <SelectContent>
                {products.map((product) => (
                  <SelectItem key={product.id} value={String(product.id)}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="requisition-quantity">Quantity</Label>
            <Input
              id="requisition-quantity"
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="requisition-notes">Notes</Label>
            <Input
              id="requisition-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason, urgency…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            loading={createRequisition.isPending}
            disabled={!productId || !defaultBranchId}
            onClick={submit}
          >
            Create requisition
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
