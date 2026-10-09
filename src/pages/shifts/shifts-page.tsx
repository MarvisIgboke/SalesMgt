import { ModulePage } from '@/pages/module/module-page'

export function ShiftsPage() {
  return (
    <ModulePage
      title="Shifts"
      description="Open, close and reconcile cash for shifts. Expected cash and variance come from Laravel."
      workflows={[
        {
          title: 'Active shift',
          description: 'Current shift status and live totals.',
          endpoints: ['GET /shifts/current'],
        },
        {
          title: 'Open / close shift',
          description: 'Open with opening cash; close with cash reconciliation.',
          endpoints: ['POST /shifts/open', 'POST /shifts/close'],
        },
        {
          title: 'Cash reconciliation',
          description: 'Expected vs actual cash with variance back from the backend.',
          endpoints: ['POST /shifts/reconcile'],
        },
        {
          title: 'Shift history',
          description: 'Historical shifts with status filter.',
          endpoints: ['GET /shifts'],
        },
        {
          title: 'Shift settings',
          description: 'Enable/disable shift enforcement per business.',
          endpoints: ['GET /shifts/config', 'PUT /shifts/config'],
        },
      ]}
    />
  )
}