import { ModulePage } from '@/pages/module/module-page'

export function StaffPage() {
  return (
    <ModulePage
      title="Staff"
      description="People, roles, permissions, branches and activity. Laravel remains the authoritative permission layer."
      workflows={[
        {
          title: 'Staff directory',
          description: 'Active/inactive staff with role and branch assignments.',
          endpoints: ['GET /staff'],
        },
        {
          title: 'Roles & permissions',
          description: 'Default and custom roles. Permission checks here are UX-only.',
          endpoints: ['GET /staff/roles', 'GET /staff/permissions', 'POST /staff/roles'],
        },
        {
          title: 'Branch assignments',
          description: 'Assign staff across branches.',
          endpoints: ['PUT /staff/{id}'],
        },
        {
          title: 'Activity log',
          description: 'Audit trail of staff actions.',
          endpoints: ['GET /staff/activity'],
        },
        {
          title: 'Sessions',
          description: 'Active device sessions with revocation.',
          endpoints: ['GET /staff/sessions', 'DELETE /staff/sessions/{id}'],
        },
      ]}
    />
  )
}