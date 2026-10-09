import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'

export function RequireAuth() {
  const status = useAuthStore((s) => s.status)
  const location = useLocation()

  if (status !== 'authenticated') {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  return <Outlet />
}

export function RedirectIfAuthed() {
  const status = useAuthStore((s) => s.status)
  if (status === 'authenticated') return <Navigate to="/dashboard" replace />
  return <Outlet />
}