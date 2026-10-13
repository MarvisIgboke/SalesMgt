import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { ArrowRight, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, ShieldAlert } from 'lucide-react'
import { ApiError } from '@/lib/api/errors'
import { toast } from '@/components/ui/sonner'
import { SecureAuthShell } from './secure-auth-shell'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const email = params.get('email') ?? ''

  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const [done, setDone] = useState(false)

  const mutation = useMutation({
    mutationFn: async () => {
      const { authApi } = await import('@/lib/api/endpoints/auth')
      await authApi.resetPassword({
        token,
        email,
        password,
        password_confirmation: passwordConfirmation,
      })
    },
    onSuccess: () => {
      setFieldErrors({})
      setDone(true)
      toast.success('Password reset successfully')
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        if (error.isValidationError && error.errors) {
          setFieldErrors(error.errors)
        } else {
          toast.error(error.message)
        }
      } else {
        toast.error('Unable to reset your password. Please try again.')
      }
    },
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setFieldErrors({})
    if (mutation.isPending) return
    if (password !== passwordConfirmation) {
      setFieldErrors({ password_confirmation: ['Passwords do not match'] })
      return
    }
    mutation.mutate()
  }

  if (!token || !email) {
    return (
      <SecureAuthShell subtitle="Password Recovery Console">
        <div className="flex flex-col gap-4 rounded-2xl border border-destructive/30 bg-destructive/10 p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div>
              <div className="text-sm font-semibold text-foreground">Invalid reset link</div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                This password reset link is missing its token or email. Request a new link to continue.
              </p>
            </div>
          </div>
          <Link
            to="/forgot-password"
            className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-transform active:scale-95"
          >
            Request a new link
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </SecureAuthShell>
    )
  }

  return (
    <SecureAuthShell subtitle="Password Recovery Console">
      <div className="rounded-2xl border border-border/60 bg-card p-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-lg font-bold tracking-tight text-foreground">Set a new passkey</h1>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Choose a strong password of at least 8 characters for{' '}
            <span className="font-medium text-foreground">{email}</span>.
          </p>
        </div>

        {done ? (
          <div className="mt-4 flex flex-col gap-4 rounded-xl border border-success/30 bg-success/10 p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
              <div>
                <div className="text-sm font-semibold text-foreground">Password updated</div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Your credentials are updated and existing sessions were signed out. Sign in with your
                  new password.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate('/login', { replace: true })}
              className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-transform active:scale-95"
            >
              Continue to sign in
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="mt-4 flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="password"
                className="font-mono text-[10px] uppercase text-muted-foreground"
              >
                New password
              </label>
              <div className="flex items-center rounded-lg bg-secondary px-3 py-2.5">
                <KeyRound className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={mutation.isPending}
                  className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="ml-2 shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="text-[11px] text-destructive">{fieldErrors.password[0]}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="password_confirmation"
                className="font-mono text-[10px] uppercase text-muted-foreground"
              >
                Confirm new password
              </label>
              <div className="flex items-center rounded-lg bg-secondary px-3 py-2.5">
                <KeyRound className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                <input
                  id="password_confirmation"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={passwordConfirmation}
                  onChange={(e) => setPasswordConfirmation(e.target.value)}
                  placeholder="••••••••"
                  disabled={mutation.isPending}
                  className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
                  required
                />
              </div>
              {fieldErrors.password_confirmation && (
                <p className="text-[11px] text-destructive">{fieldErrors.password_confirmation[0]}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={mutation.isPending || !password || !passwordConfirmation}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {mutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="h-4 w-4" />
              )}
              <span>{mutation.isPending ? 'Updating...' : 'Set new password'}</span>
            </button>

            <div className="flex items-center justify-center gap-1 pt-1 font-mono text-[10px] text-muted-foreground">
              <Link to="/login" className="text-primary hover:underline">
                Back to sign in
              </Link>
            </div>
          </form>
        )}
      </div>
    </SecureAuthShell>
  )
}
