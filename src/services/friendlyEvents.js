import { friendlyMapping, FRIENDLY_STATUS_PENDING } from "./friendlies"

// Eventos del canal global que modifican la lista de amistosos disponibles
export const FRIENDLY_CREATED = "FRIENDLY_CREATED"
export const FRIENDLY_CANCELLED = "FRIENDLY_CANCELLED"
export const GUEST_JOINED_FRIENDLY = "GUEST_JOINED_FRIENDLY"
export const MATCH_STARTED = "MATCH_STARTED"

export const FRIENDLY_LIST_EVENTS = [
  FRIENDLY_CREATED,
  FRIENDLY_CANCELLED,
  GUEST_JOINED_FRIENDLY,
  MATCH_STARTED,
]

// Eventos que hacen que un amistoso deje de estar disponible
const REMOVAL_EVENTS = new Set([FRIENDLY_CANCELLED, GUEST_JOINED_FRIENDLY, MATCH_STARTED])

/*
Devuelve la lista actualizada según el evento recibido, sin modificar la original.
Si el evento no cambia nada, devuelve la misma lista (misma referencia).

- FRIENDLY_CREATED: agrega el amistoso al final, salvo que ya esté en la lista
  (puede llegar mientras se hace la carga inicial y venir también en esa respuesta).
- FRIENDLY_CANCELLED, GUEST_JOINED_FRIENDLY y MATCH_STARTED: lo quitan, si estaba.
*/
export function applyFriendlyEvent(matches, eventName, data) {
  const matchId = data?.match_id
  if (matchId == null) return matches

  const isInList = matches.some((match) => match.matchId === matchId)

  if (eventName === FRIENDLY_CREATED) {
    if (isInList) return matches
    if (data.status && data.status !== FRIENDLY_STATUS_PENDING) return matches
    return [...matches, friendlyMapping({ status: FRIENDLY_STATUS_PENDING, ...data })]
  }

  if (REMOVAL_EVENTS.has(eventName)) {
    if (!isInList) return matches
    return matches.filter((match) => match.matchId !== matchId)
  }

  return matches
}
