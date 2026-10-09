import { ModulePage } from '@/pages/module/module-page'

export function SuppliersPage() {
  return (
    <ModulePage
      title="Suppliers"
      description="Manage supplier profiles, purchases, balances and payments."
      workflows={[
        {
          title: 'Supplier list',
          description: 'Directory with outstanding balances.',
          endpoints: ['GET /suppliers'],
        },
        {
          title: 'Create / edit supplier',
          description: 'Contact and details registration.',
          endpoints: ['POST /suppliers', 'PUT /suppliers/{id}'],
        },
        {
          title: 'Purchase history',
          description: 'Everything purchased from the supplier.',
          endpoints: ['GET /suppliers/{id}/purchases'],
        },
        {
          title: 'Payment history',
          description: 'Payments made to the supplier.',
          endpoints: ['GET /suppliers/{id}/payments'],
        },
        {
          title: 'Outstanding balance',
          description: 'Authoritative balances computed by Laravel.',
          endpoints: ['GET /suppliers/{id}'],
        },
      ]}
    />
  )
}