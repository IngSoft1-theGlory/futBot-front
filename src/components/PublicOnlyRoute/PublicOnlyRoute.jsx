import { Navigate, Outlet } from "react-router-dom"
import { useSession } from "../../hooks/useSession"

// Pantallas solo para usuarios sin sesión (login, registro).
// Si ya hay sesión, redirige al inicio.
function PublicOnlyRoute() {
  const { isAuthenticated } = useSession()

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}

export default PublicOnlyRoute