import { ApiError } from "./createhttpService"

// Mensajes de error de la sustitución. Los usan el menú de pausa y el panel del jugador.

const NETWORK_ERROR_MESSAGE =
  "No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo."

// unico lugar donde se traduce cada codigo de error de la sustitución, Si el código no está, se usa el message que manda el backend
const ERROR_MESSAGES = {
  SUBSTITUTION_LIMIT_EXCEEDED: "Ya hiciste un cambio en esta pausa.",
  INVALID_PLAYER_SELECTION: "Elegí un titular que esté en cancha y un suplente de tu equipo.",
  UNAUTHORIZED_ACTION: "No participás en este partido.",
  RESOURCE_NOT_FOUND: "El partido ya no está en juego o no se encontró el jugador elegido.",
}

export function getSubstitutionErrorMessage(error) {
  if (!(error instanceof ApiError)) return NETWORK_ERROR_MESSAGE
  return ERROR_MESSAGES[error.error] ?? error.message
}
