import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CornerDownLeft, Package, Search, Store, User, X } from 'lucide-react'
import { searchApi, type SearchResult } from '@/lib/api/endpoints/search'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/app'

const typeMeta: Record<SearchResult['type'], { icon: typeof Store; route: string }> = {
  product: { icon: Package, route: '/products' },
  customer: { icon: User, route: '/customers' },
  sale: { icon: Store, route: '/finance' },
  supplier: { icon: Store, route: '/suppliers' },
  staff: { icon: User, route: '/staff' },
  branch: { icon: Store, route: '/settings' },
}

const typeLabel: Record<SearchResult['type'], string> = {
  product: 'Product',
  customer: 'Customer',
  sale: 'Sale',
  supplier: 'Supplier',
  staff: 'Staff',
  branch: 'Branch',
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const context = useAppStore((s) => s.context)

  const { data, isFetching } = useQuery({
    queryKey: ['global-search', query, context?.branch?.id],
    queryFn: () => searchApi.global(query),
    enabled: open && query.trim().length >= 2,
    staleTime: 15_000,
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && !isTyping(e.target)) {
        e.preventDefault()
        setOpen(true)
        setTimeout(() => inputRef.current?.focus(), 0)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const go = (result: SearchResult) => {
    const meta = typeMeta[result.type]
    const base = meta.route
    navigate(`${base}?focus=${result.id}`)
    setOpen(false)
    setQuery('')
  }

  const groups = data?.data.groups

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="group relative flex h-10 w-full max-w-md items-center gap-2 rounded-xl border border-input/80 bg-surface-sunken/50 px-3 text-left text-sm text-muted-foreground transition-colors hover:border-border hover:bg-surface-sunken"
          onClick={() => setOpen(true)}
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="flex-1 truncate">Search products, sales, people…</span>
          <kbd className="hidden items-center gap-0.5 rounded-md border border-border bg-surface px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:flex">
            /
          </kbd>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-[min(92vw,28rem)] p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex items-center gap-2 border-b border-border/70 px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, SKU, barcode, brand…"
            className="h-11 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
            autoFocus
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="rounded-lg p-1 text-muted-foreground hover:bg-accent"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto p-1.5">
          {isFetching && (
            <div className="space-y-2 p-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          )}

          {!isFetching && query.trim().length < 2 && (
            <p className="p-4 text-center text-xs text-muted-foreground">
              Type at least 2 characters to search.
            </p>
          )}

          {!isFetching && query.trim().length >= 2 && (!groups || groups.length === 0) && (
            <p className="p-4 text-center text-sm text-muted-foreground">No results found.</p>
          )}

          {!isFetching &&
            groups?.map((group) => (
              <div key={group.type} className="mb-1">
                {group.results.length > 0 && (
                  <>
                    <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                      {typeLabel[group.type] === 'Product' ? 'Products' : `${group.title}`}
                    </p>
                    {group.results.map((result) => {
                      const Icon = typeMeta[result.type].icon
                      return (
                        <button
                          key={`${result.type}-${result.id}`}
                          type="button"
                          onClick={() => go(result)}
                          className={cn(
                            'flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-accent',
                          )}
                        >
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border/70 bg-surface text-muted-foreground">
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-foreground">
                              {result.label}
                            </span>
                            {result.subtitle && (
                              <span className="block truncate text-xs text-muted-foreground">
                                {result.subtitle}
                              </span>
                            )}
                          </span>
                          <Badge variant="muted" className="shrink-0">
                            {typeLabel[result.type]}
                          </Badge>
                        </button>
                      )
                    })}
                  </>
                )}
              </div>
            ))}

          {!isFetching && groups && groups.some((g) => g.results.length > 0) && (
            <div className="flex items-center justify-end gap-1.5 border-t border-border/60 px-2 py-1.5 text-[10px] text-muted-foreground">
              <CornerDownLeft className="h-3 w-3" /> Enter to select
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function isTyping(target: EventTarget | null): boolean {
  if (!target) return false
  const el = target as HTMLElement
  return (
    el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    el.isContentEditable ||
    el.getAttribute('role') === 'textbox'
  )
}