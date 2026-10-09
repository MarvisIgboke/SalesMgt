import { ModulePage } from '@/pages/module/module-page'

export function WalletPage() {
  return (
    <ModulePage
      title="Wallet"
      description="Wallet balance and transactions as reported by the backend."
      workflows={[
        {
          title: 'Wallet summary',
          description: 'Authoritative balance and pending amounts.',
          endpoints: ['GET /wallet'],
        },
        {
          title: 'Transaction history',
          description: 'Credits, debits and pending items.',
          endpoints: ['GET /wallet/transactions'],
        },
      ]}
    />
  )
}