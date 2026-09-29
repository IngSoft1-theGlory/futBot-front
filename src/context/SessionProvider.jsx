import { useCallback, useEffect, useMemo, useState } from "react"
import { SessionContext } from "./SessionContext"
import {
  getToken,
  getUser,
  setSession,
  clearSession,
  onSessionExpired,
} from "../services/session"
import { httpService } from "../services/createhttpService"

function readStoredSession() {
  const token = getToken()
  return token ? { token, user: getUser() } : null
}

function SessionProvider({ children }) {
  // Al cargar la app, se recupera la sesión guardada (si existe)
  const [session, setSessionState] = useState(readStoredSession)

  // Si createHttpService detecta un 401 de sesión, se limpia el estado.
  // Las rutas protegidas redirigen solas al login.
  useEffect(() => onSessionExpired(() => setSessionState(null)), [])

  // Se usa desde el login al recibir 200 OK de POST /auth/login
  const startSession = useCallback(({ token, tokenType, user }) => {
    setSession({ token, tokenType, user })
    setSessionState({ token, tokenType, user })
  }, [])

  const logout = useCallback(async () => {
    try {
      await httpService.post("/auth/logout")
    } catch {
      // Aunque falle el backend, la sesión se cierra igual en el cliente
    } finally {
      clearSession()
      setSessionState(null)
    }
  }, [])

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      isAuthenticated: Boolean(session),
      startSession,
      logout,
    }),
    [session, startSession, logout]
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export default SessionProvider