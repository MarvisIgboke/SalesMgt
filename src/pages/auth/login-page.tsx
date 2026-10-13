import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Badge,
  Delete,
  Eye,
  EyeOff,
  Fingerprint,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  type LucideIcon,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { env } from '@/lib/env'
import { ApiError } from '@/lib/api/errors'
import { toast } from '@/components/ui/sonner'
import { cn } from '@/lib/utils'

type AuthTab = 'pin' | 'biometric' | 'sso'
type PinTone = 'muted' | 'primary' | 'success'

const MAX_PIN = 6

const KEYPAD = [
  { key: '1', sub: 'REG' },
  { key: '2', sub: 'ABC' },
  { key: '3', sub: 'DEF' },
  { key: '4', sub: 'GHI' },
  { key: '5', sub: 'JKL' },
  { key: '6', sub: 'MNO' },
  { key: '7', sub: 'PQRS' },
  { key: '8', sub: 'TUV' },
  { key: '9', sub: 'WXYZ' },
] as const

const TONE_CLASS: Record<PinTone, string> = {
  muted: 'text-muted-foreground',
  primary: 'text-primary',
  success: 'text-success font-bold',
}

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const login = useAuthStore((s) => s.login)

  const [tab, setTab] = useState<AuthTab>('sso')
  const [pin, setPin] = useState('')
  const [pinTone, setPinTone] = useState<PinTone>('muted')
  const [pinFeedback, setPinFeedback] = useState('Awaiting register operator credential')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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

  const pressKey = (key: string) => {
    if (pin.length >= MAX_PIN) return
    const next = pin + key
    setPin(next)
    if (next.length === MAX_PIN) {
      setPinTone('primary')
      setPinFeedback('Verifying cryptographic token...')
      window.setTimeout(() => {
        setPinTone('success')
        setPinFeedback('Authorized · Shift Lead clearance verified')
      }, 600)
    } else {
      setPinTone('primary')
      setPinFeedback(`Entry in progress (${next.length}/${MAX_PIN})...`)
    }
  }

  const pressClear = () => {
    setPin((p) => p.slice(0, -1))
    setPinTone('primary')
    setPinFeedback('Awaiting register operator credential')
  }

  const simulateBiometric = () => {
    setPin('123456')
    setPinTone('success')
    setPinFeedback('Hardware scan match 99.8% · Signed by secure enclave')
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground selection:bg-primary/30">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-md items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded bg-secondary px-2 py-0.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-success">
                Secure Node
              </span>
            </div>
            <span className="hidden font-mono text-[10px] text-muted-foreground sm:inline">
              TLS_v1.3_E2EE
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 pb-10 pt-3">
          <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card p-4 shadow-card">
            <div className="pointer-events-none absolute -bottom-8 -right-8 h-32 w-32 rounded-full bg-primary/10 blur-2xl" />
            <div className="relative flex items-start gap-4">
              <div className="relative grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-surface-elevated shadow-inner">
                <div className="absolute inset-0 rounded-xl bg-gradient-to-tr from-primary/20 via-transparent to-success/10" />
                <svg className="relative h-7 w-7 text-primary" viewBox="0 0 32 32" fill="none">
                  <path
                    d="M16 3L4 9V16C4 22.8 9.1 29.1 16 31C22.9 29.1 28 22.8 28 16V9L16 3Z"
                    fill="currentColor"
                    fillOpacity="0.15"
                  />
                  <path
                    d="M16 3L4 9V16C4 22.8 9.1 29.1 16 31C22.9 29.1 28 22.8 28 16V9L16 3Z"
                    stroke="currentColor"
                    strokeLinejoin="round"
                    strokeWidth="1.75"
                  />
                  <path
                    d="M10 16L14 20L22 12"
                    stroke="hsl(var(--success))"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                </svg>
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-center gap-2">
                  <span className="truncate text-base font-semibold text-foreground">
                    {env.appName} Enterprise
                  </span>
                  <span className="rounded bg-primary/15 px-1.5 py-0.5 font-mono text-[10px] text-primary">
                    v4.2-LTS
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  Workstation POS &amp; ERP Access Gate
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1 rounded-2xl bg-surface-sunken p-1">
            <AuthTabButton
              active={tab === 'pin'}
              icon={Fingerprint}
              label="PIN / NFC"
              onClick={() => setTab('pin')}
            />
            <AuthTabButton
              active={tab === 'biometric'}
              icon={Fingerprint}
              label="Biometric"
              onClick={() => {
                setTab('biometric')
                setPinTone('success')
                setPinFeedback('Optical scanner active · Place finger on sensor')
              }}
            />
            <AuthTabButton
              active={tab === 'sso'}
              icon={KeyRound}
              label="SSO / IAM"
              onClick={() => setTab('sso')}
            />
          </div>

          {tab !== 'sso' && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col items-center justify-center rounded-2xl border border-border/60 bg-card py-3">
                <span className="mb-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Enter 6-digit passcode
                </span>
                <div className="flex items-center gap-3">
                  {Array.from({ length: MAX_PIN }).map((_, i) => (
                    <span
                      key={i}
                      className={cn(
                        'h-3.5 w-3.5 rounded-full transition-all duration-150',
                        i < pin.length
                          ? 'scale-110 bg-primary ring-2 ring-primary/40'
                          : 'scale-100 bg-surface-elevated',
                      )}
                    />
                  ))}
                </div>
                <span className={cn('mt-3 h-4 font-mono text-[10px]', TONE_CLASS[pinTone])}>
                  {pinFeedback}
                </span>
              </div>

              <div className="grid select-none grid-cols-3 gap-2">
                {KEYPAD.map(({ key, sub }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => pressKey(key)}
                    className="flex h-14 flex-col items-center justify-center rounded-xl bg-secondary text-foreground shadow-sm transition-all hover:bg-accent active:scale-95"
                  >
                    <span className="text-lg font-bold">{key}</span>
                    <span className="font-mono text-[9px] text-muted-foreground/60">{sub}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={pressClear}
                  className="flex h-14 items-center justify-center rounded-xl bg-secondary text-destructive shadow-sm transition-all hover:bg-accent active:scale-95"
                >
                  <Delete className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => pressKey('0')}
                  className="flex h-14 flex-col items-center justify-center rounded-xl bg-secondary text-foreground shadow-sm transition-all hover:bg-accent active:scale-95"
                >
                  <span className="text-lg font-bold">0</span>
                  <span className="font-mono text-[9px] text-muted-foreground/60">+</span>
                </button>
                <button
                  type="button"
                  onClick={simulateBiometric}
                  className="flex h-14 items-center justify-center rounded-xl bg-secondary text-success shadow-sm transition-all hover:bg-accent active:scale-95"
                >
                  <Fingerprint className="h-6 w-6" />
                </button>
              </div>
            </div>
          )}

          {tab === 'sso' && (
            <form
              onSubmit={submit}
              noValidate
              className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4"
            >
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="email"
                  className="font-mono text-[10px] uppercase text-muted-foreground"
                >
                  Operator Directory ID / Email
                </label>
                <div className="flex items-center rounded-lg bg-secondary px-3 py-2.5">
                  <Badge className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="emp.id@company.com"
                    disabled={loginMutation.isPending}
                    className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
                  />
                </div>
                {fieldErrors.email && (
                  <p className="text-[11px] text-destructive">{fieldErrors.email[0]}</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="password"
                    className="font-mono text-[10px] uppercase text-muted-foreground"
                  >
                    Hardware Passkey or Master Password
                  </label>
                  <button
                    type="button"
                    onClick={() => navigate('/forgot-password')}
                    className="font-mono text-[10px] uppercase text-primary hover:underline"
                  >
                    Forgot?
                  </button>
                </div>
                <div className="flex items-center rounded-lg bg-secondary px-3 py-2.5">
                  <Lock className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={loginMutation.isPending}
                    className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
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

              <button
                type="submit"
                disabled={loginMutation.isPending || !email || !password}
                className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loginMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <KeyRound className="h-4 w-4" />
                )}
                <span>{loginMutation.isPending ? 'Authorizing...' : 'Sign in securely'}</span>
              </button>

              <div className="flex items-center justify-center gap-1 pt-1 font-mono text-[10px] text-muted-foreground">
                <Mail className="h-3 w-3" />
                <button
                  type="button"
                  onClick={() => navigate('/register')}
                  className="text-primary hover:underline"
                >
                  No workspace yet? Register a new business
                </button>
              </div>
            </form>
          )}

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={simulateBiometric}
              className="group relative flex w-full items-center justify-between overflow-hidden rounded-2xl border border-border/60 bg-card px-4 py-3.5 shadow-sm transition-all hover:border-primary/40"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-success/10 opacity-70 transition-opacity group-hover:opacity-100" />
              <div className="relative z-10 flex items-center gap-3">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/20 text-primary">
                  <Fingerprint className="h-5 w-5 animate-pulse" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-[13px] font-semibold text-foreground">
                    Tap Optical Reader / Face Unlock
                  </span>
                  <span className="font-mono text-[10px] text-success">
                    SecuGen Hamster IV Ready
                  </span>
                </div>
              </div>
              <div className="relative z-10 flex items-center gap-1">
                <span className="font-mono text-[10px] text-muted-foreground">
                  0.4s Quick-Pass
                </span>
                <ArrowRight className="h-4 w-4 text-primary" />
              </div>
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}

function AuthTabButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean
  icon: LucideIcon
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center justify-center gap-1 rounded-xl px-1 py-2 text-[12px] font-semibold transition-all',
        active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'bg-secondary text-muted-foreground hover:bg-accent',
      )}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </button>
  )
}
