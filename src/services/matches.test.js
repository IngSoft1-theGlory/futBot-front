import { describe, it, expect, vi, beforeEach } from "vitest"

// Se reemplaza el cliente HTTP por uno falso: así controlamos qué "responde el backend"
vi.mock("./createhttpService", async (importOriginal) => {
  const original = await importOriginal()
  return { ...original, httpService: { get: vi.fn(), post: vi.fn() } }
})

import { httpService } from "./createhttpService"
import { fetchMatchState, requestSubstitution } from "./matches"

// Respuesta de GET /matches/{matchId}/state con un partido en juego
const STATE_RESPONSE = {
  match_id: 12,
  phase: "IN_PROGRESS",
  current_tick: 600,
  total_ticks: 1200,
  score: { home: 1, away: 0 },
  ball: { x: 52.5, y: 34 },
  players: [],
}

describe("fetchMatchState", () => {
  beforeEach(() => {
    httpService.get.mockReset()
  })

  it("Debería pedir el estado del partido a /matches/{matchId}/state", async () => {
    httpService.get.mockResolvedValue(STATE_RESPONSE)

    await fetchMatchState("12")

    expect(httpService.get).toHaveBeenCalledWith("/matches/12/state")
  })

  it("Debería devolver la pausa con su tipo y los segundos restantes cuando phase es PAUSED", async () => {
    httpService.get.mockResolvedValue({
      ...STATE_RESPONSE,
      phase: "PAUSED",
      pause: { type: "HT", remaining_seconds: 42 },
    })

    const state = await fetchMatchState("12")

    expect(state.pause).toEqual({ type: "HT", remainingSeconds: 42 })
    expect(state.currentTick).toBe(600)
  })

  it("Debería devolver los suplentes del propio equipo", async () => {
    const substitutes = [{ player_id: 105, team_id: 1, name: "Nico González", number: 15 }]
    httpService.get.mockResolvedValue({ ...STATE_RESPONSE, substitutes })

    const state = await fetchMatchState("12")

    expect(state.substitutes).toEqual(substitutes)
  })

  it("Debería devolver una lista vacía si /state no trae suplentes", async () => {
    httpService.get.mockResolvedValue(STATE_RESPONSE)

    const state = await fetchMatchState("12")

    expect(state.substitutes).toEqual([])
  })

  it("Debería devolver la pelota y, de cada jugador, su posición y acción", async () => {
    const players = [{ player_id: 101, team_id: 1, position: { x: 50, y: 28.5 }, current_action: "idle" }]
    httpService.get.mockResolvedValue({ ...STATE_RESPONSE, players })

    const state = await fetchMatchState("12")

    expect(state.ball).toEqual({ x: 52.5, y: 34 })
    expect(state.players).toEqual(players)
  })

  it.each([
    { caso: "el partido está en juego", response: STATE_RESPONSE },
    {
      caso: "llega una pausa pero phase no es PAUSED",
      response: { ...STATE_RESPONSE, pause: { type: "HT", remaining_seconds: 42 } },
    },
    { caso: "phase es PAUSED pero no llegan los datos de la pausa", response: { ...STATE_RESPONSE, phase: "PAUSED" } },
  ])("Debería no activar ninguna pausa cuando $caso", async ({ response }) => {
    httpService.get.mockResolvedValue(response)

    const state = await fetchMatchState("12")

    expect(state.pause).toBeNull()
  })
})

describe("requestSubstitution", () => {
  beforeEach(() => {
    httpService.post.mockReset()
  })

  it("Debería pedir la sustitución al equipo y partido indicados, con quién sale y quién entra", async () => {
    httpService.post.mockResolvedValue({})

    await requestSubstitution(12, 1, 101, 105)

    expect(httpService.post).toHaveBeenCalledWith("/matches/12/teams/1/substitutions", {
      player_out_id: 101,
      player_in_id: 105,
    })
  })
})

describe("fetchMatchState - penales", () => {
  it("Debería indicar que el partido está en penales si se recarga durante la tanda", async () => {
    httpService.get.mockResolvedValue({
      ...STATE_RESPONSE,
      score: { home: 1, away: 1, phome: 2, paway: 1 },
    })

    const state = await fetchMatchState("12")

    expect(state.isPenalties).toBe(true)
  })
})
