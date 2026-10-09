import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ScanLine,
  Search,
  ShieldAlert,
  ShoppingCart,
  PackageSearch,
  Plus,
  Loader2,
} from 'lucide-react'
import { posApi, type SellableProduct } from '@/lib/api/endpoints/pos'
import { useHardwareScanner } from '@/features/pos/barcode'
import { ScannerDialog } from '@/features/pos/scanner-dialog'
import { CartPanel } from '@/features/pos/cart-panel'
import { PaymentDialog } from '@/features/pos/payment-dialog'
import { usePosCart, getPosError } from '@/features/pos/use-pos-cart'
import { usePosStore } from '@/features/pos/pos-store'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/common/empty-state'
import { ErrorState } from '@/components/common/error-state'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { toast } from '@/components/ui/sonner'
import { cn, formatCurrency } from '@/lib/utils'

export function PosPage() {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [scannerOpen, setScannerOpen] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  const [matched, setMatched] = useState<SellableProduct | null>(null)
  const [mobilePanel, setMobilePanel] = useState<'shop' | 'cart'>('shop')
  const searchRef = useRef<HTMLInputElement>(null)
  const setLastProduct = usePosStore((s) => s.setLastProduct)
  const { addItem } = usePosCart()

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && !document.activeElement?.matches('input,textarea,select')) {
        e.preventDefault()
        searchRef.current?.focus()
      }
      if (e.key === 'Escape') setMatched(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const results = useQuery({
    queryKey: ['pos-search', debouncedQuery],
    queryFn: () => posApi.searchProducts({ q: debouncedQuery || undefined, per_page: 24 }),
    placeholderData: (prev) => prev,
  })

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
        action: {
          label: 'Register',
          onClick: () => toast.info('Product registration is available where permitted.'),
        },
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

  const cartItemsCount = usePosCartCount()

  return (
    <div className="animate-fade-in">
      {/* Mobile: shop / cart toggle */}
      <div className="mb-3 grid grid-cols-2 gap-2 lg:hidden">
        <Button
          variant={mobilePanel === 'shop' ? 'secondary' : 'ghost'}
          onClick={() => setMobilePanel('shop')}
        >
          <PackageSearch className="h-4 w-4" /> Shop
        </Button>
        <Button
          variant={mobilePanel === 'cart' ? 'secondary' : 'ghost'}
          onClick={() => setMobilePanel('cart')}
        >
          <ShoppingCart className="h-4 w-4" /> Cart
          {cartItemsCount > 0 && (
            <Badge variant="default" className="ml-auto px-1.5 py-0 text-[10px]">
              {cartItemsCount}
            </Badge>
          )}
        </Button>
      </div>

      {/* Search + scan bar */}
      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setMatched(null)
            }}
            placeholder="Search by name, SKU, barcode, variant, brand…"
            className="h-12 rounded-xl pl-11 text-base"
            aria-label="Search products"
          />
        </div>
        <Button
          size="lg"
          variant="default"
          className="h-12 shrink-0 rounded-xl px-4 sm:px-6"
          onClick={() => setScannerOpen(true)}
        >
          <ScanLine className="h-5 w-5" />
          <span className="hidden sm:inline">Scan</span>
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
        {/* Left: results */}
        <div className={cn('lg:block', mobilePanel === 'cart' && 'hidden')}>
          {matched && (
            <MatchedProduct
              product={matched}
              onAdd={() => addToCart(matched)}
              adding={addItem.isPending}
            />
          )}

          <ScrollArea className="h-[calc(100dvh-280px)] min-h-72 lg:h-[calc(100dvh-260px)]">
            {results.isLoading && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-40 w-full rounded-2xl" />
                ))}
              </div>
            )}

            {results.isError && (
              <ErrorState error={results.error} onRetry={() => results.refetch()} />
            )}

            {!results.isLoading && !results.isError && results.data?.data.length === 0 && (
              <EmptyState
                title={debouncedQuery ? 'No products match' : 'Waiting for input'}
                description={
                  debouncedQuery
                    ? 'Try a different search, or scan a barcode.'
                    : 'Scan a barcode or start typing to find products. Product information comes from Laravel.'
                }
                className="border-0"
              />
            )}

            {!results.isLoading && !results.isError && (results.data?.data.length ?? 0) > 0 && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {results.data!.data.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAdd={() => addToCart(product)}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Right: cart */}
        <div className={cn('lg:block', mobilePanel === 'shop' && 'hidden')}>
          <div className="sticky top-20 hidden h-[calc(100dvh-180px)] lg:block">
            <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-card">
              <CartPanel onPay={() => setPayOpen(true)} paying={false} />
            </div>
          </div>

          {/* Mobile cart sheet */}
          <Sheet open={mobilePanel === 'cart'} onOpenChange={(o) => setMobilePanel(o ? 'cart' : 'shop')}>
            <SheetContent side="bottom" className="h-[80dvh] rounded-t-2xl p-0">
              <SheetHeader className="border-b border-border/60 px-4 py-3">
                <SheetTitle>Current sale</SheetTitle>
              </SheetHeader>
              <CartPanel onPay={() => { setMobilePanel('shop'); setPayOpen(true) }} paying={false} />
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Mobile floating cart button */}
      {cartItemsCount > 0 && (
        <div className="pointer-events-none fixed bottom-20 left-4 right-4 z-40 lg:hidden">
          <Button
            size="xl"
            className="pointer-events-auto w-full shadow-glow"
            onClick={() => setMobilePanel('cart')}
          >
            <ShoppingCart className="h-5 w-5" />
            View cart ({cartItemsCount})
          </Button>
        </div>
      )}

      <ScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onBarcode={handleBarcode}
      />

      <PaymentDialog open={payOpen} onOpenChange={setPayOpen} />
    </div>
  )
}

