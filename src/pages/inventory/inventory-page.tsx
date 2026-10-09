import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Sparkles } from 'lucide-react'
import { ModulePage } from '@/pages/module/module-page'

export function InventoryPage() {
  return (
    <ModulePage
      title="Inventory"
      description="Track stock levels, movements and quality across all branches."
      workflows={[
        {
          title: 'Stock levels',
          description: 'Real-time branch stock with low-stock and out-of-stock indicators.',
          endpoints: ['GET /inventory/levels', 'GET /inventory/dashboard'],
        },
        {
          title: 'Stock movements',
          description: 'Inbound, outbound, adjustments, transfers, damage and expiry.',
          endpoints: ['GET /inventory/movements'],
        },
        {
          title: 'Stock adjustment',
          description: 'Submit adjustments; the backend validates and vets counts.',
          endpoints: ['POST /inventory/adjustments'],
        },
        {
          title: 'Stock transfers',
          description: 'Source → destination branch transfers with status tracking.',
          endpoints: ['POST /inventory/transfers', 'GET /inventory/transfers'],
        },
        {
          title: 'Goods received',
          description: 'Receipt of purchase orders and supplier deliveries.',
          endpoints: ['POST /inventory/goods-received'],
        },
        {
          title: 'Damaged & expired stock',
          description: 'Flag unsellable stock for backend classification.',
          endpoints: ['GET /inventory/damaged', 'GET /inventory/expired'],
        },
        {
          title: 'Inventory approvals',
          description: 'Physical-confirmation queue when inventory confirmation is enabled.',
          endpoints: ['GET /inventory/approvals', 'POST /inventory/approvals/{id}'],
        },
      ]}
      actions={
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="levels">Levels</TabsTrigger>
            <TabsTrigger value="movements">Movements</TabsTrigger>
          </TabsList>
        </Tabs>
      }
    >
      <div className="mb-6 flex items-center gap-2 rounded-xl border border-info/20 bg-info/5 px-4 py-3">
        <Sparkles className="h-4 w-4 text-info" />
        <p className="text-xs text-info">
          The Inventory module is wired to its backend endpoints and ready for screen build-out.
        </p>
      </div>
    </ModulePage>
  )
}