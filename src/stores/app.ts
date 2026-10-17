import { create } from 'zustand'
import { businessApi, type ActiveContext, type Branch } from '@/lib/api/endpoints/business'
import { setRequestContext } from '@/lib/api/context'
import type { AuthSession } from '@/lib/api/endpoints/auth'

export type Theme = 'dark' | 'light' | 'emerald' | 'system'

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
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : theme

  root.classList.remove('light', 'dark', 'emerald')
  root.classList.add(resolved)

  try {
    localStorage.setItem('salesmgt.theme', theme)
  } catch {
    /* ignore */
  }

  const meta = document.querySelector('meta[name="theme-color"]')
  const themeColor = resolved === 'dark' ? '#0a0a0b' : resolved === 'emerald' ? '#064E3B' : '#ffffff'
  if (meta) meta.setAttribute('content', themeColor)
}

function initialTheme(): Theme {
  try {
    return (localStorage.getItem('salesmgt.theme') as Theme) || 'dark'
  } catch {
    return 'dark'
  }
}

type BranchPref = number | 'all'

function branchPrefKey(businessId: number): string {
  return `salesmgt.branch.${businessId}`
}

function loadBranchPref(businessId: number): BranchPref | null {
  try {
    const raw = localStorage.getItem(branchPrefKey(businessId))
    if (raw === null) return null
    if (raw === 'all') return 'all'
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : null
  } catch {
    return null
  }
}

function saveBranchPref(businessId: number, value: BranchPref | null): void {
  try {
    if (value === null) localStorage.removeItem(branchPrefKey(businessId))
    else localStorage.setItem(branchPrefKey(businessId), String(value))
  } catch {
    /* ignore */
  }
}

export const useAppStore = create<AppState>((set, get) => ({
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
        businessId: data.business.id > 0 ? data.business.id : null,
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

      // Restore the user's last branch selection ("all branches" or a specific branch).
      const pref = loadBranchPref(data.business.id)
      if (pref !== null) {
        const desiredId = pref === 'all' ? null : pref
        const currentId = data.branch?.id ?? null
        if (desiredId !== currentId) {
          try {
            await get().switchBranch(desiredId)
          } catch {
            // The remembered branch is no longer accessible; fall back to the default.
            saveBranchPref(data.business.id, null)
          }
        }
      }
    } catch (error) {
      set({ contextLoaded: true, contextError: error instanceof Error ? error.message : String(error) })
    }
  },

  async switchBranch(branchId) {
    set({ switchPending: true })
    try {
      const { data } = await businessApi.switchBranch(branchId ?? null)
      setRequestContext({ branchId: branchId ?? null })
      set({ context: data as ActiveContext, switchPending: false })
      saveBranchPref(data.business.id, branchId ?? 'all')
    } catch (error) {
      set({ switchPending: false })
      throw error
    }
  },
}))

applyTheme(initialTheme())