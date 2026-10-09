import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, ShieldPlus, UserPlus, Users } from 'lucide-react'
import {
  staffApi,
  type Role,
  type StaffInput,
  type StaffMember,
} from '@/lib/api/endpoints/staff'
import { PageHeader } from '@/components/common/page-header'
import { SearchInput } from '@/components/common/search-input'
import { Pagination } from '@/components/common/pagination'
import { LoadingState } from '@/components/common/loading-state'
import { ErrorState } from '@/components/common/error-state'
import { EmptyState } from '@/components/common/empty-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAppStore } from '@/stores/app'
import { formatRelative, initials } from '@/lib/utils'
import { toast } from '@/components/ui/sonner'
import { ApiError } from '@/lib/api/errors'

export function StaffPage() {
  const branches = useAppStore((s) => s.branches)
  const [tab, setTab] = useState('members')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<StaffMember | null>(null)
  const [memberOpen, setMemberOpen] = useState(false)
  const [roleOpen, setRoleOpen] = useState(false)

  const { data, isFetching, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['staff', { search, page }],
    queryFn: () => staffApi.list({ search: search || undefined, page, per_page: 12 }),
    placeholderData: (prev) => prev,
  })

  const roles = useQuery({
    queryKey: ['staff', 'roles'],
    queryFn: () => staffApi.roles(),
    placeholderData: (prev) => prev,
  })

  const members = data?.data ?? []
  const meta = data?.meta
  const roleList = roles.data?.data ?? []

  const branchLabel = (id: number) => branches.find((branch) => branch.id === id)?.name ?? `#${id}`

  const openCreate = () => {
    setEditing(null)
    setMemberOpen(true)
  }

  const openEdit = (member: StaffMember) => {
    setEditing(member)
    setMemberOpen(true)
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Staff"
        description="Team members, roles and access across your branches."
      >
        {tab === 'members' ? (
          <Button size="sm" onClick={openCreate}>
            <UserPlus className="h-4 w-4" />
            Add member
          </Button>
        ) : (
          <Button size="sm" onClick={() => setRoleOpen(true)}>
            <ShieldPlus className="h-4 w-4" />
            New role
          </Button>
        )}
      </PageHeader>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
        </TabsList>

        <TabsContent value="members">
          <SearchInput
            placeholder="Search name, email, phone…"
            className="mb-4"
            onSearch={(value) => {
              setPage(1)
              setSearch(value)
            }}
          />

          {isLoading && <LoadingState variant="table" rows={8} />}
          {isError && <ErrorState error={error} onRetry={() => refetch()} />}

          {!isLoading && !isError && members.length === 0 && (
            <EmptyState
              title="No staff found"
              description="Try adjusting your search, or add your first team member."
              icon={<Users className="h-6 w-6" />}
              action={
                <Button variant="outline" size="sm" onClick={openCreate}>
                  Add member
                </Button>
              }
            />
          )}

          {!isLoading && !isError && members.length > 0 && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead>Branches</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback>{initials(member.name)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {member.name}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {member.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {member.phone || '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {member.roles.length === 0 ? (
                            <span className="text-sm text-muted-foreground">—</span>
                          ) : (
                            member.roles.map((role) => (
                              <Badge key={role} variant="secondary">
                                {role}
                              </Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {member.branch_ids.length === 0
                          ? '—'
                          : member.branch_ids.map(branchLabel).join(', ')}
                      </TableCell>
                      <TableCell>
                        <Badge variant={member.is_active ? 'success' : 'muted'}>
                          {member.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatRelative(member.last_active_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openEdit(member)}
                        >
                          <span className="sr-only">Edit member</span>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Pagination
                page={meta?.current_page ?? page}
                lastPage={meta?.last_page ?? 1}
                total={meta?.total}
                totalLabel="staff"
                isFetching={isFetching}
                onPageChange={setPage}
              />
            </>
          )}
        </TabsContent>

        <TabsContent value="roles">
          {roles.isLoading && <LoadingState variant="cards" rows={6} />}
          {roles.isError && (
            <ErrorState error={roles.error} onRetry={() => roles.refetch()} />
          )}

          {!roles.isLoading && !roles.isError && roleList.length === 0 && (
            <EmptyState
              title="No roles yet"
              description="Create a custom role to group permissions for your team."
              icon={<ShieldPlus className="h-6 w-6" />}
              action={
                <Button variant="outline" size="sm" onClick={() => setRoleOpen(true)}>
                  New role
                </Button>
              }
            />
          )}

          {!roles.isLoading && !roles.isError && roleList.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {roleList.map((role) => (
                <RoleCard key={role.id} role={role} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {memberOpen && (
        <MemberDialog member={editing} onClose={() => setMemberOpen(false)} />
      )}

      {roleOpen && <RoleDialog onClose={() => setRoleOpen(false)} />}
    </div>
  )
}

function RoleCard({ role }: { role: Role }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">{role.name}</p>
        {role.is_custom && <Badge variant="outline">Custom</Badge>}
      </div>
      {role.description && (
        <p className="mt-1 text-xs text-muted-foreground">{role.description}</p>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        {role.permissions.length} permissions
      </p>
    </div>
  )
}

function MemberDialog({
  member,
  onClose,
}: {
  member: StaffMember | null
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const branches = useAppStore((s) => s.branches)
  const [name, setName] = useState(member?.name ?? '')
  const [email, setEmail] = useState(member?.email ?? '')
  const [phone, setPhone] = useState(member?.phone ?? '')
  const [password, setPassword] = useState('')
  const [selectedRoles, setSelectedRoles] = useState<string[]>(member?.roles ?? [])
  const [selectedBranches, setSelectedBranches] = useState<number[]>(
    member?.branch_ids ?? [],
  )

  const roles = useQuery({
    queryKey: ['staff', 'roles'],
    queryFn: () => staffApi.roles(),
    placeholderData: (prev) => prev,
  })

  const save = useMutation({
    mutationFn: (input: StaffInput) =>
      member ? staffApi.update(member.id, input) : staffApi.create(input),
    onSuccess: () => {
      toast.success(member ? 'Member updated' : 'Member created')
      onClose()
      void queryClient.invalidateQueries({ queryKey: ['staff'] })
    },
    onError: (err) => {
      toast.error(member ? 'Could not update member' : 'Could not create member', {
        description: err instanceof ApiError ? err.message : undefined,
      })
    },
  })

  const toggleRole = (value: string) => {
    setSelectedRoles((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value],
    )
  }

  const toggleBranch = (value: number) => {
    setSelectedBranches((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value],
    )
  }

  const submit = () => {
    const input: StaffInput = {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim() || undefined,
      roles: selectedRoles,
      branch_ids: selectedBranches,
    }
    if (!member && password.trim()) {
      input.password = password.trim()
    }
    save.mutate(input)
  }

  const canSave = name.trim().length > 0 && email.trim().length > 0

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{member ? 'Edit member' : 'Add member'}</DialogTitle>
          <DialogDescription>
            Access is enforced server-side. Changes apply on the next request.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="staff-name">Name</Label>
            <Input
              id="staff-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Amina Bello"
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="staff-email">Email</Label>
            <Input
              id="staff-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@business.com"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="staff-phone">Phone</Label>
            <Input
              id="staff-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+234 800 000 0000"
            />
          </div>
          {!member && (
            <div className="grid gap-2">
              <Label htmlFor="staff-password">Initial password</Label>
              <Input
                id="staff-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Set a temporary password"
              />
            </div>
          )}
          <div className="grid gap-2">
            <Label>Roles</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {(roles.data?.data ?? []).map((role) => (
                <label key={role.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedRoles.includes(role.name)}
                    onChange={() => toggleRole(role.name)}
                  />
                  {role.name}
                </label>
              ))}
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Branches</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {branches.map((branch) => (
                <label key={branch.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedBranches.includes(branch.id)}
                    onChange={() => toggleBranch(branch.id)}
                  />
                  {branch.name}
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" loading={save.isPending} disabled={!canSave} onClick={submit}>
            {member ? 'Save changes' : 'Add member'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RoleDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [checked, setChecked] = useState<string[]>([])

  const permissions = useQuery({
    queryKey: ['staff', 'permissions'],
    queryFn: () => staffApi.permissions(),
    placeholderData: (prev) => prev,
  })

  const groups = (permissions.data?.data ?? []).reduce<
    Map<string, Array<{ key: string; label: string }>>
  >((acc, permission) => {
    const list = acc.get(permission.group) ?? []
    list.push({ key: permission.key, label: permission.label })
    acc.set(permission.group, list)
    return acc
  }, new Map())

  const create = useMutation({
    mutationFn: () =>
      staffApi.createRole({
        name: name.trim(),
        description: description.trim() || undefined,
        permissions: checked,
      }),
    onSuccess: () => {
      toast.success('Role created')
      onClose()
      void queryClient.invalidateQueries({ queryKey: ['staff', 'roles'] })
    },
    onError: (err) => {
      toast.error('Could not create role', {
        description: err instanceof ApiError ? err.message : undefined,
      })
    },
  })

  const toggle = (value: string) => {
    setChecked((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value],
    )
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New role</DialogTitle>
          <DialogDescription>
            Pick the permissions this role grants. Rules are enforced by the backend.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="role-name">Name</Label>
            <Input
              id="role-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Branch supervisor"
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="role-description">Description</Label>
            <Input
              id="role-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional summary of this role"
            />
          </div>
          <div className="grid gap-2">
            <Label>Permissions</Label>
            <ScrollArea className="h-64 pr-4">
              <div className="grid gap-4">
                {Array.from(groups.entries()).map(([group, items]) => (
                  <div key={group} className="grid gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {group}
                    </p>
                    <div className="grid gap-2">
                      {items.map((permission) => (
                        <label
                          key={permission.key}
                          className="flex items-center gap-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={checked.includes(permission.key)}
                            onChange={() => toggle(permission.key)}
                          />
                          {permission.label}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            loading={create.isPending}
            disabled={!name.trim()}
            onClick={() => create.mutate()}
          >
            Create role
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
