import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { ArrowLeft, KeyRound, UserRound } from 'lucide-react'
import { PageHeader } from '@/components/common/page-header'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { toast } from '@/components/ui/sonner'
import { authApi, type ProfileInput } from '@/lib/api/endpoints/auth'
import { initials } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'

export function ProfilePage() {
  const navigate = useNavigate()
  const session = useAuthStore((s) => s.session)
  const setSession = useAuthStore((s) => s.setSession)
  const user = session?.user

  const [name, setName] = useState(user?.name ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    password: '',
    password_confirmation: '',
  })

  const profileMutation = useMutation({
    mutationFn: (input: ProfileInput) => authApi.updateProfile(input),
    onSuccess: ({ data }) => {
      setSession(data)
      toast.success('Profile updated.')
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Unable to update profile.')
    },
  })

  const passwordMutation = useMutation({
    mutationFn: (input: ProfileInput) => authApi.updateProfile(input),
    onSuccess: ({ data }) => {
      setSession(data)
      setPasswordForm({ current_password: '', password: '', password_confirmation: '' })
      toast.success('Password changed.')
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Unable to change password.')
    },
  })

  if (!user) return null

  const saveProfile = () => {
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error('Name is required.')
      return
    }
    profileMutation.mutate({ name: trimmed, phone: phone.trim() || null })
  }

  const changePassword = () => {
    if (!passwordForm.current_password || !passwordForm.password) {
      toast.error('Fill in all password fields.')
      return
    }
    if (passwordForm.password !== passwordForm.password_confirmation) {
      toast.error('New passwords do not match.')
      return
    }
    passwordMutation.mutate(passwordForm)
  }

  return (
    <div className="animate-fade-in max-w-3xl space-y-4">
      <Button variant="ghost" size="sm" className="-ml-2 w-fit" onClick={() => navigate('/settings')}>
        <ArrowLeft />
        Back to settings
      </Button>
      <PageHeader title="Profile" description="Manage your personal account details." />

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center">
          <Avatar className="h-16 w-16">
            <AvatarImage src={user.avatar_url ?? undefined} alt={user.name} />
            <AvatarFallback className="text-lg">{initials(user.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 space-y-1">
            <p className="truncate text-base font-semibold text-foreground">{user.name}</p>
            <p className="truncate text-sm text-muted-foreground">{user.email}</p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {user.roles.map((role) => (
                <Badge key={role} variant="secondary" className="capitalize">
                  {role.replace(/_/g, ' ')}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserRound className="h-4 w-4 text-primary" />
            Account details
          </CardTitle>
          <CardDescription>Your email address is managed by your administrator.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="profile-name">Full name</Label>
            <Input
              id="profile-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-email">Email</Label>
            <Input id="profile-email" value={user.email} disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-phone">Phone</Label>
            <Input
              id="profile-phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="e.g. 0803 000 0000"
            />
          </div>
          <Button onClick={saveProfile} loading={profileMutation.isPending}>
            Save changes
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            Change password
          </CardTitle>
          <CardDescription>Use at least 8 characters for your new password.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">Current password</Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={passwordForm.current_password}
              onChange={(event) =>
                setPasswordForm((p) => ({ ...p, current_password: event.target.value }))
              }
            />
          </div>
          <Separator />
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={passwordForm.password}
              onChange={(event) => setPasswordForm((p) => ({ ...p, password: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={passwordForm.password_confirmation}
              onChange={(event) =>
                setPasswordForm((p) => ({ ...p, password_confirmation: event.target.value }))
              }
            />
          </div>
          <Button
            variant="secondary"
            onClick={changePassword}
            loading={passwordMutation.isPending}
          >
            Update password
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
