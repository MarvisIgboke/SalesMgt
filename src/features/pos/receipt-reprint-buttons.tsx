import { useState } from 'react'
import { FileText, Loader2, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { posApi } from '@/lib/api/endpoints/pos'
import { ApiError } from '@/lib/api/errors'
import { toast } from '@/components/ui/sonner'
import { cn } from '@/lib/utils'
import { downloadReceiptPdf, thermalPrint } from './receipt-actions'

type Action = 'print' | 'pdf'

export function ReceiptReprintButtons({
  saleReference,
  className,
}: {
  saleReference: string
  className?: string
}) {
  const [pending, setPending] = useState<Action | null>(null)

  const run = async (action: Action) => {
    setPending(action)
    try {
      const { data } = await posApi.getReceipt(saleReference)
      if (action === 'print') {
        if (!thermalPrint(data)) toast.error('Allow pop-ups to print the receipt.')
      } else {
        downloadReceiptPdf(data)
        toast.success('Receipt PDF downloaded.')
      }
    } catch (error) {
      toast.error('Could not load the receipt', {
        description: error instanceof ApiError ? error.message : undefined,
      })
    } finally {
      setPending(null)
    }
  }

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <Button
        variant="outline"
        size="icon-sm"
        aria-label="Print receipt"
        title="Print receipt"
        disabled={pending !== null}
        onClick={() => void run('print')}
      >
        {pending === 'print' ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Printer className="h-3.5 w-3.5" />
        )}
      </Button>
      <Button
        variant="outline"
        size="icon-sm"
        aria-label="Download receipt PDF"
        title="Download receipt PDF"
        disabled={pending !== null}
        onClick={() => void run('pdf')}
      >
        {pending === 'pdf' ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <FileText className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  )
}
