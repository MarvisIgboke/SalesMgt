import { Button } from '@/components/ui/button'
import { formatNumber } from '@/lib/utils'

interface PaginationProps {
  page: number
  lastPage: number
  total?: number
  totalLabel?: string
  isFetching?: boolean
  onPageChange: (page: number) => void
}

export function Pagination({
  page,
  lastPage,
  total,
  totalLabel,
  isFetching,
  onPageChange,
}: PaginationProps) {
  if (lastPage <= 1) return null

  return (
    <div className="mt-6 flex items-center justify-center gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1 || isFetching}
        onClick={() => onPageChange(page - 1)}
      >
        Previous
      </Button>
      <span className="px-2 text-xs text-muted-foreground">
        Page {page} of {lastPage}
        {total !== undefined && (
          <>
            {' '}
            · {formatNumber(total)}
            {totalLabel ? ` ${totalLabel}` : ''}
          </>
        )}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= lastPage || isFetching}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </Button>
    </div>
  )
}