import { ModulePage } from '@/pages/module/module-page'

export function ExpiryPage() {
  return (
    <ModulePage
      title="Expiry Manager"
      description="Monitor expired and expiring batches. All expiry calculations are performed by the backend."
      workflows={[
        {
          title: 'Expiry dashboard',
          description: 'Buckets: expired, today, 3 / 7 / 14 / 30 / 60 / 90 days.',
          endpoints: ['GET /expiry/dashboard', 'GET /expiry/buckets'],
        },
        {
          title: 'Expiry items table',
          description: 'Batch, branch, quantity, days remaining, risk and recommended action.',
          endpoints: ['GET /expiry/items'],
        },
        {
          title: 'Risk classification',
          description: 'Risk levels and recommended actions returned authoritatively by Laravel.',
          endpoints: ['GET /expiry/items?window=&status='],
        },
      ]}
    />
  )
}