function usePosCartCount(): number {
  const { cart } = usePosCart()
  return cart?.items.reduce((sum, i) => sum + i.quantity, 0) ?? 0
}

function ProductCard({
  product,
  onAdd,
}: {
  product: SellableProduct
  onAdd: () => void
}) {
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card p-4 shadow-card transition-all hover:border-border hover:shadow-card-hover">
      <div className="flex items-start gap-3">
        <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl border border-border/70 bg-surface text-lg font-bold text-muted-foreground">
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} loading="lazy" className="h-full w-full object-cover" />
          ) : (
            product.name.charAt(0).toUpperCase()
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{product.name}</p>
          <p className="truncate font-mono text-[10px] text-muted-foreground">
            {product.sku}
            {product.brand ? ` · ${product.brand}` : ''}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {product.requires_expiry && product.expiry_warning ? (
              <Badge variant={product.expiry_warning.status === 'ok' ? 'success' : 'destructive'}>
                {product.expiry_warning.message ?? product.expiry_warning.status}
              </Badge>
            ) : (
              <StockBadge stock={product.stock_qty} sellable={product.is_sellable} />
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-3">
        <div>
          <p className="text-base font-bold text-foreground">{formatCurrency(product.price)}</p>
          {product.tax_rate ? (
            <p className="text-[10px] text-muted-foreground">Tax {product.tax_rate}%</p>
          ) : null}
        </div>
        <Button
          size="sm"
          onClick={onAdd}
          disabled={!product.is_sellable}
        >
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>

      {!product.is_sellable && product.reason && (
        <p className="mt-2 flex items-center gap-1 text-[10px] text-destructive">
          <ShieldAlert className="h-3 w-3" /> {product.reason}
        </p>
      )}
    </div>
  )
}

function StockBadge({ stock, sellable }: { stock: number; sellable: boolean }) {
  if (!sellable) return <Badge variant="destructive">Not sellable</Badge>
  if (stock <= 0) return <Badge variant="destructive">Out of stock</Badge>
  return <Badge variant={stock <= 5 ? 'warning' : 'success'}>{stock} in stock</Badge>
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
    <div className="mb-4 flex animate-slide-up items-center gap-4 rounded-2xl border border-primary/30 bg-primary/[0.05] p-4 shadow-glow">
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