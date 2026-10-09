import { ModulePage } from '@/pages/module/module-page'

export function SubscriptionPage() {
  return (
    <ModulePage
      title="Subscription"
      description="Plan status, limits and billing. Subscription enforcement is done entirely by the backend."
      workflows={[
        {
          title: 'Current subscription',
          description: 'Plan, status, expiry and usage limits.',
          endpoints: ['GET /subscription'],
        },
        {
          title: 'Plans',
          description: 'Available plans from the backend.',
          endpoints: ['GET /subscription/plans'],
        },
        {
          title: 'Wallet',
          description: 'Wallet balance and transactions.',
          endpoints: ['GET /wallet', 'GET /wallet/transactions'],
        },
      ]}
    />
  )
}