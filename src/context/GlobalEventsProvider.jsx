import { useEffect } from "react"
import { useSession } from "../hooks/useSession"
import { connect, disconnect } from "../services/globalSocket"

// Mantiene abierta la conexión al canal global mientras haya sesión activa
// (después del login o al recargar con la sesión guardada).
// Al cerrar sesión o al vencer la sesión, isAuthenticated pasa a false y se desconecta.
function GlobalEventsProvider({ children }) {
  const { isAuthenticated } = useSession()

  useEffect(() => {
    if (!isAuthenticated) return

    connect()
    return () => disconnect()
  }, [isAuthenticated])

  return children
}

export default GlobalEventsProvider