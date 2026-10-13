import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { Building2, Lock, Mail, Phone, ShieldCheck, User } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { Brand } from '@/components/layout/brand'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError } from '@/lib/api/errors'
import { toast } from '@/components/ui/sonner'

export function RegisterPage() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const [businessName, setBusinessName] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})

  const registerMutation = useMutation({
    mutationFn: async (input: {
      business_name: string
      name: string
      email: string
      password: string
      password_confirmation: string
      phone?: string
    }) => {
      const { authApi } = await import('@/lib/api/endpoints/auth')
      const res = await authApi.register({
        business_name: input.business_name,
        name: input.name,
        email: input.email,
        password: input.password,
        password_confirmation: input.password_confirmation,
        phone: input.phone || null,
      })
      const session = res.data
      if (session) {
        await login({ email: input.email, password: input.password })
      }
    },
    onSuccess: () => {
      setFieldErrors({})
      navigate('/dashboard', { replace: true })
      toast.success('Business registered successfully')
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        if (error.isValidationError && error.errors) {
          setFieldErrors(error.errors)
        } else {
          toast.error(error.message)
        }
      } else {
        toast.error('Unable to register. Please try again.')
      }
    },
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setFieldErrors({})
    if (registerMutation.isPending) return
    if (password !== passwordConfirmation) {
      setFieldErrors({ password_confirmation: ['Passwords do not match'] })
      return
    }
    registerMutation.mutate({
      business_name: businessName,
      name,
      email,
      password,
      password_confirmation: passwordConfirmation,
      phone,
    })
  }

  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden bg-background px-4 py-6">
      <div className="pointer-events-none absolute inset-0 bg-grid-fade" />
      <div className="pointer-events-none absolute -top-32 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/15 blur-[100px]" />

      <div className="relative w-full max-w-md animate-slide-up">
        <div className="mb-6 flex flex-col items-center gap-3">
          <Brand />
        </div>

        <form onSubmit={submit} className="glass rounded-2xl p-6 shadow-card sm:p-7" noValidate>
          <div className="mb-6">
            <h1 className="text-xl font-bold tracking-tight text-foreground">Register your business</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your business and get started in minutes.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="business_name">Business name</Label>
              <div className="relative">
                <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="business_name"
                  placeholder="Your Business Ltd."
                  className="pl-9"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  aria-invalid={!!fieldErrors.business_name}
                  disabled={registerMutation.isPending}
                  required
                />
              </div>
              {fieldErrors.business_name && (
                <p className="text-xs text-destructive">{fieldErrors.business_name[0]}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="name">Your full name</Label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="name"
                  placeholder="John Doe"
                  className="pl-9"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  aria-invalid={!!fieldErrors.name}
                  disabled={registerMutation.isPending}
                  required
                />
              </div>
              {fieldErrors.name && (
                <p className="text-xs text-destructive">{fieldErrors.name[0]}</p>
              )}
            </div>

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
                  disabled={registerMutation.isPending}
                  required
                />
              </div>
              {fieldErrors.email && (
                <p className="text-xs text-destructive">{fieldErrors.email[0]}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone (optional)</Label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="phone"
                  placeholder="+234 800 000 0000"
                  className="pl-9"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  aria-invalid={!!fieldErrors.phone}
                  disabled={registerMutation.isPending}
                />
              </div>
              {fieldErrors.phone && (
                <p className="text-xs text-destructive">{fieldErrors.phone[0]}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className="pl-9"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={!!fieldErrors.password}
                  disabled={registerMutation.isPending}
                  required
                />
              </div>
              {fieldErrors.password && (
                <p className="text-xs text-destructive">{fieldErrors.password[0]}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password_confirmation">Confirm password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password_confirmation"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className="pl-9"
                  value={passwordConfirmation}
                  onChange={(e) => setPasswordConfirmation(e.target.value)}
                  aria-invalid={!!fieldErrors.password_confirmation}
                  disabled={registerMutation.isPending}
                  required
                />
              </div>
              {fieldErrors.password_confirmation && (
                <p className="text-xs text-destructive">{fieldErrors.password_confirmation[0]}</p>
              )}
            </div>
          </div>

          <Button type="submit" size="lg" className="mt-6 w-full" loading={registerMutation.isPending}>
            {!registerMutation.isPending && 'Create business'}
          </Button>

          <div className="mt-4 text-center">
            <button
              type="button"
              className="text-xs font-medium text-primary hover:underline"
              onClick={() => navigate('/login')}
            >
              Already have an account? Sign in
            </button>
          </div>

          <div className="mt-5 flex items-start justify-center gap-1.5 text-center">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              By creating an account you agree to our{' '}
              <Link to="/terms" className="font-medium text-primary hover:underline">
                Terms &amp; Conditions
              </Link>{' '}
              and{' '}
              <Link to="/privacy" className="font-medium text-primary hover:underline">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}
