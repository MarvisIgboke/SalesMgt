import { create } from 'zustand'
import { businessApi, type ActiveContext, type Branch } from '@/lib/api/endpoints/business'
import { setRequestContext } from '@/lib/api/context'
import type { AuthSession } from '@/lib/api/endpoints/auth'

export type Theme = 'dark' | 'light' | 'system'

interface AppState {
  theme: Theme
  sidebarOpen: boolean
  mobileNavOpen: boolean
  context: ActiveContext | null
  contextLoaded: boolean
  contextError: string | null
  branches: Branch[]
  switchPending: boolean
  setTheme: (theme: Theme) => void
  setSidebarOpen: (open: boolean) => void
  setMobileNavOpen: (open: boolean) => void
  loadContext: (session?: AuthSession | null) => Promise<void>
  switchBranch: (branchId: number | null) => Promise<void>
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  const resolved =
    theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: light)').matches
        ? 'light'
        : 'dark'
      : theme
  root.classList.toggle('light', resolved === 'light')
  root.classList.toggle('dark', resolved === 'dark')
  try {
    localStorage.setItem('salesmgt.theme', theme)
  } catch {
    /* ignore */
  }
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', resolved === 'light' ? '#ffffff' : '#0a0a0b')
}

function initialTheme(): Theme {
  try {
    return (localStorage.getItem('salesmgt.theme') as Theme) || 'dark'
  } catch {
    return 'dark'
  }
}

export const useAppStore = create<AppState>((set) => ({
  theme: initialTheme(),
  sidebarOpen: true,
  mobileNavOpen: false,
  context: null,
  contextLoaded: false,
  contextError: null,
  branches: [],
  switchPending: false,

  setTheme: (theme) => {
    applyTheme(theme)
    set({ theme })
  },

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setMobileNavOpen: (open) => set({ mobileNavOpen: open }),

  async loadContext(session) {
    try {
      const { data } = await businessApi.getContext()
      setRequestContext({
        businessId: data.business.id,
        branchId: data.branch?.id ?? null,
      })
      set({
        context: data,
        contextLoaded: true,
        contextError: null,
        branches: data.branch ? [data.branch] : [],
      })
      if (session) {
        const result = await businessApi.listBranches({ per_page: 100 })
        set({ branches: result.data })
      }
    } catch (error) {
      set({ contextLoaded: true, contextError: error instanceof Error ? error.message : String(error) })
    }
  },

  async switchBranch(branchId) {
    set({ switchPending: true })
    try {
      const { data } = await businessApi.switchBranch(branchId ?? 0)
      setRequestContext({ branchId: branchId ?? null })
      set({ context: data as ActiveContext, switchPending: false })
    } catch (error) {
      set({ switchPending: false })
      throw error
    }
  },
}))

applyTheme(initialTheme())