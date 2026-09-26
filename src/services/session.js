const TOKEN_KEY = "futbot_token"
const USER_KEY = "futbot_user"

// Funciones que se ejecutan cuando el backend informa que la sesión ya no es válida
const sessionExpiredListeners = new Set()

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function getUser() {
  const rawUser = localStorage.getItem(USER_KEY)
  if (!rawUser) return null

  try {
    return JSON.parse(rawUser)
  } catch {
    return null
  }
}

// Guarda el token y el usuario que devuelve POST /auth/login
export function setSession({ token, user }) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

// Permite reaccionar cuando la sesión vence. Devuelve una función para desuscribirse.
export function onSessionExpired(listener) {
  sessionExpiredListeners.add(listener)
  return () => {
    sessionExpiredListeners.delete(listener)
  }
}

// Lo invoca createHttpService al recibir un 401 de sesión inválida o vencida
export function expireSession() {
  clearSession()
  sessionExpiredListeners.forEach((listener) => listener())
}