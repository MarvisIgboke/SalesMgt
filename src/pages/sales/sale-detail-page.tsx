import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ReceiptText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/common/status-badge'
import { ErrorState } from '@/components/common/error-state'
import { salesApi } from '@/lib/api/endpoints/sales'
import { formatDateTime } from '@/lib/utils'
import { SaleDetailBody } from './sale-detail-view'

export function SaleDetailPage() {
  const { id } = useParams()
  const saleId = Number(id)
  const valid = Number.isFinite(saleId) && saleId > 0
  const navigate = useNavigate()

  const detail = useQuery({
    queryKey: ['sales', saleId],
    queryFn: () => salesApi.get(saleId),
    enabled: valid,
  })
  const sale = detail.data?.data

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-start gap-2.5">
        <Button variant="ghost" size="icon" aria-label="Back" onClick={() => navigate(-1)}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-primary">
            <ReceiptText className="h-3 w-3" />
            Transaction
          </p>
          <h1 className="flex items-center gap-2 truncate text-lg font-bold tracking-tight text-foreground">
            {sale?.reference ?? (valid ? `Sale #${saleId}` : 'Sale')}
            {sale && <StatusBadge status={sale.status} />}
          </h1>
          {sale && (
            <p className="truncate text-[11px] text-muted-foreground">
              {formatDateTime(sale.created_at)}
            </p>
          )}
        </div>
      </div>

      {valid ? (
        <SaleDetailBody saleId={saleId} />
      ) : (
        <ErrorState title="Invalid sale" />
      )}
    </div>
  )
}
