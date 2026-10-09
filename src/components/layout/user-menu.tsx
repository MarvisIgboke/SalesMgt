import { useNavigate } from 'react-router-dom'
import { LogOut, Settings, User as UserIcon } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { initials } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'

export function UserMenu() {
  const navigate = useNavigate()
  const { session, logout } = useAuthStore()
  const context = useAppStore((s) => s.context)
  const user = session?.user

  if (!user) return null

  const role = user.roles[0] ?? 'Staff'
  const subscriptionStatus = context?.subscription.status
  const subscriptionOk = subscriptionStatus === 'active' || subscriptionStatus === 'trial'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2.5 rounded-xl border border-transparent p-1.5 transition-colors hover:border-border/70 hover:bg-surface"
          aria-label="User menu"
        >
          <Avatar className="h-9 w-9">
            <AvatarImage src={user.avatar_url ?? undefined} alt={user.name} />
            <AvatarFallback>{initials(user.name)}</AvatarFallback>
          </Avatar>
          <span className="hidden flex-col items-start leading-tight md:flex">
            <span className="max-w-[10rem] truncate text-sm font-medium text-foreground">
              {user.name}
            </span>
            <span className="max-w-[10rem] truncate text-[11px] capitalize text-muted-foreground">
              {role.replace(/_/g, ' ')}
            </span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>
          <span className="flex flex-col gap-1">
            <span className="text-sm font-medium text-foreground">{user.name}</span>
            <span className="text-xs font-normal text-muted-foreground">{user.email}</span>
            {!subscriptionOk && context?.subscription && (
                <Badge variant="destructive" className="mt-1 w-fit capitalize">
                  {context.subscription.status} subscription
                </Badge>
              )}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate('/settings/profile')}>
          <UserIcon />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate('/settings')}>
          <Settings />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:bg-destructive/10 focus:text-destructive"
          onClick={() => {
            void logout().finally(() => {
              navigate('/login', { replace: true })
            })
          }}
        >
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}