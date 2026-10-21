import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Clock,
  Eraser,
  FolderOpen,
  Keyboard,
  Loader2,
  Minus,
  PauseCircle,
  Plus,
  ScanLine,
  Search,
  ShieldAlert,
  ShoppingBasket,
  Trash2,
  UserRound,
  UserRoundPlus,
  Wifi,
} from 'lucide-react'
import { posApi, type CartItem, type HeldSale, type SellableProduct } from '@/lib/api/endpoints/pos'
import { catalogApi } from '@/lib/api/endpoints/products'
import { customersApi, type Customer } from '@/lib/api/endpoints/customers'
import { shiftApi, type Shift } from '@/lib/api/endpoints/shifts'
import { saleSessionApi } from '@/lib/api/endpoints/shifts'
import { useHardwareScanner } from '@/features/pos/barcode'
import { ScannerDialog } from '@/features/pos/scanner-dialog'
import { CartPanel } from '@/features/pos/cart-panel'
import { PaymentDialog } from '@/features/pos/payment-dialog'
import { usePosCart, getPosError } from '@/features/pos/use-pos-cart'
import { usePosStore } from '@/features/pos/pos-store'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/common/empty-state'
import { ErrorState } from '@/components/common/error-state'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { toast } from '@/components/ui/sonner'
import { cn, formatCurrency, formatNumber } from '@/lib/utils'

function isInteractiveTarget(target: EventTarget | null): boolean {
  return (
    !!target &&
    target instanceof HTMLElement &&
    target.matches('input,textarea,select,button,a,[role="button"]')
  )
}

