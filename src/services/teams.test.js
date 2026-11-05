import { describe, it, expect, vi } from "vitest"

vi.mock("./createhttpService", () => ({ httpService: { get: vi.fn() } }))

import { httpService } from "./createhttpService"
import { fetchTeam } from "./teams"

describe("fetchTeam", () => {
  it("Debería pedir el equipo indicado y pasar sus datos a camelCase", async () => {
    httpService.get.mockResolvedValue({
      team_id: 1, name: "Instituto", team_logo: "data:image/png;base64,AAAA",
      position: 3, matches_played: 10, wins: 6, draws: 2, losses: 2, points: 20,
    })

    const team = await fetchTeam(1)

    expect(httpService.get).toHaveBeenCalledWith("/teams/1")
    expect(team).toEqual({
      teamId: 1, name: "Instituto", logo: "data:image/png;base64,AAAA",
      position: 3, matchesPlayed: 10, wins: 6, draws: 2, losses: 2, points: 20,
    })
  })

  it("Debería dejar el logo en null si el back no lo manda", async () => {
    httpService.get.mockResolvedValue({ team_id: 1, name: "Instituto", position: 1 })

    const team = await fetchTeam(1)

    expect(team.logo).toBeNull()
  })
})
