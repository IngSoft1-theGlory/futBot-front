import { describe, it, expect, vi, beforeEach } from "vitest"

// Se reemplaza el cliente HTTP por uno falso: así controlamos qué "responde el backend"
vi.mock("./createhttpService", async (importOriginal) => {
  const original = await importOriginal()
  return { ...original, httpService: { get: vi.fn() } }
})

import { httpService } from "./createhttpService"
import { fetchMatchState } from "./matches"

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
