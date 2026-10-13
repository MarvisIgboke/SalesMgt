import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { ArrowRight, CheckCircle2, Loader2, Mail, Send } from 'lucide-react'
import { ApiError } from '@/lib/api/errors'
import { toast } from '@/components/ui/sonner'
import { SecureAuthShell } from './secure-auth-shell'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const [sent, setSent] = useState(false)

  const mutation = useMutation({
    mutationFn: async () => {
      const { authApi } = await import('@/lib/api/endpoints/auth')
      await authApi.forgotPassword({ email })
    },
    onSuccess: () => {
      setFieldErrors({})
      setSent(true)
      toast.success('Reset link sent')
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        if (error.isValidationError && error.errors) {
          setFieldErrors(error.errors)
        } else {
          toast.error(error.message)
        }
      } else {
        toast.error('Unable to send the reset link. Please try again.')
      }
    },
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setFieldErrors({})
    if (mutation.isPending) return
    mutation.mutate()
  }

  return (
    <SecureAuthShell subtitle="Password Recovery Console">
      <div className="rounded-2xl border border-border/60 bg-card p-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-lg font-bold tracking-tight text-foreground">Reset your passkey</h1>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Enter the email registered to your operator account and we&apos;ll send a secure link to
            set a new password.
          </p>
        </div>

        {sent ? (
          <div className="mt-4 flex flex-col gap-4 rounded-xl border border-success/30 bg-success/10 p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-foreground">Check your inbox</div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  If an account exists for <span className="font-medium text-foreground">{email}</span>,
                  a reset link is on its way. The link expires shortly, so use it soon.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setSent(false)
                  mutation.reset()
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-accent"
              >
                Use a different email
              </button>
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                Back to sign in
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="mt-4 flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="email"
                className="font-mono text-[10px] uppercase text-muted-foreground"
              >
                Operator Directory ID / Email
              </label>
              <div className="flex items-center rounded-lg bg-secondary px-3 py-2.5">
                <Mail className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="emp.id@company.com"
                  disabled={mutation.isPending}
                  className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
                  required
                />
              </div>
              {fieldErrors.email && (
                <p className="text-[11px] text-destructive">{fieldErrors.email[0]}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={mutation.isPending || !email}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {mutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span>{mutation.isPending ? 'Transmitting...' : 'Send reset link'}</span>
            </button>

            <div className="flex items-center justify-center gap-1 pt-1 font-mono text-[10px] text-muted-foreground">
              <Link to="/login" className="text-primary hover:underline">
                Remembered it? Return to sign in
              </Link>
            </div>
          </form>
        )}
      </div>
    </SecureAuthShell>
  )
}
