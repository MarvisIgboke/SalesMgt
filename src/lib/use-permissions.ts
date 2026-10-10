import { useCallback, useMemo } from 'react'
import { useAuthStore } from '@/stores/auth'

export function usePermissions() {
  const permissions = useAuthStore((s) => s.session?.user.permissions ?? [])

  const set = useMemo(() => new Set(permissions), [permissions])

  const can = useCallback((permission: string) => set.has(permission), [set])

  const canAny = useCallback(
    (...keys: string[]) => keys.some((key) => set.has(key)),
    [set],
  )

  return { permissions, can, canAny }
}
