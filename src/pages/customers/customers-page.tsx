import { useState } from 'react'
import { Plus } from 'lucide-react'
import { ModulePage } from '@/pages/module/module-page'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/sonner'

export function CustomersPage() {
  const [creating, setCreating] = useState(false)

  return (
    <ModulePage
      title="Customers"
      description="Manage customers, credit, statements and payment history."
      workflows={[
        {
          title: 'Customer list',
          description: 'Searchable customer directory with outstanding balances.',
          endpoints: ['GET /customers'],
        },
        {
          title: 'Create / edit customer',
          description: 'Registration form. Credit limits are enforced by the backend.',
          endpoints: ['POST /customers', 'PUT /customers/{id}'],
        },
        {
          title: 'Profile & account statement',
          description: 'Opening/closing balances and entry ledger supplied by Laravel.',
          endpoints: ['GET /customers/{id}', 'GET /customers/{id}/statement'],
        },
        {
          title: 'Purchase history',
          description: 'Customer purchases across all branches.',
          endpoints: ['GET /customers/{id}/purchases'],
        },
        {
          title: 'Payments',
          description: 'Record and review customer credit payments.',
          endpoints: ['POST /customer-payments', 'GET /customers/{id}/payments'],
        },
      ]}
      actions={
        <Button
          size="sm"
          onClick={() => {
            setCreating((v) => !v)
            if (!creating) {
              toast.info('Customer creation screen ships in the next build pass.')
            }
          }}
        >
          <Plus className="h-4 w-4" />
          New customer
        </Button>
      }
    />
  )
}