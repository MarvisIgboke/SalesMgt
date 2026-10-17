import { useState } from 'react'
import { Moon, Monitor, Sun, BellRing, ShieldCheck, ImageOff, Gem } from 'lucide-react'
import { useAppStore, type Theme } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import { PageHeader } from '@/components/common/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn, initials } from '@/lib/utils'
import { toast } from '@/components/ui/sonner'
import type { LucideIcon } from 'lucide-react'

const themeOptions: Array<{ value: Theme; label: string; description: string; icon: LucideIcon }> = [
  { value: 'dark', label: 'Dark', description: 'Midnight', icon: Moon },
  { value: 'light', label: 'Light', description: 'Daylight', icon: Sun },
  { value: 'emerald', label: 'Emerald', description: 'Ink & champagne', icon: Gem },
  { value: 'system', label: 'System', description: 'Match device', icon: Monitor },
]

export function SettingsPage() {
  const theme = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)
  const session = useAuthStore((s) => s.session)
  const user = session?.user

  const [prefs, setPrefs] = useState({
    pushNotifications: true,
    soundOnSale: true,
    offlineMode: true,
    reduceMotion: false,
    lowStockAlerts: true,
    expiryAlerts: true,
  })

  return (
    <div className="animate-fade-in max-w-3xl space-y-4">
      <PageHeader title="Settings" description="Preferences, profile and appearance." />

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Premium dark theme is the default experience.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {themeOptions.map((option) => {
              const Icon = option.icon
              const active = theme === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setTheme(option.value)
                    toast.success(`Theme set to ${option.label}.`)
                  }}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-xl border p-4 text-sm font-medium transition-all',
                    active
                      ? 'border-primary/60 bg-primary/10 text-primary'
                      : 'border-border/70 text-muted-foreground hover:bg-accent',
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {option.label}
                  <span className="text-[10px] font-normal uppercase tracking-wider text-muted-foreground/70">
                    {option.description}
                  </span>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notifications & alerts</CardTitle>
          <CardDescription>Backend push notifications and in-app alerts.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SettingRow
            icon={BellRing}
            title="Push notifications"
            description="Receive sale, approval and inventory alerts on this device."
            checked={prefs.pushNotifications}
            onChange={(v) => setPrefs((p) => ({ ...p, pushNotifications: v }))}
          />
          <Separator />
          <SettingRow
            icon={ShieldCheck}
            title="Low stock alerts"
            description="Notify when stock falls below the backend-defined threshold."
            checked={prefs.lowStockAlerts}
            onChange={(v) => setPrefs((p) => ({ ...p, lowStockAlerts: v }))}
          />
          <Separator />
          <SettingRow
            icon={ImageOff}
            title="Expiry alerts"
            description="Surface expiring items on the dashboard and POS."
            checked={prefs.expiryAlerts}
            onChange={(v) => setPrefs((p) => ({ ...p, expiryAlerts: v }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your account details are managed by your administrator.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Avatar className="h-14 w-14">
            <AvatarImage src={user?.avatar_url ?? undefined} />
            <AvatarFallback className="text-base">{initials(user?.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{user?.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            <p className="mt-1 text-[11px] capitalize text-muted-foreground/70">
              {user?.roles.join(', ')}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function SettingRow({
  icon: Icon,
  title,
  description,
  checked,
  onChange,
}: {
  icon: LucideIcon
  title: string
  description: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <Label className="leading-tight">{title}</Label>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}