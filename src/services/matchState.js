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
//
// No modifica `match`: devuelve un objeto nuevo (así React detecta el cambio y redibuja).
export function applyTick(match, tick) {
  // Un mensaje sin tick no sirve: se deja todo como estaba
  if (!tick || !Number.isFinite(tick.current_tick)) return match

  // Durante una pausa el partido está congelado: marcador, reloj y cancha no cambian
  if (match.pause) return match

  // Un tick viejo (por ejemplo, llegó tarde) nunca debe pisar uno más nuevo
  if (tick.current_tick < match.currentTick) return match

  // Armamos un "diccionario" player_id -> datos del tick, para buscar rápido
  const tickPlayers = new Map()
  for (const tickPlayer of tick.players ?? []) {
    tickPlayers.set(tickPlayer.player_id, tickPlayer)
  }

  const players = match.players.map((player) => {
    const fromTick = tickPlayers.get(player.player_id)
    if (!fromTick) return player // este jugador no vino en el tick: se queda igual

    return {
      ...player, // conserva name, number, attributes, etc.
      position: fromTick.position,
      current_action: fromTick.current_action,
    }
  })

  return {
    ...match,
    currentTick: tick.current_tick,
    totalTicks: tick.total_ticks ?? match.totalTicks,
    score: tick.score ?? match.score,
    ball: tick.ball ?? match.ball,
    players,
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
