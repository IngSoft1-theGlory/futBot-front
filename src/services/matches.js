import { httpService } from "./createhttpService"

// Llamadas HTTP de la pantalla del partido.
// Cada función pide algo al backend y lo devuelve en el formato que usa la UI.

// Pide el estado actual del partido (GET /matches/{matchId}/state).
// Se usa al entrar a la pantalla y cada vez que la conexión en vivo se recupera.
//
// Forma esperada de la respuesta:
//   { current_tick, total_ticks, phase, score: { home, away, phome, paway }, ball: { x, y },
//     players: [{ player_id, team_id, name, number, attributes, behavior_id,
//                 position: { x, y }, current_action }],
//     substitutes: [{ player_id, team_id, name, number, attributes, behavior_id }],   <- solo los del propio equipo
//     pause: { type, remaining_seconds } }   <- cuando phase es "PAUSED"
export async function fetchMatchState(matchId) {
  const data = await httpService.get(`/matches/${matchId}/state`)

  return {
    currentTick: data.current_tick,
    totalTicks: data.total_ticks,
    score: data.score,
    ball: data.ball ?? null,
    players: data.players ?? [],
    substitutes: data.substitutes ?? [],
    pause: toPause(data),
    // Sirve si se recarga la pantalla durante los penales
    isPenalties: data.phase === "PENALTIES" || data.score?.phome != null,
  }
}

// Convierte la pausa que informa /state a { type, remainingSeconds }, si el partido NO esta en pausa devuelve null, así /state no activa ninguna pausa
// remaining_seconds puede traer decimales (ej: 41.2): se redondea para arriba, porque la cuenta regresiva va de a segundos enteros
function toPause(data) {
  if (data.phase !== "PAUSED" || !data.pause) return null
  return { type: data.pause.type, remainingSeconds: Math.ceil(data.pause.remaining_seconds) }
}

// Pide los datos de los equipos (GET /friendly/{matchId}): nombre, logo y cuál es el local.
// /state NO trae estos datos, por eso hace falta este segundo pedido.
export async function fetchMatchTeams(matchId) {
  const data = await httpService.get(`/friendly/${matchId}`)

  return {
    home: toTeam(data.team_host), // team_host es el equipo local
    away: toTeam(data.team_away),
  }
}

// Convierte un equipo del backend a { id, name, logo }, que es lo que espera <MatchHeader>
function toTeam(team) {
  if (!team) return null
  return { id: team.team_id, name: team.team_name, logo: team.team_logo }
}

// Pide el token para conectarse al partido en vivo (POST /matches/{matchId}/live-token).
// Devuelve la URL del websocket (ya trae el token adentro).
// Hay que pedir un token NUEVO en cada intento de conexión.
export async function requestMatchWebsocketUrl(matchId) {
  const data = await httpService.post(`/matches/${matchId}/live-token`)

  if (!data?.websocket_url) {
    throw new Error("La respuesta no incluye websocket_url")
  }
  return data.websocket_url
}

// Cambia el comportamiento de un jugador propio durante el partido
// (PUT /matches/{matchId}/players/{playerId}/behavior). El motor lo aplica desde el próximo tick.
// Respuesta: { match_id, player_id, behavior_id }
export async function changePlayerBehavior(matchId, playerId, behaviorId) {
  return httpService.put(`/matches/${matchId}/players/${playerId}/behavior`, { behavior_id: behaviorId })
}

// Pide una sustitución durante una pausa (POST /matches/{matchId}/teams/{teamId}/substitutions):
// sale un titular y entra un suplente. Si el back la rechaza, httpService lanza un ApiError.
export async function requestSubstitution(matchId, teamId, playerOutId, playerInId) {
  return httpService.post(`/matches/${matchId}/teams/${teamId}/substitutions`, {
    player_out_id: playerOutId,
    player_in_id: playerInId,
  })
}
