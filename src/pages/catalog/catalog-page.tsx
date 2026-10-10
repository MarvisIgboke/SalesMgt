import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Pencil, Plus, Tags, Trash2, X } from 'lucide-react'
import { PageHeader } from '@/components/common/page-header'
import { LoadingState } from '@/components/common/loading-state'
import { ErrorState } from '@/components/common/error-state'
import { EmptyState } from '@/components/common/empty-state'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { catalogApi, type CatalogItem } from '@/lib/api/endpoints/products'
import { usePermissions } from '@/lib/use-permissions'
import { toast } from '@/components/ui/sonner'
import { ApiError } from '@/lib/api/errors'

interface CatalogHandlers {
  list: () => Promise<{ data: CatalogItem[] }>
  create: (name: string) => Promise<unknown>
  update: (id: number, name: string) => Promise<unknown>
  remove: (id: number) => Promise<unknown>
}

export function CatalogPage() {
  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Catalog"
        description="Manage product categories and brands used across your store."
      />

      <Tabs defaultValue="categories">
        <TabsList>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="brands">Brands</TabsTrigger>
        </TabsList>

        <TabsContent value="categories">
          <CatalogManager
            queryKey="categories"
            noun="category"
            handlers={{
              list: () => catalogApi.categories(),
              create: (name) => catalogApi.createCategory(name),
              update: (id, name) => catalogApi.updateCategory(id, name),
              remove: (id) => catalogApi.deleteCategory(id),
            }}
          />
        </TabsContent>

        <TabsContent value="brands">
          <CatalogManager
            queryKey="brands"
            noun="brand"
            handlers={{
              list: () => catalogApi.brands(),
              create: (name) => catalogApi.createBrand(name),
              update: (id, name) => catalogApi.updateBrand(id, name),
              remove: (id) => catalogApi.deleteBrand(id),
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function CatalogManager({
  queryKey,
  noun,
  handlers,
}: {
  queryKey: string
  noun: string
  handlers: CatalogHandlers
}) {
  const queryClient = useQueryClient()
  const { can } = usePermissions()
  const canCreate = can('products.create') || can('products.edit')
  const canEdit = can('products.edit')
  const canDelete = can('products.delete')

  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['catalog', queryKey],
    queryFn: () => handlers.list(),
    placeholderData: (prev) => prev,
  })

  const items = data?.data ?? []

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['catalog', queryKey] })
    void queryClient.invalidateQueries({ queryKey: ['catalog'] })
  }

  const create = useMutation({
    mutationFn: (name: string) => handlers.create(name),
    onSuccess: () => {
      toast.success(`${capitalize(noun)} added`)
      setNewName('')
      invalidate()
    },
    onError: (err) => {
      toast.error(`Could not add ${noun}`, {
        description: err instanceof ApiError ? err.message : undefined,
      })
    },
  })

  const update = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => handlers.update(id, name),
    onSuccess: () => {
      toast.success(`${capitalize(noun)} updated`)
      setEditingId(null)
      setEditName('')
      invalidate()
    },
    onError: (err) => {
      toast.error(`Could not update ${noun}`, {
        description: err instanceof ApiError ? err.message : undefined,
      })
    },
  })

  const remove = useMutation({
    mutationFn: (id: number) => handlers.remove(id),
    onSuccess: () => {
      toast.success(`${capitalize(noun)} deleted`)
      invalidate()
    },
    onError: (err) => {
      toast.error(`Could not delete ${noun}`, {
        description: err instanceof ApiError ? err.message : undefined,
      })
    },
  })

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        {canCreate && (
          <div className="flex gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={`Add a ${noun}…`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newName.trim()) create.mutate(newName.trim())
              }}
            />
            <Button
              onClick={() => newName.trim() && create.mutate(newName.trim())}
              loading={create.isPending}
              disabled={!newName.trim()}
            >
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
        )}

        {isLoading && <LoadingState variant="table" rows={5} />}
        {isError && <ErrorState error={error} onRetry={() => refetch()} />}

        {!isLoading && !isError && items.length === 0 && (
          <EmptyState
            title={`No ${noun}s yet`}
            description={`Add your first ${noun} to organise products.`}
            icon={<Tags className="h-6 w-6" />}
          />
        )}

        {!isLoading && !isError && items.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const isEditing = editingId === item.id
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      {isEditing ? (
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && editName.trim())
                              update.mutate({ id: item.id, name: editName.trim() })
                            if (e.key === 'Escape') setEditingId(null)
                          }}
                        />
                      ) : (
                        <span className="text-sm font-medium text-foreground">{item.name}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {isEditing ? (
                          <>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              loading={update.isPending}
                              onClick={() =>
                                editName.trim() &&
                                update.mutate({ id: item.id, name: editName.trim() })
                              }
                            >
                              <span className="sr-only">Save</span>
                              <Check className="h-4 w-4 text-success" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setEditingId(null)}
                            >
                              <span className="sr-only">Cancel</span>
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            {canEdit && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => {
                                  setEditingId(item.id)
                                  setEditName(item.name)
                                }}
                              >
                                <span className="sr-only">Edit</span>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            {canDelete && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                loading={remove.isPending && remove.variables === item.id}
                                onClick={() => remove.mutate(item.id)}
                              >
                                <span className="sr-only">Delete</span>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
