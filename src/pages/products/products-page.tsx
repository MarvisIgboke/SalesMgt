import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Barcode,
  Loader2,
  MoreHorizontal,
  PackagePlus,
  Pencil,
  Plus,
  Split,
  Trash2,
  X,
} from 'lucide-react'
import {
  productsApi,
  type Product,
  type ProductInput,
} from '@/lib/api/endpoints/products'
import { useAppStore } from '@/stores/app'
import { PageHeader } from '@/components/common/page-header'
import { SearchInput } from '@/components/common/search-input'
import { Pagination } from '@/components/common/pagination'
import { LoadingState } from '@/components/common/loading-state'
import { ErrorState } from '@/components/common/error-state'
import { EmptyState } from '@/components/common/empty-state'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatCurrency } from '@/lib/utils'
import { toast } from '@/components/ui/sonner'
import { ApiError } from '@/lib/api/errors'

interface ProductFormState {
  name: string
  sku: string
  brand: string
  category: string
  unit: string
  cost_price: string
  selling_price: string
  tax_rate: string
  requires_expiry: boolean
  is_active: boolean
  barcodes: string
}

const EMPTY_FORM: ProductFormState = {
  name: '',
  sku: '',
  brand: '',
  category: '',
  unit: '',
  cost_price: '',
  selling_price: '',
  tax_rate: '',
  requires_expiry: false,
  is_active: true,
  barcodes: '',
}

function toForm(product: Product): ProductFormState {
  return {
    name: product.name,
    sku: product.sku ?? '',
    brand: product.brand ?? '',
    category: product.category ?? '',
    unit: product.unit ?? '',
    cost_price: product.cost_price ? String(product.cost_price) : '',
    selling_price: product.selling_price ? String(product.selling_price) : '',
    tax_rate: product.tax_rate != null ? String(product.tax_rate) : '',
    requires_expiry: product.requires_expiry,
    is_active: product.is_active,
    barcodes: '',
  }
}

function parseBarcodes(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/[\n,]+/)
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  )
}

