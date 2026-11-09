import { describe, it, expect, vi, beforeEach } from "vitest"

// Se reemplaza el cliente HTTP por uno falso: así controlamos qué "responde el backend"
vi.mock("./createhttpService", async (importOriginal) => {
  const original = await importOriginal()
  return { ...original, httpService: { get: vi.fn() } }
})

import { httpService } from "./createhttpService"
import { fetchMatchResult } from "./matchResult"

// Respuesta de GET /matches/{matchId}/result de un partido 0 - 0 ganado 2 a 1 por penales
const RESULT_WITH_PENALTIES = {
  match_id: 9,
  status: "FINISHED",
  home_team: { team_id: 5, team_name: "Los Pumas", goals: 0, penalty_goals: 2 },
  away_team: { team_id: 7, team_name: "Los Tigres", goals: 0, penalty_goals: 1 },
}

describe("fetchMatchResult", () => {
  beforeEach(() => {
    httpService.get.mockReset()
  })

  it("Debería devolver los goles de penales de cada equipo", async () => {
    httpService.get.mockResolvedValue(RESULT_WITH_PENALTIES)

    const result = await fetchMatchResult("9")

    expect(httpService.get).toHaveBeenCalledWith("/matches/9/result")
    expect(result.home).toEqual({ id: 5, name: "Los Pumas", goals: 0, penaltyGoals: 2 })
    expect(result.away).toEqual({ id: 7, name: "Los Tigres", goals: 0, penaltyGoals: 1 })
  })

  it("Debería conservar 0 penales convertidos como 0 (no como null)", async () => {
    httpService.get.mockResolvedValue({
      ...RESULT_WITH_PENALTIES,
      away_team: { ...RESULT_WITH_PENALTIES.away_team, penalty_goals: 0 },
    })

    const result = await fetchMatchResult("9")

    expect(result.away.penaltyGoals).toBe(0)
  })

  it("Debería dejar penaltyGoals en null si no hubo penales o si el campo no viene", async () => {
    httpService.get.mockResolvedValue({
      match_id: 9,
      status: "FINISHED",
      home_team: { team_id: 5, team_name: "Los Pumas", goals: 2, penalty_goals: null },
      away_team: { team_id: 7, team_name: "Los Tigres", goals: 1 }, // sin el campo penalty_goals
    })

    const result = await fetchMatchResult("9")

    expect(result.home.penaltyGoals).toBeNull()
    expect(result.away.penaltyGoals).toBeNull()
  })

  it("Debería devolver el leagueId si el partido es de liga", async () => {
    httpService.get.mockResolvedValue({ ...RESULT_WITH_PENALTIES, league_id: 3 })

    const result = await fetchMatchResult("9")

    expect(result.leagueId).toBe(3)
  })

  it("Debería dejar leagueId en null si el partido es amistoso o si el campo no viene", async () => {
    httpService.get.mockResolvedValueOnce({ ...RESULT_WITH_PENALTIES, league_id: null })
    expect((await fetchMatchResult("9")).leagueId).toBeNull()

    // RESULT_WITH_PENALTIES no trae el campo league_id (como un back que todavía no lo manda)
    httpService.get.mockResolvedValueOnce(RESULT_WITH_PENALTIES)
    expect((await fetchMatchResult("9")).leagueId).toBeNull()
  })
})
