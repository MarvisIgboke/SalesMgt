import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PackagePlus, Search, Split } from 'lucide-react'
import { productsApi } from '@/lib/api/endpoints/products'
import { useAppStore } from '@/stores/app'
import { PageHeader } from '@/components/common/page-header'
import { LoadingState } from '@/components/common/loading-state'
import { ErrorState } from '@/components/common/error-state'
import { EmptyState } from '@/components/common/empty-state'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { debounce } from '@/lib/utils'
import { toast } from '@/components/ui/sonner'

export function ProductsPage() {
  const branchId = useAppStore((s) => s.context?.branch?.id)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const perPage = 12

  const { data, isFetching, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['products', { search, page, branchId }],
    queryFn: () =>
      productsApi.list({
        search: search || undefined,
        page,
        per_page: perPage,
        branch_id: branchId,
      }),
    placeholderData: (prev) => prev,
  })

  const meta = data?.meta
  const rows = data?.data ?? []
  const debouncedSetSearch = debounce(setSearch, 350)

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Products"
        description="Catalogue, variants, barcodes and pricing. Prices are authoritative from the backend."
      >
        <Button size="sm" onClick={() => toast.info('Product creation screen ships in the next build pass.')}>
          <PackagePlus className="h-4 w-4" />
          New product
        </Button>
      </PageHeader>

      <Tabs defaultValue="catalogue">
        <TabsList>
          <TabsTrigger value="catalogue">Catalogue</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="brands">Brands</TabsTrigger>
        </TabsList>

        <TabsContent value="catalogue">
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search name, SKU, barcode, brand…"
              className="pl-9"
              onChange={(e) => {
                setPage(1)
                debouncedSetSearch(e.target.value)
              }}
            />
          </div>

          {isLoading && <LoadingState rows={6} />}
          {isError && <ErrorState error={error} onRetry={() => refetch()} />}

          {!isLoading && !isError && rows.length === 0 && (
            <EmptyState
              title="No products found"
              description="Try adjusting your search, or add a product through the backend."
              action={
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  Refresh
                </Button>
              }
            />
          )}

          {!isLoading && !isError && rows.length > 0 && (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {rows.map((product) => (
                  <Card key={product.id} className="group p-4 transition-shadow hover:shadow-card-hover">
                    <div className="flex items-start gap-3">
                      <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-border/70 bg-surface text-lg font-semibold text-muted-foreground">
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          product.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {product.name}
                          </p>
                          {!product.is_active && (
                            <Badge variant="muted" className="shrink-0">Inactive</Badge>
                          )}
                        </div>
                        <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                          {product.sku}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          {product.category && (
                            <Badge variant="secondary" className="text-[10px]">{product.category}</Badge>
                          )}
                          {product.brand && (
                            <Badge variant="outline" className="text-[10px]">{product.brand}</Badge>
                          )}
                          {product.has_variants && (
                            <Badge variant="outline" className="gap-1 text-[10px]">
                              <Split className="h-3 w-3" /> {product.variants?.length} variants
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-3">
                      <p className="text-base font-bold text-foreground">
                        {formatCurrency(product.selling_price)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Cost {formatCurrency(product.cost_price)}
                      </p>
                    </div>
                  </Card>
                ))}
              </div>

              {meta && meta.last_page > 1 && (
                <div className="mt-6 flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1 || isFetching}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <span className="px-2 text-xs text-muted-foreground">
                    Page {meta.current_page} of {meta.last_page} · {meta.total} products
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= meta.last_page || isFetching}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}

          {isFetching && !isLoading && (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-32 w-full rounded-2xl" />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="categories">
          <EmptyState
            title="Categories"
            description="Category management will be wired to GET /product-categories."
          />
        </TabsContent>

        <TabsContent value="brands">
          <EmptyState
            title="Brands"
            description="Brand management will be wired to GET /product-brands."
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}