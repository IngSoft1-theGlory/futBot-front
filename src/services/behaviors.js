import { httpService } from "./createhttpService"

// Comportamientos que el usuario puede usar: los predeterminados y los propios (GET /behaviors)
export async function fetchBehaviors() {
  const data = await httpService.get("/behaviors")
  return Array.isArray(data) ? data : []
}
/*
Deja solo los comportamientos de jugador (behavior_type "PLAYER"), los de DT (behavior_type "COACH") nunca se pueden asignar a un jugador

Ejemplo: [Defensivo (PLAYER), Presión alta (COACH)] -> [Defensivo (PLAYER)]
*/
export function filterPlayerBehaviors(behaviors) {
  return behaviors.filter((behavior) => behavior.behavior_type === "PLAYER")
}

/*
Deja solo los comportamientos de DT (behavior_type "COACH"), los de jugador (behavior_type "PLAYER") no se pueden asignar a un DT

Ejemplo: [Defensivo (PLAYER), Presión alta (COACH)] -> [Presión alta (COACH)]
*/
export function filterCoachBehaviors(behaviors) {
  return behaviors.filter((behavior) => behavior.behavior_type === "COACH")
}