export function PosPage() {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [customerOpen, setCustomerOpen] = useState(false)
  const [heldOpen, setHeldOpen] = useState(false)
  const [matched, setMatched] = useState<SellableProduct | null>(null)

  const searchRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const setLastProduct = usePosStore((s) => s.setLastProduct)
  const cartReference = usePosStore((s) => s.cartReference)

  const context = useAppStore((s) => s.context)
  const branchId = context?.branch?.id
  const userName = useAuthStore((s) => s.session?.user.name)

  const { cart, addItem, updateItem, removeItem, setCustomer, clearCart, applyCart } = usePosCart()

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(t)
  }, [query])

  const results = useQuery({
    queryKey: ['pos-search', debouncedQuery, category],
    queryFn: () =>
      posApi.searchProducts({
        q: debouncedQuery || undefined,
        category: category || undefined,
        per_page: 24,
      }),
    placeholderData: (prev) => prev,
  })

  const categoriesQuery = useQuery({
    queryKey: ['pos-categories'],
    queryFn: () => catalogApi.categories(),
    staleTime: 5 * 60 * 1000,
  })

  const shiftQuery = useQuery({
    queryKey: ['shift', 'current', branchId],
    queryFn: () => shiftApi.current(branchId),
    enabled: !!branchId,
    retry: false,
  })
  const shift = shiftQuery.data?.data ?? null

  const sessionQuery = useQuery({
    queryKey: ['sale-sessions', 'current', branchId],
    queryFn: () => saleSessionApi.current({ branch_id: branchId }),
    enabled: !!branchId,
    retry: false,
  })
  const session = sessionQuery.data?.data ?? null

  const shiftConfigQuery = useQuery({
    queryKey: ['shift-config', branchId],
    queryFn: () => shiftApi.config(),
    enabled: !!branchId,
    retry: false,
  })
  const shiftsEnabled = shiftConfigQuery.data?.data.shifts_enabled ?? true
  const requireSaleSession = shiftConfigQuery.data?.data.require_sale_session ?? true
  const needsSession = requireSaleSession && !session

  const branchShiftQuery = useQuery({
    queryKey: ['shifts', 'open', branchId],
    queryFn: () => shiftApi.history({ status: 'open', branch_id: branchId, per_page: 100 }),
    enabled: !!branchId && shiftsEnabled,
    retry: false,
  })
  const branchShift =
    (branchShiftQuery.data?.data ?? []).find((item: Shift) => item.branch_id === branchId) ?? null
  const shiftBlocked = shiftsEnabled && !!branchId && !branchShift
  const payBlocked = shiftBlocked || needsSession

  const customerQuery = useQuery({
    queryKey: ['customer', cart?.customer_id],
    queryFn: () => customersApi.get(cart!.customer_id as number),
    enabled: !!cart?.customer_id,
  })
  const customer = customerQuery.data?.data ?? null

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'F1' || e.key === '/') && !isInteractiveTarget(document.activeElement)) {
        e.preventDefault()
        searchRef.current?.focus()
        return
      }
      if (e.key === 'Escape') {
        setMatched(null)
        return
      }
      if (
        e.key === 'Enter' &&
        !isInteractiveTarget(document.activeElement) &&
        !scannerOpen &&
        !payOpen &&
        !cartOpen &&
        !customerOpen &&
        !payBlocked &&
        (cart?.items.length ?? 0) > 0
      ) {
        e.preventDefault()
        setPayOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [scannerOpen, payOpen, cartOpen, customerOpen, cart, payBlocked])

  const handleBarcode = async (barcode: string) => {
    setMatched(null)
    setScannerOpen(false)
    try {
      const { data } = await posApi.lookupBarcode(barcode)
      setMatched(data)
      setLastProduct(data)
    } catch (error) {
      const { message, code } = getPosError(error)
      toast.error(message || 'Product not found for this barcode.', {
        description: code ? `CODE: ${code}` : undefined,
      })
    }
  }

  useHardwareScanner(handleBarcode, !scannerOpen)

  const addToCart = (product: SellableProduct, qty = 1) => {
    addItem.mutate(
      { product_id: product.id, quantity: qty },
      {
        onError: (error) => toast.error(getPosError(error).message),
        onSuccess: () => setMatched(null),
      },
    )
  }

  const setLineQty = (line: CartItem, quantity: number) => {
    if (quantity <= 0) removeItem.mutate(line.id)
    else updateItem.mutate({ lineId: line.id, quantity })
  }

  const hold = useMutation({
    mutationFn: () => posApi.holdSale({ reference: cartReference ?? undefined }),
    onSuccess: () => {
      clearCart()
      queryClient.invalidateQueries({ queryKey: ['pos-held-sales'] })
      toast.success('Sale held — draft parked for later.')
    },
    onError: (error) => toast.error(getPosError(error).message || 'Could not hold the sale.'),
  })

  const heldQuery = useQuery({
    queryKey: ['pos-held-sales'],
    queryFn: () => posApi.getHeldSales(),
    staleTime: 30_000,
  })
  const heldSales = heldQuery.data?.data.carts ?? []

  const startNewSale = () => {
    if ((cart?.items.length ?? 0) > 0) {
      hold.mutate()
      return
    }
    clearCart()
    searchRef.current?.focus()
  }

  const resume = useMutation({
    mutationFn: (reference: string) => posApi.resumeSale(reference),
    onSuccess: ({ data }) => {
      applyCart(data)
      setHeldOpen(false)
      queryClient.invalidateQueries({ queryKey: ['pos-held-sales'] })
      toast.success('Sale restored to the till.')
    },
    onError: (error) => toast.error(getPosError(error).message || 'Could not resume the sale.'),
  })

  const clearAll = async () => {
    if (!cart) return
    for (const item of cart.items) {
      try {
        await removeItem.mutateAsync(item.id)
      } catch {
        /* keep clearing remaining lines */
      }
    }
  }

  const categories = categoriesQuery.data?.data ?? []
  const products = results.data?.data ?? []
  const lines = cart?.items.length ?? 0
  const units = cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0
  const cartBusy = addItem.isPending || updateItem.isPending || removeItem.isPending
  const cartLine = (productId: number) =>
    cart?.items.find((item) => item.product_id === productId && !item.variant_id) ?? null

  return (
    <div className="animate-fade-in flex flex-col gap-3 pb-24 lg:pb-0">
      <TillBanner
        branchName={context?.branch?.name ?? 'All branches'}
        businessName={context?.business.name ?? ''}
        userName={userName ?? 'Cashier'}
        shift={branchShift ?? shift}
        customer={customer}
        onCustomerClick={() => setCustomerOpen(true)}
      />

      {shiftBlocked && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2">
          <span className="flex items-center gap-1.5 text-sm font-medium text-destructive">
            <ShieldAlert className="h-4 w-4" />
            No shift is open. A manager must open a shift before sales can be taken.
          </span>
          <Link to="/shifts" className="text-xs font-semibold text-destructive underline-offset-2 hover:underline">
            Go to shifts
          </Link>
        </div>
      )}

      {!shiftBlocked && needsSession && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2">
          <span className="flex items-center gap-1.5 text-sm font-medium text-destructive">
            <ShieldAlert className="h-4 w-4" />
            Open your sale before taking payments.
          </span>
          <Link to="/shifts" className="text-xs font-semibold text-destructive underline-offset-2 hover:underline">
            Open sale
          </Link>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex min-w-0 flex-col gap-3">
          {/* Search + hardware triggers */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setMatched(null)
                }}
                placeholder="Scan barcode, SKU, batch… [F1]"
                className="h-11 rounded-xl pl-11 pr-12"
                aria-label="Search products"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded bg-accent px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                F1
              </span>
            </div>
            <button
              type="button"
              aria-label="Camera scanner"
              onClick={() => setScannerOpen(true)}
              className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-card transition-transform active:scale-95"
            >
              <ScanLine className="h-5 w-5" />
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-success" />
            </button>
            <button
              type="button"
              aria-label="Manual keypad entry"
              onClick={() => searchRef.current?.focus()}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent text-foreground transition-transform hover:text-primary active:scale-95"
            >
              <Keyboard className="h-5 w-5" />
            </button>
          </div>

          {/* Category chips */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
            <CategoryChip active={category === null} onClick={() => setCategory(null)}>
              All Items
            </CategoryChip>
            {categories.map((c) => (
              <CategoryChip
                key={c.id}
                active={category === c.name}
                onClick={() => setCategory(category === c.name ? null : c.name)}
              >
                {c.name}
              </CategoryChip>
            ))}
          </div>

          {matched && (
            <MatchedProduct
              product={matched}
              onAdd={() => addToCart(matched)}
              adding={addItem.isPending}
            />
          )}

          {/* Product selection grid */}
          <div className="flex items-center justify-between px-0.5">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Active Catalog Tape
            </p>
            <span className="font-mono text-[10px] text-muted-foreground">{products.length} SKUs</span>
          </div>

          {results.isLoading && (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-28 w-full rounded-xl" />
              ))}
            </div>
          )}

          {results.isError && (
            <ErrorState error={results.error} onRetry={() => results.refetch()} />
          )}

          {!results.isLoading && !results.isError && products.length === 0 && (
            <EmptyState
              title={debouncedQuery || category ? 'No products match' : 'Waiting for input'}
              description={
                debouncedQuery || category
                  ? 'Try a different search or category, or scan a barcode.'
                  : 'Scan a barcode or start typing to find products. Product data comes from Laravel.'
              }
              className="border-0"
            />
          )}

          {!results.isLoading && !results.isError && products.length > 0 && (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  line={cartLine(product.id)}
                  busy={cartBusy}
                  onAdd={() => addToCart(product)}
                  onQty={setLineQty}
                />
              ))}
            </div>
          )}

          {/* Operator quick ribbon */}
          <OperatorRibbon
            canHold={(cart?.items.length ?? 0) > 0}
            canClear={(cart?.items.length ?? 0) > 0}
            holdBusy={hold.isPending}
            onHold={() => hold.mutate()}
            onNewSale={startNewSale}
            onClear={clearAll}
            onCustomer={() => setCustomerOpen(true)}
            onScan={() => setScannerOpen(true)}
            onHeld={() => setHeldOpen(true)}
            heldCount={heldSales.length}
          />
        </div>

        {/* Desktop cart — structure preserved */}
        <div className="hidden lg:block">
          <div className="sticky top-20 h-[calc(100dvh-180px)]">
            <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-card">
              <CartPanel
                onPay={() => setPayOpen(true)}
                paying={false}
                blocked={payBlocked}
                blockedReason={
                  shiftBlocked
                    ? 'Open a shift before charging this sale.'
                    : needsSession
                      ? 'Open your sale before charging.'
                      : undefined
                }
              />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile cart sheet */}
      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent
          side="bottom"
          className="flex h-[85dvh] max-h-[92dvh] flex-col overflow-hidden rounded-t-2xl p-0"
        >
          <SheetHeader className="flex-shrink-0 border-b border-border/60 px-4 py-3">
            <SheetTitle>Current sale</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto">
            <CartPanel
              onPay={() => {
                setCartOpen(false)
                setPayOpen(true)
              }}
              paying={false}
              blocked={payBlocked}
              blockedReason={
                shiftBlocked
                  ? 'Open a shift before charging this sale.'
                  : needsSession
                    ? 'Open your sale before charging.'
                    : undefined
              }
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Mobile persistent cart strip */}
      {lines > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-16 z-40 px-4 pb-2 lg:hidden">
          <div className="pointer-events-auto flex flex-col gap-2 rounded-2xl bg-surface-elevated/95 p-3 shadow-2xl backdrop-blur-xl">
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="flex items-center justify-between gap-3 text-left"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary font-mono text-sm font-bold text-primary-foreground">
                  {lines}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold leading-tight text-foreground">
                    {lines} item{lines === 1 ? '' : 's'} ({units} unit{units === 1 ? '' : 's'})
                  </p>
                  <p className="truncate font-mono text-[10px] text-muted-foreground">
                    Sub {cart ? formatCurrency(cart.subtotal) : '—'}
                    {cart && cart.tax_total > 0 ? ` • Tax ${formatCurrency(cart.tax_total)}` : ''}
                  </p>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-mono text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Total payable
                </p>
                <p className="text-lg font-bold leading-tight text-primary">
                  {cart ? formatCurrency(cart.total) : '—'}
                </p>
              </div>
            </button>

            <div className="grid grid-cols-12 gap-2">
              <Button
                variant="outline"
                className="col-span-4 h-11"
                onClick={() => setCartOpen(true)}
              >
                <ShoppingBasket className="h-4 w-4" /> Cart
              </Button>
              <Button
                className="col-span-8 h-11"
                onClick={() => setPayOpen(true)}
                disabled={!!cart?.requires_approval || payBlocked}
              >
                {cart?.requires_approval ? 'Needs approval' : 'Pay'}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <ScannerDialog open={scannerOpen} onOpenChange={setScannerOpen} onBarcode={handleBarcode} />
      <PaymentDialog open={payOpen} onOpenChange={setPayOpen} />
      <HeldSalesDialog
        open={heldOpen}
        onOpenChange={setHeldOpen}
        sales={heldSales}
        loading={heldQuery.isLoading}
        resuming={resume.isPending}
        onResume={(reference) => resume.mutate(reference)}
      />
      <CustomerDialog
        open={customerOpen}
        onOpenChange={setCustomerOpen}
        selectedId={cart?.customer_id ?? null}
        onSelect={(id) => {
          setCustomer.mutate(id, {
            onSuccess: () => setCustomerOpen(false),
            onError: (error) => toast.error(getPosError(error).message),
          })
        }}
      />
    </div>
  )
}

