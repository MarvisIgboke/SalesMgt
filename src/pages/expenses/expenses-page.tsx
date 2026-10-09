import { ModulePage } from '@/pages/module/module-page'

export function ExpensesPage() {
  return (
    <ModulePage
      title="Expenses"
      description="Record, approve and analyse business expenses."
      workflows={[
        {
          title: 'Expense dashboard',
          description: 'Totals, category breakdown and pending approvals.',
          endpoints: ['GET /expenses/dashboard'],
        },
        {
          title: 'Create expense',
          description: 'Submit expenses with category, amount and branch.',
          endpoints: ['POST /expenses'],
        },
        {
          title: 'Pending approvals',
          description: 'Decision queue; actions shown only when permitted.',
          endpoints: ['GET /expenses/approvals', 'POST /expenses/{id}/decision'],
        },
        {
          title: 'Expense history',
          description: 'Filterable history across all branches.',
          endpoints: ['GET /expenses'],
        },
        {
          title: 'Categories',
          description: 'Expense categories for consistent reporting.',
          endpoints: ['GET /expenses/categories'],
        },
      ]}
    />
  )
}