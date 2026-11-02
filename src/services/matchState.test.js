import { describe, it, expect } from "vitest"
import { applyTick, applyFullState, isMatchOver, applyBehaviorChange, applySubstitution, applyPlayerDetails, playersMissingDetails, startPause, finishPause, countDownPause } from "./matchState"

const baseMatch = {
  currentTick: 10,
  totalTicks: 600,
  score: { home: 0, away: 0 },
  ball: { x: 52, y: 30 },
  players: [
    { player_id: 1, team_id: 1, name: "Ana", number: 9, attributes: { speed: 50 }, position: { x: 10, y: 10 }, current_action: "IDLE" },
    { player_id: 2, team_id: 2, name: "Beto", number: 4, attributes: { speed: 40 }, position: { x: 90, y: 20 }, current_action: "IDLE" },
  ],
}

describe("applyTick", () => {
  it("actualiza tick, marcador, pelota y posición/acción de los jugadores", () => {
    const tick = {
      current_tick: 11,
      total_ticks: 600,
      score: { home: 1, away: 0 },
      ball: { x: 60, y: 31 },
      players: [{ player_id: 1, team_id: 1, position: { x: 12, y: 11 }, current_action: "RUN" }],
    }

    const result = applyTick(baseMatch, tick)

    expect(result.currentTick).toBe(11)
    expect(result.score).toEqual({ home: 1, away: 0 })
    expect(result.ball).toEqual({ x: 60, y: 31 })
    expect(result.players[0].position).toEqual({ x: 12, y: 11 })
    expect(result.players[0].current_action).toBe("RUN")
  })

  it("conserva nombre, número y atributos (datos que el tick no trae)", () => {
    const tick = { current_tick: 11, players: [{ player_id: 1, position: { x: 1, y: 1 }, current_action: "RUN" }] }

    const result = applyTick(baseMatch, tick)

    expect(result.players[0].name).toBe("Ana")
    expect(result.players[0].attributes).toEqual({ speed: 50 })
  })

  it("Debería sacar de la cancha al jugador que dejó de venir en el tick (fue sustituido)", () => {
    const tick = { current_tick: 11, players: [{ player_id: 1, position: { x: 1, y: 1 }, current_action: "RUN" }] }

    const result = applyTick(baseMatch, tick)

    expect(result.players.map((player) => player.player_id)).toEqual([1])
  })

  it("Debería agregar al jugador que entró, marcado para pedir sus datos", () => {
    const tick = {
      current_tick: 11,
      players: [
        { player_id: 1, team_id: 1, position: { x: 1, y: 1 }, current_action: "RUN" },
        { player_id: 7, team_id: 2, position: { x: 90, y: 20 }, current_action: "IDLE" },
      ],
    }

    const result = applyTick(baseMatch, tick)

    expect(result.players.map((player) => player.player_id)).toEqual([1, 7])
    expect(result.players[1]).toMatchObject({ team_id: 2, position: { x: 90, y: 20 }, needsDetails: true })
    expect(playersMissingDetails(result)).toEqual([7])
  })

  it("ignora un tick más viejo que el actual", () => {
    expect(applyTick(baseMatch, { current_tick: 5, score: { home: 9, away: 9 } })).toBe(baseMatch)
  })

  it("ignora mensajes sin current_tick", () => {
    expect(applyTick(baseMatch, {})).toBe(baseMatch)
    expect(applyTick(baseMatch, null)).toBe(baseMatch)
  })

  it("no modifica el estado original", () => {
    applyTick(baseMatch, { current_tick: 11, score: { home: 3, away: 3 }, players: [] })

    expect(baseMatch.currentTick).toBe(10)
    expect(baseMatch.score).toEqual({ home: 0, away: 0 })
  })

  it("ignora los ticks mientras el partido está en pausa (marcador, reloj y cancha congelados)", () => {
    const pausedMatch = { ...baseMatch, pause: { type: "HT", remainingSeconds: 30 } }
    const tick = {
      current_tick: 11,
      score: { home: 1, away: 0 },
      ball: { x: 60, y: 31 },
      players: [{ player_id: 1, position: { x: 12, y: 11 }, current_action: "RUN" }],
    }

    expect(applyTick(pausedMatch, tick)).toBe(pausedMatch)
  })
})

describe("applyFullState", () => {
  it("acepta un estado igual o más nuevo", () => {
    const fresh = { currentTick: 50, totalTicks: 600, score: { home: 2, away: 1 }, ball: null, players: baseMatch.players }

    expect(applyFullState(baseMatch, fresh).currentTick).toBe(50)
  })

  it("descarta un estado más viejo que el actual", () => {
    const old = { ...baseMatch, currentTick: 3 }

    expect(applyFullState(baseMatch, old)).toBe(baseMatch)
  })

  it("quita la pausa si el estado nuevo dice que ya no hay pausa (por ejemplo, al reconectar)", () => {
    const pausedMatch = { ...baseMatch, pause: { type: "HT", remainingSeconds: 30 } }

    expect(applyFullState(pausedMatch, { ...baseMatch, pause: null }).pause).toBeNull()
  })

  it("Debería usar la pelota y la posición de los jugadores que trae /state", () => {
    const fresh = {
      currentTick: 10,
      totalTicks: 600,
      score: { home: 0, away: 0 },
      ball: { x: 62, y: 20 },
      players: [{ player_id: 1, team_id: 1, name: "Ana", position: { x: 15, y: 12 }, current_action: "idle" }],
      pause: { type: "HALF_TIME", remainingSeconds: 12 },
    }

    const result = applyFullState(baseMatch, fresh)

    expect(result.ball).toEqual({ x: 62, y: 20 })
    expect(result.players[0].position).toEqual({ x: 15, y: 12 })
    expect(result.pause).toEqual({ type: "HALF_TIME", remainingSeconds: 12 })
  })
})

