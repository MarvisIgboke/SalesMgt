import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { Lock, Mail, ShieldCheck } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { env } from '@/lib/env'
import { Brand } from '@/components/layout/brand'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError } from '@/lib/api/errors'
import { toast } from '@/components/ui/sonner'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const login = useAuthStore((s) => s.login)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})

  const loginMutation = useMutation({
    mutationFn: async (input: { email: string; password: string }) => {
      await login(input)
    },
    onSuccess: () => {
      setFieldErrors({})
      const to = (location.state as { from?: string } | null)?.from ?? '/dashboard'
      navigate(to, { replace: true })
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        if (error.isValidationError && error.errors) {
          setFieldErrors(error.errors)
        } else {
          toast.error(error.message)
        }
      } else {
        toast.error('Unable to sign in. Please try again.')
      }
    },
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setFieldErrors({})
    if (loginMutation.isPending) return
    loginMutation.mutate({ email, password })
  }

  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden bg-background px-4">
      <div className="pointer-events-none absolute inset-0 bg-grid-fade" />
      <div className="pointer-events-none absolute -top-32 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/15 blur-[100px]" />

      <div className="relative w-full max-w-sm animate-slide-up">
        <div className="mb-8 flex flex-col items-center gap-3">
          <Brand />
        </div>

        <form
          onSubmit={submit}
          className="glass rounded-2xl p-6 shadow-card sm:p-7"
          noValidate
        >
          <div className="mb-6">
            <h1 className="text-xl font-bold tracking-tight text-foreground">Welcome back</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in to your {env.appName} workspace.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email address</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@business.com"
                  className="pl-9"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={!!fieldErrors.email}
                  disabled={loginMutation.isPending}
                  required
                />
              </div>
              {fieldErrors.email && (
                <p className="text-xs text-destructive">{fieldErrors.email[0]}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button
                  type="button"
                  className="text-xs font-medium text-primary hover:underline"
                  onClick={() => toast.info('Contact your business administrator to reset your password.')}
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="pl-9"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={!!fieldErrors.password}
                  disabled={loginMutation.isPending}
                  required
                />
              </div>
              {fieldErrors.password && (
                <p className="text-xs text-destructive">{fieldErrors.password[0]}</p>
              )}
            </div>
          </div>

          <Button type="submit" size="lg" className="mt-6 w-full" loading={loginMutation.isPending}>
            {!loginMutation.isPending && 'Sign in'}
          </Button>

          <div className="mt-5 flex items-center justify-center gap-1.5 text-center">
            <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-[11px] text-muted-foreground">
              Authenticated by your backend. No business logic runs in the browser.
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}