function TillBanner({
  branchName,
  businessName,
  userName,
  shift,
  customer,
  onCustomerClick,
}: {
  branchName: string
  businessName: string
  userName: string
  shift: Shift | null
  customer: Customer | null
  onCustomerClick: () => void
}) {
  const open = shift?.status === 'open'

  return (
    <div className="rounded-2xl border border-border/70 bg-surface p-3 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              'h-2 w-2 shrink-0 rounded-full',
              open ? 'animate-pulse bg-success' : 'bg-muted-foreground',
            )}
          />
          <span
            className={cn(
              'font-mono text-[10px] font-semibold uppercase tracking-wider',
              open ? 'text-success' : 'text-muted-foreground',
            )}
          >
            {shift ? `Till #${String(shift.id).padStart(2, '0')}` : 'No open till'}
          </span>
          <span className="text-muted-foreground">•</span>
          <span className="truncate text-[13px] font-semibold text-foreground">{userName}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
          <Wifi className="h-3.5 w-3.5 text-success" />
          <span className="max-w-[9rem] truncate font-mono text-[10px]">{branchName}</span>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 border-t border-border/60 pt-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-accent text-primary">
            <UserRound className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold leading-none text-foreground">
              {customer ? customer.name : 'Walk-in customer'}
            </p>
            <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
              {customer
                ? customer.phone || `${formatCurrency(customer.outstanding_balance)} outstanding`
                : businessName || 'No customer linked'}
            </p>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="shrink-0"
          onClick={onCustomerClick}
        >
          <UserRoundPlus className="h-4 w-4" />
          {customer ? 'Change' : 'Assign'}
        </Button>
      </div>
    </div>
  )
}

function CategoryChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors active:scale-95',
        active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'bg-accent text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

function OperatorRibbon({
  canHold,
  canClear,
  holdBusy,
  onHold,
  onNewSale,
  onClear,
  onCustomer,
  onScan,
  onHeld,
  heldCount,
}: {
  canHold: boolean
  canClear: boolean
  holdBusy: boolean
  onHold: () => void
  onNewSale: () => void
  onClear: () => void
  onCustomer: () => void
  onScan: () => void
  onHeld: () => void
  heldCount: number
}) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar rounded-xl bg-surface-sunken p-2">
      <RibbonButton icon={<Plus className="h-4 w-4 text-primary" />} onClick={onNewSale} disabled={holdBusy}>
        New sale
      </RibbonButton>
      <RibbonButton icon={<PauseCircle className="h-4 w-4 text-warning" />} onClick={onHold} disabled={!canHold || holdBusy}>
        Hold
      </RibbonButton>
      <RibbonButton icon={<Eraser className="h-4 w-4 text-destructive" />} onClick={onClear} disabled={!canClear}>
        Clear
      </RibbonButton>
      <RibbonButton icon={<UserRoundPlus className="h-4 w-4 text-info" />} onClick={onCustomer}>
        Customer
      </RibbonButton>
      <RibbonButton icon={<ScanLine className="h-4 w-4 text-primary" />} onClick={onScan}>
        Scan
      </RibbonButton>
      <RibbonButton
        icon={<FolderOpen className="h-4 w-4 text-muted-foreground" />}
        onClick={onHeld}
        badge={heldCount}
      >
        Held sales
      </RibbonButton>
    </div>
  )
}

