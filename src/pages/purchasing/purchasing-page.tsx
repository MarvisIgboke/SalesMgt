import { ModulePage } from '@/pages/module/module-page'

export function PurchasingPage() {
  return (
    <ModulePage
      title="Purchasing"
      description="Purchase requisitions, purchase orders, receipts, supplier invoices and returns."
      workflows={[
        {
          title: 'Purchase requisitions',
          description: 'Request stock replenishment for approval.',
          endpoints: ['GET /purchasing/requisitions', 'POST /purchasing/requisitions'],
        },
        {
          title: 'Purchase orders',
          description: 'Create and track orders with suppliers.',
          endpoints: ['GET /purchasing/orders', 'POST /purchasing/orders'],
        },
        {
          title: 'Goods received',
          description: 'Match deliveries against purchase orders.',
          endpoints: ['POST /inventory/goods-received'],
        },
        {
          title: 'Supplier invoices',
          description: 'Review invoices and matching to orders.',
          endpoints: ['GET /purchasing/invoices'],
        },
        {
          title: 'Supplier payments',
          description: 'Schedule and confirm payments to suppliers.',
          endpoints: ['GET /purchasing/payments'],
        },
        {
          title: 'Purchase returns',
          description: 'Process returns against receipts.',
          endpoints: ['GET /purchasing/returns'],
        },
      ]}
    />
  )
}