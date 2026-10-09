import { Building2, ChevronsUpDown, Loader2, Store } from 'lucide-react'
import { useAppStore } from '@/stores/app'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { toast } from '@/components/ui/sonner'
import { ApiError } from '@/lib/api/errors'

interface BranchSwitcherProps {
  variant?: 'header' | 'sidebar'
}

export function BranchSwitcher({ variant = 'header' }: BranchSwitcherProps) {
  const context = useAppStore((s) => s.context)
  const branches = useAppStore((s) => s.branches)
  const switchPending = useAppStore((s) => s.switchPending)
  const switchBranch = useAppStore((s) => s.switchBranch)

  if (!context) return null

  const current = context.branch

  const handleSelect = async (branchId: number | null) => {
    try {
      await switchBranch(branchId)
    } catch (error) {
      const msg = error instanceof ApiError ? error.message : 'Failed to switch branch'
      toast.error(msg)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={variant === 'sidebar' ? 'sm' : 'default'}
          className={cn(
            'h-9 gap-2 rounded-xl border border-border/70 bg-surface/60 hover:bg-surface',
            variant === 'sidebar' && 'w-full justify-start px-2.5',
          )}
        >
          {current ? (
            <Store className="h-4 w-4 text-primary" />
          ) : (
            <Building2 className="h-4 w-4 text-primary" />
          )}
          <span className="max-w-[9rem] truncate text-sm font-medium">
            {current ? current.name : 'All branches'}
          </span>
          {switchPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          ) : (
            <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>
          <span className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <span className="truncate text-sm">{context.business.name}</span>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handleSelect(null)} disabled={switchPending}>
          <Building2 className="h-4 w-4" />
          <span className="flex-1">All branches</span>
          {current == null && <Badge variant="success">Active</Badge>}
        </DropdownMenuItem>
        {branches.map((branch) => (
          <DropdownMenuItem
            key={branch.id}
            onClick={() => handleSelect(branch.id)}
            disabled={switchPending || !branch.is_active}
          >
            <Store className="h-4 w-4" />
            <span className="flex-1 truncate">{branch.name}</span>
            {current?.id === branch.id && <Badge variant="success">Active</Badge>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}