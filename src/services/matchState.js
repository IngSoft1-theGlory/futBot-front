// Funciones "puras" para manejar el estado del partido.
// Puras = no usan React, ni red, ni nada externo: reciben datos y devuelven datos.
// Por eso son fáciles de entender y de testear.

// Nombre del evento que manda el motor en cada tick
export const TICK_UPDATE = "TICK_UPDATE"

// Evento del canal global que avisa que un partido terminó
export const MATCH_FINISHED = "MATCH_FINISHED"

// ¿Terminó el partido? Es true cuando el tick actual alcanza (o pasa) el total.
export function isMatchOver(match) {
  return match.totalTicks > 0 && match.currentTick >= match.totalTicks
}

// Combina el estado actual del partido con un TICK_UPDATE.
//
// - Del tick se actualiza: tick, total, marcador, pelota, y posición + acción de cada jugador.
// - Lo que NO viene en el tick (nombre, número, atributos, comportamiento) se conserva
//   del estado anterior. Los jugadores se cruzan por player_id.
// - El tick trae a los jugadores que están EN CANCHA, así que manda él:
//   el que dejó de venir salió (sustitución) y se saca; el que viene y no conocíamos
//   entró, y se agrega marcado con needsDetails hasta que lleguen sus datos de /state.
//
// No modifica `match`: devuelve un objeto nuevo (así React detecta el cambio y redibuja).
export function applyTick(match, tick) {
  // Un mensaje sin tick no sirve: se deja todo como estaba
  if (!tick || !Number.isFinite(tick.current_tick)) return match

  // Durante una pausa el partido está congelado: marcador, reloj y cancha no cambian
  if (match.pause) return match

  // Un tick viejo (por ejemplo, llegó tarde) nunca debe pisar uno más nuevo
  if (tick.current_tick < match.currentTick) return match

  return {
    ...match,
    currentTick: tick.current_tick,
    totalTicks: tick.total_ticks ?? match.totalTicks,
    score: tick.score ?? match.score,
    ball: tick.ball ?? match.ball,
    players: Array.isArray(tick.players) ? playersOnPitch(match.players, tick.players) : match.players,
  }
}

// Arma la lista de jugadores en cancha a partir del tick
function playersOnPitch(currentPlayers, tickPlayers) {
  // "diccionario" player_id -> jugador que ya conocemos, para buscar rápido
  const knownPlayers = new Map(currentPlayers.map((player) => [player.player_id, player]))

  return tickPlayers.map((fromTick) => {
    const known = knownPlayers.get(fromTick.player_id)
    const player = known ?? { player_id: fromTick.player_id, team_id: fromTick.team_id, needsDetails: true }

    return {
      ...player, // conserva name, number, attributes, etc.
      position: fromTick.position,
      current_action: fromTick.current_action,
    }
  })
}

// ---------- Sustituciones ----------

// Aplica una sustitución confirmada por el back: el que entra ocupa el lugar
// (posición) del que sale, y el que sale deja la cancha y pasa al banco. Sirve para
// mostrar el cambio enseguida, aunque el partido esté en pausa y no lleguen ticks.
// Si el que entra no está en la lista de suplentes, queda con needsDetails hasta que
// lleguen sus datos de /state.
export function applySubstitution(match, playerOutId, playerInId) {
  const playerOut = match.players.find((player) => player.player_id === playerOutId)
  const alreadyOnPitch = match.players.some((player) => player.player_id === playerInId)
  if (!playerOut || alreadyOnPitch) return match

  const substitutes = match.substitutes ?? []
  const fromBench = substitutes.find((player) => player.player_id === playerInId)

  const playerIn = {
    ...(fromBench ?? { player_id: playerInId, team_id: playerOut.team_id, needsDetails: true }),
    position: playerOut.position,
    current_action: "IDLE",
  }

  return {
    ...match,
    players: match.players.map((player) => (player.player_id === playerOutId ? playerIn : player)),
    substitutes: substitutes.map((player) => (player.player_id === playerInId ? playerOut : player)),
  }
}

// Ids de los jugadores en cancha de los que todavía faltan datos (nombre, número...)
export function playersMissingDetails(match) {
  return (match?.players ?? []).filter((player) => player.needsDetails).map((player) => player.player_id)
}

// Completa los datos de los jugadores marcados con needsDetails con los de /state.
// La posición y la acción se conservan, porque /state no las trae.
export function applyPlayerDetails(match, freshPlayers) {
  const freshById = new Map(freshPlayers.map((player) => [player.player_id, player]))

  return {
    ...match,
    players: match.players.map((player) => {
      const fresh = freshById.get(player.player_id)
      if (!player.needsDetails || !fresh) return player

      return { ...fresh, position: player.position, current_action: player.current_action }
    }),
  }
}

// Combina el estado actual con el que devuelve GET /state (se usa al reconectar).
// Solo lo acepta si es igual o más nuevo que el que ya tenemos.
// Tambien reemplaza la pausa: si mientras estuvimos desconectados la pausa terminó,
// /state trae pause: null y la pantalla deja de mostrarla
export function applyFullState(match, freshState) {
  if (match && freshState.currentTick < match.currentTick) return match
  return { ...match, ...freshState }
}

// Cambia el comportamiento de un jugador (después de que el back confirmó el cambio).
// El resto del partido queda igual.
export function applyBehaviorChange(match, playerId, behaviorId) {
  return {
    ...match,
    players: match.players.map((player) =>
      player.player_id === playerId ? { ...player, behavior_id: behaviorId } : player
    ),
  }
}

// ---------- Pausas ----------
// Mientras hay una pausa, match.pause es { type, remainingSeconds }.
// Cuando no hay pausa, match.pause es null.

// Empieza una pausa (evento PAUSE_STARTED).
// Al principio faltan todos los segundos de la pausa: duration_seconds.
export function startPause(match, message) {
  return {
    ...match,
    pause: { type: message.type, remainingSeconds: message.duration_seconds },
  }
}

// Termina la pausa (evento PAUSE_FINISHED): el partido vuelve a "sin pausa".
export function finishPause(match) {
  return { ...match, pause: null }
}

// Descuenta un segundo de la pausa (se llama una vez por segundo mientras dura).
// Nunca baja de 0: si llega a 0 antes que PAUSE_FINISHED, se queda en 0 esperando
// ese aviso, porque es el backend el que decide cuándo termina la pausa.
export function countDownPause(match) {
  if (!match?.pause || match.pause.remainingSeconds <= 0) return match

  return {
    ...match,
    pause: { ...match.pause, remainingSeconds: match.pause.remainingSeconds - 1 },
  }
}