import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'

export function ProtectedRoute() {
  const { user, carregando } = useAuth()
  const location = useLocation()

  if (carregando) {
    return <p className="p-8 text-wood">Carregando…</p>
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ de: location.pathname }} />
  }
  return <Outlet />
}