function RibbonButton({
  icon,
  onClick,
  disabled,
  badge,
  children,
}: {
  icon: React.ReactNode
  onClick: () => void
  disabled?: boolean
  badge?: number
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-[11px] font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
    >
      {icon}
      {children}
      {badge != null && badge > 0 && (
        <span className="grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 font-mono text-[9px] font-bold text-primary-foreground">
          {badge}
        </span>
      )}
    </button>
  )
}

function ProductCard({
  product,
  line,
  busy,
  onAdd,
  onQty,
}: {
  product: SellableProduct
  line: CartItem | null
  busy: boolean
  onAdd: () => void
  onQty: (line: CartItem, quantity: number) => void
}) {
  const qty = line?.quantity ?? 0
  const lowThreshold = product.low_stock_threshold ?? 5
  const expiring = product.expiry_warning && product.expiry_warning.status !== 'ok'
  const inCart = qty > 0

  return (
    <div
      className={cn(
        'relative flex flex-col overflow-hidden rounded-xl border bg-card p-3 shadow-card transition-colors',
        inCart ? 'border-primary/40' : 'border-border/70',
      )}
    >
      {inCart && <span className="absolute inset-y-0 left-0 w-1 bg-primary" />}

      <div className="flex items-start gap-3">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-surface">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="grid h-full w-full place-items-center text-base font-bold text-muted-foreground">
              {product.name.charAt(0).toUpperCase()}
            </span>
          )}
          {product.unit && (
            <span className="absolute inset-x-0 bottom-0 bg-surface-sunken/85 py-0.5 text-center font-mono text-[9px] text-muted-foreground">
              {product.unit}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {product.category && (
              <span className="rounded bg-accent px-1.5 py-0.5 font-mono text-[9px] text-primary">
                {product.category}
              </span>
            )}
            <StockNote product={product} lowThreshold={lowThreshold} />
          </div>
          <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-foreground">
            {product.name}
          </h3>
          <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
            {product.sku}
            {product.brand ? ` · ${product.brand}` : ''}
          </p>
        </div>
      </div>

      {expiring && product.expiry_warning?.message && (
        <p className="mt-1.5 flex items-center gap-1 text-[10px] text-destructive">
          <ShieldAlert className="h-3 w-3 shrink-0" /> {product.expiry_warning.message}
        </p>
      )}
      {!product.is_sellable && product.reason && (
        <p className="mt-1.5 flex items-center gap-1 text-[10px] text-destructive">
          <ShieldAlert className="h-3 w-3 shrink-0" /> {product.reason}
        </p>
      )}

      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border/50 pt-2.5">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-foreground">{formatCurrency(product.price)}</p>
          {inCart && line ? (
            <p className="truncate font-mono text-[10px] font-semibold text-primary">
              {qty} × {formatCurrency(line.unit_price)} = {formatCurrency(line.line_total)}
            </p>
          ) : (
            product.discount ? (
              <p className="font-mono text-[10px] text-muted-foreground">
                {product.discount}% off
              </p>
            ) : null
          )}
        </div>

        {inCart && line ? (
          <div className="flex shrink-0 items-center rounded-lg bg-accent p-0.5">
            <button
              type="button"
              aria-label="Decrease quantity"
              disabled={qty <= 1 || busy}
              onClick={() => onQty(line, qty - 1)}
              className="grid h-7 w-7 place-items-center rounded text-foreground transition-transform hover:text-primary active:scale-90 disabled:opacity-40"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="w-6 text-center font-mono text-xs font-bold text-primary">{qty}</span>
            <button
              type="button"
              aria-label="Increase quantity"
              disabled={busy}
              onClick={() => onQty(line, qty + 1)}
              className="grid h-7 w-7 place-items-center rounded text-foreground transition-transform hover:text-primary active:scale-90 disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label="Remove line"
              disabled={busy}
              onClick={() => onQty(line, 0)}
              className="grid h-7 w-7 place-items-center rounded text-muted-foreground transition-colors hover:text-destructive disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <Button
            size="sm"
            className="shrink-0"
            onClick={onAdd}
            disabled={!product.is_sellable || busy}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add
          </Button>
        )}
      </div>
    </div>
  )
}

