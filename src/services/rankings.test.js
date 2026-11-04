import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("./createhttpService", () => ({ httpService: { get: vi.fn() } }))

import { httpService } from "./createhttpService"
import { fetchGlobalRanking } from "./rankings"

describe("fetchGlobalRanking", () => {
  beforeEach(() => {
    httpService.get.mockReset()
  })

  it("Debería pedir la página indicada y pasar los clubes a camelCase", async () => {
    httpService.get.mockResolvedValue({
      ranking: [{ position: 1, team_id: 5, team_name: "alfajoresFC", goals_for: 7, goals_against: 2, points: 9 }],
    })
    const data = await fetchGlobalRanking({ page: 2, limit: 20 })
    expect(httpService.get).toHaveBeenCalledWith("/rankings/global?page=2&limit=20")
    expect(data.ranking[0]).toMatchObject({ position: 1, teamId: 5, teamName: "alfajoresFC", goalDiff: 5, points: 9 })
  })

  it("Debería indicar que no hay página siguiente si llegan menos clubes que el límite", async () => {
    httpService.get.mockResolvedValue({ ranking: [{ position: 1, team_id: 5, team_name: "alfajoresFC" }] })
    const data = await fetchGlobalRanking({ page: 1, limit: 20 })
    expect(data.hasNextPage).toBe(false)
  })
})
