import { ModulePage } from '@/pages/module/module-page'

export function FinancePage() {
  return (
    <ModulePage
      title="Finance"
      description="Payment confirmation, approvals and reconciliation. Approval actions respect backend permissions."
      workflows={[
        {
          title: 'Finance queue',
          description:
            'Sale reference, customer, amount, method, bank reference, match result, branch, rep and timestamp.',
          endpoints: ['GET /finance/approvals'],
        },
        {
          title: 'Payment confirmation',
          description: 'Manual confirmation and automatic bank/API matching represented side by side.',
          endpoints: ['POST /finance/approvals/{id}'],
        },
        {
          title: 'Automatic matching',
          description: 'Bank reference matching results supplied by the backend.',
          endpoints: ['GET /finance/approvals?status='],
        },
        {
          title: 'Reconciliation',
          description: 'Reconciled vs unmatched transactions.',
          endpoints: ['GET /finance/reconciliation'],
        },
        {
          title: 'Receivables & payables',
          description: 'Balances and ageing provided authoritatively.',
          endpoints: ['GET /finance/receivables-summary', 'GET /finance/payables-summary'],
        },
      ]}
    />
  )
}