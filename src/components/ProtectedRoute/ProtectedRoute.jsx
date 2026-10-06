import { Navigate, Outlet, useLocation } from "react-router-dom"
import { useSession } from "../../hooks/useSession"

// Solo deja pasar a usuarios con sesión. Si no hay sesión, redirige al login.
function ProtectedRoute() {
  const { isAuthenticated } = useSession()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}

export default ProtectedRoute