describe("pausas", () => {
  it("startPause guarda el tipo y arranca la cuenta desde duration_seconds", () => {
    const result = startPause(baseMatch, { type: "HT", duration_seconds: 30, current_tick: 10 })

    expect(result.pause).toEqual({ type: "HT", remainingSeconds: 30 })
    expect(result.score).toBe(baseMatch.score) // lo demás no cambia
    expect(baseMatch.pause).toBeUndefined() // no modifica el original
  })

  it("finishPause vuelve a 'sin pausa'", () => {
    const pausedMatch = { ...baseMatch, pause: { type: "HT", remainingSeconds: 5 } }

    expect(finishPause(pausedMatch).pause).toBeNull()
  })

  it("countDownPause descuenta un segundo", () => {
    const pausedMatch = { ...baseMatch, pause: { type: "HT", remainingSeconds: 30 } }

    expect(countDownPause(pausedMatch).pause).toEqual({ type: "HT", remainingSeconds: 29 })
  })

  it("countDownPause no baja de 0 y no hace nada si no hay pausa", () => {
    const pauseAtZero = { ...baseMatch, pause: { type: "HT", remainingSeconds: 0 } }
    const notPaused = { ...baseMatch, pause: null }

    expect(countDownPause(pauseAtZero)).toBe(pauseAtZero)
    expect(countDownPause(notPaused)).toBe(notPaused)
  })

  it("Debería ignorar una pausa duplicada y conserva el estado actual", () => {
    const pausedMatch = { ...baseMatch, pause: { type: "HT", remainingSeconds: 12 }}
    const result = startPause(pausedMatch, {
      type: "HT",
      duration_seconds: 20,
      current_tick: 120,
    })

    expect(result).toBe(pausedMatch)
  })

  it("Deberia devolver al no haber una pausa el estado del partido", () => {
    const notPaused = { ...baseMatch, pause: null }
    expect(finishPause(notPaused)).toBe(notPaused)
  })  
})

describe("isMatchOver", () => {
  it("es true cuando el tick alcanza el total", () => {
    expect(isMatchOver({ currentTick: 600, totalTicks: 600 })).toBe(true)
  })

  it("es false mientras falten ticks", () => {
    expect(isMatchOver({ currentTick: 599, totalTicks: 600 })).toBe(false)
  })
})

describe("applyBehaviorChange", () => {
  it("Debería cambiar solo el comportamiento del jugador indicado", () => {
    const result = applyBehaviorChange({ ...baseMatch, players: [
      { ...baseMatch.players[0], behavior_id: 3 },
      baseMatch.players[1],
    ] }, 1, 8)

    expect(result.players[0].behavior_id).toBe(8)
    expect(result.players[0].position).toEqual({ x: 10, y: 10 })
    expect(result.players[1]).toBe(baseMatch.players[1])
  })
})

describe("sustituciones", () => {
  it("Debería mostrar al que entró en el lugar del que salió", () => {
    const result = applySubstitution(baseMatch, 2, 7)

    expect(result.players.map((player) => player.player_id)).toEqual([1, 7])
    expect(result.players[1]).toMatchObject({ team_id: 2, position: { x: 90, y: 20 }, needsDetails: true })
    expect(result.players[0]).toBe(baseMatch.players[0])
  })

  it("Debería usar los datos del suplente que entra, sin pedirlos de nuevo, y mandar al banco al que sale", () => {
    const bench = { player_id: 7, team_id: 2, name: "Nico González", number: 11, attributes: { speed: 70 } }
    const matchWithBench = { ...baseMatch, substitutes: [bench] }

    const result = applySubstitution(matchWithBench, 2, 7)

    expect(result.players[1]).toMatchObject({ name: "Nico González", attributes: { speed: 70 }, position: { x: 90, y: 20 } })
    expect(playersMissingDetails(result)).toEqual([])
    expect(result.substitutes.map((player) => player.player_id)).toEqual([2])
    expect(matchWithBench.substitutes).toEqual([bench]) // no modifica el original
  })

  it("No debería cambiar nada si el que sale no está en cancha o el que entra ya está", () => {
    expect(applySubstitution(baseMatch, 99, 7)).toBe(baseMatch)
    expect(applySubstitution(baseMatch, 2, 1)).toBe(baseMatch)
  })

  it("Debería completar los datos del que entró conservando su posición", () => {
    const substituted = applySubstitution(baseMatch, 2, 7)
    const fresh = [{ player_id: 7, team_id: 2, name: "Nico González", number: 11, attributes: { speed: 70 } }]

    const result = applyPlayerDetails(substituted, fresh)

    expect(result.players[1]).toMatchObject({ name: "Nico González", number: 11, position: { x: 90, y: 20 } })
    expect(result.players[1].needsDetails).toBeUndefined()
    expect(playersMissingDetails(result)).toEqual([])
  })
})