export function ProductsPage() {
  const queryClient = useQueryClient()
  const branchId = useAppStore((s) => s.context?.branch?.id)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState<ProductFormState>(EMPTY_FORM)
  const [deleting, setDeleting] = useState<Product | null>(null)
  const [barcoding, setBarcoding] = useState<Product | null>(null)

  const { data, isFetching, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['products', { search, page, branchId }],
    queryFn: () =>
      productsApi.list({
        search: search || undefined,
        page,
        per_page: 12,
        branch_id: branchId,
      }),
    placeholderData: (prev) => prev,
  })

  const categories = useQuery({
    queryKey: ['products', 'categories'],
    queryFn: () => productsApi.categories(),
    placeholderData: (prev) => prev,
  })

  const brands = useQuery({
    queryKey: ['products', 'brands'],
    queryFn: () => productsApi.brands(),
    placeholderData: (prev) => prev,
  })

  const remove = useMutation({
    mutationFn: (id: number) => productsApi.remove(id),
    onSuccess: () => {
      toast.success('Product deleted')
      setDeleting(null)
      void queryClient.invalidateQueries({ queryKey: ['products'] })
    },
    onError: (err) => {
      toast.error('Could not delete product', {
        description: err instanceof ApiError ? err.message : undefined,
      })
    },
  })

  const meta = data?.meta
  const rows = data?.data ?? []

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setEditorOpen(true)
  }

  const openEdit = (product: Product) => {
    setEditing(product)
    setForm(toForm(product))
    setEditorOpen(true)
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Products"
        description="Catalogue, variants, barcodes and pricing. Prices are authoritative from the backend."
      >
        <Button size="sm" onClick={openCreate}>
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
          <SearchInput
            placeholder="Search name, SKU, barcode, brand…"
            className="mb-4"
            onSearch={(value) => {
              setPage(1)
              setSearch(value)
            }}
          />

          {isLoading && <LoadingState rows={6} />}
          {isError && <ErrorState error={error} onRetry={() => refetch()} />}

          {!isLoading && !isError && rows.length === 0 && (
            <EmptyState
              title="No products found"
              description="Try adjusting your search, or add a product."
              icon={<PackagePlus className="h-6 w-6" />}
              action={
                <Button variant="outline" size="sm" onClick={openCreate}>
                  New product
                </Button>
              }
            />
          )}

          {!isLoading && !isError && rows.length > 0 && (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {rows.map((product) => (
                  <Card
                    key={product.id}
                    className="group relative p-4 transition-shadow hover:shadow-card-hover"
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="absolute right-2.5 top-2.5 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                        >
                          <span className="sr-only">Product actions</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(product)}>
                          <Pencil className="h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setBarcoding(product)}>
                          <Barcode className="h-4 w-4" />
                          Manage barcodes
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setDeleting(product)}
                          className="!text-destructive focus:!bg-destructive/10 focus:!text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <div className="flex items-start gap-3 pr-8">
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
                          {product.barcodes.length > 0 && (
                            <Badge variant="outline" className="gap-1 text-[10px]">
                              <Barcode className="h-3 w-3" /> {product.barcodes.length}
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

              <Pagination
                page={meta?.current_page ?? page}
                lastPage={meta?.last_page ?? 1}
                total={meta?.total}
                totalLabel="products"
                isFetching={isFetching}
                onPageChange={setPage}
              />
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
          {categories.isLoading && <LoadingState rows={4} />}
          {categories.isError && <ErrorState error={categories.error} onRetry={() => categories.refetch()} />}
          {categories.data?.data && categories.data.data.length === 0 && (
            <EmptyState title="No categories yet" description="Add categories in the backend." />
          )}
          {categories.data?.data && categories.data.data.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {categories.data.data.map((category) => (
                <Badge key={category.id} variant="secondary" className="px-3 py-1.5 text-sm">
                  {category.name}
                </Badge>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="brands">
          {brands.isLoading && <LoadingState rows={4} />}
          {brands.isError && <ErrorState error={brands.error} onRetry={() => brands.refetch()} />}
          {brands.data?.data && brands.data.data.length === 0 && (
            <EmptyState title="No brands yet" description="Add brands in the backend." />
          )}
          {brands.data?.data && brands.data.data.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {brands.data.data.map((brand) => (
                <Badge key={brand.id} variant="outline" className="px-3 py-1.5 text-sm">
                  {brand.name}
                </Badge>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {editorOpen && (
        <ProductEditorDialog
          product={editing}
          form={form}
          onChange={setForm}
          categories={categories.data?.data ?? []}
          brands={brands.data?.data ?? []}
          onClose={() => setEditorOpen(false)}
        />
      )}

      {barcoding && <BarcodesDialog product={barcoding} onClose={() => setBarcoding(null)} />}

      {deleting && (
        <Dialog open onOpenChange={() => setDeleting(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Delete product</DialogTitle>
              <DialogDescription>
                <span className="font-medium text-foreground">{deleting.name}</span> will be
                permanently removed. History may keep references to it.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setDeleting(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="destructive"
                loading={remove.isPending}
                onClick={() => remove.mutate(deleting.id)}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

interface ProductEditorDialogProps {
  product: Product | null
  form: ProductFormState
  onChange: (form: ProductFormState) => void
  categories: Array<{ id: number; name: string }>
  brands: Array<{ id: number; name: string }>
  onClose: () => void
}

function ProductEditorDialog({
  product,
  form,
  onChange,
  categories,
  brands,
  onClose,
}: ProductEditorDialogProps) {
  const queryClient = useQueryClient()
  const set = (patch: Partial<ProductFormState>) => onChange({ ...form, ...patch })

  const save = useMutation({
    mutationFn: (input: ProductInput) =>
      product ? productsApi.update(product.id, input) : productsApi.create(input),
    onSuccess: () => {
      toast.success(product ? 'Product updated' : 'Product created')
      onClose()
      void queryClient.invalidateQueries({ queryKey: ['products'] })
      void queryClient.invalidateQueries({ queryKey: ['pos'] })
    },
    onError: (err) => {
      toast.error('Could not save product', {
        description: err instanceof ApiError ? err.message : undefined,
      })
    },
  })

  const categoryOptions = uniqueOptions(form.category, categories)
  const brandOptions = uniqueOptions(form.brand, brands)
  const valid = form.name.trim().length > 0

  const submit = () => {
    const input: ProductInput = {
      name: form.name.trim(),
      sku: form.sku.trim() || undefined,
      brand: form.brand || undefined,
      category: form.category || undefined,
      unit: form.unit.trim() || undefined,
      cost_price: form.cost_price ? Number(form.cost_price) : undefined,
      selling_price: form.selling_price ? Number(form.selling_price) : undefined,
      tax_rate: form.tax_rate ? Number(form.tax_rate) : null,
      requires_expiry: form.requires_expiry,
      is_active: form.is_active,
    }
    if (!product) input.barcodes = parseBarcodes(form.barcodes)
    save.mutate(input)
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{product ? 'Edit product' : 'New product'}</DialogTitle>
          <DialogDescription>
            Catalogue data lives on the backend. Pricing, tax and barcode validation are enforced
            by Laravel.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="product-name">Name</Label>
            <Input
              id="product-name"
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="e.g. Peak Milk 850g"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="product-sku">SKU</Label>
              <Input
                id="product-sku"
                value={form.sku}
                onChange={(e) => set({ sku: e.target.value })}
                placeholder="Auto if empty"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="product-unit">Unit</Label>
              <Input
                id="product-unit"
                value={form.unit}
                onChange={(e) => set({ unit: e.target.value })}
                placeholder="e.g. pack, kg"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Category</Label>
              <Select
                value={form.category}
                onValueChange={(v) => set({ category: v === '__none' ? '' : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">None</SelectItem>
                  {categoryOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Brand</Label>
              <Select
                value={form.brand}
                onValueChange={(v) => set({ brand: v === '__none' ? '' : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">None</SelectItem>
                  {brandOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="product-cost">Cost (₦)</Label>
              <Input
                id="product-cost"
                type="number"
                min={0}
                step="0.01"
                value={form.cost_price}
                onChange={(e) => set({ cost_price: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="product-price">Selling (₦)</Label>
              <Input
                id="product-price"
                type="number"
                min={0}
                step="0.01"
                value={form.selling_price}
                onChange={(e) => set({ selling_price: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="product-tax">Tax rate %</Label>
              <Input
                id="product-tax"
                type="number"
                min={0}
                step="0.01"
                value={form.tax_rate}
                onChange={(e) => set({ tax_rate: e.target.value })}
                placeholder="e.g. 7.5"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">Requires expiry tracking</p>
                <p className="text-xs text-muted-foreground">Batch/expiry enforced by the backend.</p>
              </div>
              <Switch
                checked={form.requires_expiry}
                onCheckedChange={(next) => set({ requires_expiry: next })}
              />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">Active</p>
                <p className="text-xs text-muted-foreground">Hidden from POS when inactive.</p>
              </div>
              <Switch checked={form.is_active} onCheckedChange={(next) => set({ is_active: next })} />
            </div>
          </div>

          {!product && (
            <div className="grid gap-2">
              <Label htmlFor="product-barcodes">Barcodes</Label>
              <Input
                id="product-barcodes"
                value={form.barcodes}
                onChange={(e) => set({ barcodes: e.target.value })}
                placeholder="One per line or comma separated"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" loading={save.isPending} disabled={!valid} onClick={submit}>
            {product ? 'Save changes' : 'Create product'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function BarcodesDialog({ product, onClose }: { product: Product; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [barcode, setBarcode] = useState('')

  const add = useMutation({
    mutationFn: (value: string) => productsApi.addBarcode(product.id, value),
    onSuccess: () => {
      toast.success('Barcode added')
      setBarcode('')
      void queryClient.invalidateQueries({ queryKey: ['products'] })
    },
    onError: (err) => {
      toast.error('Could not add barcode', {
        description: err instanceof ApiError ? err.message : undefined,
      })
    },
  })

  const remove = useMutation({
    mutationFn: (barcode: string | number) => productsApi.removeBarcode(product.id, barcode),
    onSuccess: () => {
      toast.success('Barcode removed')
      void queryClient.invalidateQueries({ queryKey: ['products'] })
    },
    onError: (err) => {
      toast.error('Could not remove barcode', {
        description: err instanceof ApiError ? err.message : undefined,
      })
    },
  })

  const submit = () => {
    const value = barcode.trim()
    if (!value) return
    add.mutate(value)
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Barcodes — {product.name}</DialogTitle>
          <DialogDescription>Scan codes that map to this product in the backend.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {product.barcodes.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">
              No barcodes yet.
            </p>
          ) : (
            product.barcodes.map((code) => (
              <div
                key={code}
                className="flex items-center justify-between gap-3 rounded-xl border border-border/70 px-4 py-2.5"
              >
                <span className="font-mono text-sm text-foreground">{code}</span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => remove.mutate(code)}
                  disabled={remove.isPending}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}

          <div className="flex items-center gap-2">
            <Input
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="Scan or type a barcode"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  submit()
                }
              }}
            />
            <Button size="icon" onClick={submit} disabled={add.isPending || !barcode.trim()}>
              {add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function uniqueOptions(current: string, options: Array<{ id: number; name: string }>) {
  const seen = new Set<string>()
  const result: Array<{ value: string; label: string }> = []
  const push = (value: string) => {
    const trimmed = value.trim()
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed)
      result.push({ value: trimmed, label: trimmed })
    }
  }
  if (current && current !== '__none') push(current)
  for (const option of options) push(option.name)
  return result
}