function StockNote({ product, lowThreshold }: { product: SellableProduct; lowThreshold: number }) {
  if (!product.is_sellable) {
    return <span className="font-mono text-[10px] text-destructive">Unavailable</span>
  }
  if (product.stock_qty <= 0) {
    return <span className="font-mono text-[10px] text-destructive">Out of stock</span>
  }
  const low = product.stock_qty <= lowThreshold
  return (
    <span className={cn('font-mono text-[10px]', low ? 'text-warning' : 'text-muted-foreground')}>
      {formatNumber(product.stock_qty)} in stock{low ? ' (low)' : ''}
    </span>
  )
}

function MatchedProduct({
  product,
  onAdd,
  adding,
}: {
  product: SellableProduct
  onAdd: () => void
  adding: boolean
}) {
  return (
    <div className="flex animate-slide-up items-center gap-4 rounded-2xl border border-primary/30 bg-primary/[0.05] p-4 shadow-glow">
      <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-border/70 bg-surface text-xl font-bold text-primary">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
        ) : (
          product.name.charAt(0).toUpperCase()
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-base font-bold text-foreground">{product.name}</p>
          <Badge variant="success">Matched</Badge>
        </div>
        <p className="truncate font-mono text-[11px] text-muted-foreground">
          {product.sku} · {formatCurrency(product.price)}
        </p>
        {product.expiry_warning && product.expiry_warning.status !== 'ok' && (
          <p className="mt-1 flex items-center gap-1 text-[11px] text-destructive">
            <ShieldAlert className="h-3 w-3" /> {product.expiry_warning.message}
          </p>
        )}
      </div>
      <Button size="lg" onClick={onAdd} disabled={!product.is_sellable || adding}>
        {adding ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
        Add to cart
      </Button>
    </div>
  )
}

function CustomerDialog({
  open,
  onOpenChange,
  selectedId,
  onSelect,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedId: number | null
  onSelect: (id: number | null) => void
}) {
  const [term, setTerm] = useState('')
  const [debounced, setDebounced] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term), 300)
    return () => clearTimeout(t)
  }, [term])

  const customersQuery = useQuery({
    queryKey: ['customers', 'pos-picker', debounced],
    queryFn: () => customersApi.list({ search: debounced || undefined, per_page: 50 }),
    enabled: open,
  })
  const customers = useMemo(() => customersQuery.data?.data ?? [], [customersQuery.data])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-md flex-col">
        <DialogHeader>
          <DialogTitle>Assign customer</DialogTitle>
          <DialogDescription>
            Link this sale to a customer for credit eligibility and receipts.
          </DialogDescription>
        </DialogHeader>

        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search name or phone…"
          aria-label="Search customers"
        />

        <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
          <button
            type="button"
            onClick={() => onSelect(null)}
            className={cn(
              'mb-1 flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-colors',
              selectedId === null
                ? 'border-primary/50 bg-primary/10'
                : 'border-border/60 hover:bg-accent',
            )}
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-muted-foreground">
              <UserRound className="h-4 w-4" />
            </span>
            <span className="text-sm font-medium text-foreground">Walk-in customer</span>
          </button>

          {customersQuery.isLoading && (
            <div className="space-y-2 py-1">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          )}

          {!customersQuery.isLoading && customers.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">No customers found.</p>
          )}

          {customers.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c.id)}
              className={cn(
                'mb-1 flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-colors',
                selectedId === c.id
                  ? 'border-primary/50 bg-primary/10'
                  : 'border-border/60 hover:bg-accent',
              )}
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent font-mono text-[11px] font-bold text-foreground">
                {c.name.charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">{c.name}</span>
                <span className="block truncate font-mono text-[10px] text-muted-foreground">
                  {c.phone || `${formatCurrency(c.outstanding_balance)} outstanding`}
                </span>
              </span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function HeldSalesDialog({
  open,
  onOpenChange,
  sales,
  loading,
  resuming,
  onResume,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  sales: HeldSale[]
  loading: boolean
  resuming: boolean
  onResume: (reference: string) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-lg flex-col">
        <DialogHeader>
          <DialogTitle>Held sales</DialogTitle>
          <DialogDescription>
            Parked drafts you can restore to the till and complete.
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
          {loading && (
            <div className="space-y-2 py-1">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          )}

          {!loading && sales.length === 0 && (
            <EmptyState
              icon={<FolderOpen className="h-6 w-6" />}
              title="No held sales"
              description="Hold a draft from the till and it will appear here."
            />
          )}

          {sales.map((sale) => (
            <div
              key={sale.reference}
              className="mb-1 flex items-center gap-3 rounded-lg border border-border/60 p-2.5"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent font-mono text-[11px] font-bold text-foreground">
                {sale.items_count}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {sale.customer_name || 'Walk-in customer'}
                </p>
                <p className="truncate font-mono text-[10px] text-muted-foreground">
                  {sale.reference} · {sale.items_count} item
                  {sale.items_count === 1 ? '' : 's'}
                </p>
                {sale.updated_at && (
                  <p className="mt-0.5 flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    Held {new Date(sale.updated_at).toLocaleTimeString()}
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="font-mono text-sm font-bold text-foreground">
                  {formatCurrency(sale.total)}
                </p>
                <Button
                  size="sm"
                  className="mt-1 h-8"
                  disabled={resuming}
                  onClick={() => onResume(sale.reference)}
                >
                  Resume
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
