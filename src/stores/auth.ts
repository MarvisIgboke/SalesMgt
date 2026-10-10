import { create } from 'zustand'
import { authApi, type AuthSession, type LoginInput } from '@/lib/api/endpoints/auth'
import { setToken, getToken, clearToken } from '@/lib/auth-token'
import { setRequestContext } from '@/lib/api/context'
import { ApiError } from '@/lib/api/errors'
import { useAppStore } from './app'

export type AuthStatus = 'unauthenticated' | 'authenticating' | 'authenticated' | 'error'

interface AuthState {
  status: AuthStatus
  session: AuthSession | null
  error: string | null
  login: (input: LoginInput) => Promise<void>
  hydrate: () => Promise<void>
  logout: () => Promise<void>
  setSession: (session: AuthSession | null) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'unauthenticated',
  session: null,
  error: null,

  async login(input) {
    set({ status: 'authenticating', error: null })
    try {
      const { data: session } = await authApi.login(input)
      setToken(session.access_token, session.refresh_token)
      setRequestContext({ businessId: session.user.business_id })
      set({ status: 'authenticated', session, error: null })
      void fetchActiveContext(session)
    } catch (error) {
      const normalized = error instanceof ApiError ? error : new ApiError({ message: String(error) })
      set({ status: 'error', error: normalized.message })
      throw normalized
    }
  },

  async hydrate() {
    if (!getToken()) {
      set({ status: 'unauthenticated', session: null })
      return
    }
    set({ status: 'authenticating' })
    try {
      const { data: session } = await authApi.me()
      setToken(session.access_token, session.refresh_token)
      setRequestContext({ businessId: session.user.business_id })
      set({ status: 'authenticated', session, error: null })
      void fetchActiveContext(session)
    } catch {
      clearToken()
      setRequestContext({ businessId: null, branchId: null })
      set({ status: 'unauthenticated', session: null })
    }
  },

  async logout() {
    try {
      await authApi.logout()
    } catch {
      /* best-effort server logout */
    }
    clearToken()
    setRequestContext({ businessId: null, branchId: null })
    set({ status: 'unauthenticated', session: null })
  },

  setSession(session) {
    set({ session })
  },
}))

async function fetchActiveContext(session: AuthSession) {
  useAppStore.getState().loadContext(session)
}