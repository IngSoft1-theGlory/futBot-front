// para correr el test = npx vitest run

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("./session", () => ({
  getToken: vi.fn(),
  expireSession: vi.fn(),
}))

function fakeResponse({ status = 200, ok = true, body = null } = {}) {
  return {
    status,
    ok,
    text: async () => (body === null ? "" : JSON.stringify(body)),
  }
}

import { fetchFriendlyMatches } from "./friendlies"

describe("fetchFriendlyMatches", () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("debería pedir /friendly con page, limit y status=PENDING por defecto", async () => {
    global.fetch.mockResolvedValue(
      fakeResponse({ body: { matches: [], page: 1, limit: 20, total: 0 } })
    )

    await fetchFriendlyMatches()

    const [url] = global.fetch.mock.calls[0]
    expect(url).toContain("/friendly?")
    expect(url).toContain("page=1")
    expect(url).toContain("limit=20")
    expect(url).toContain("status=PENDING")
  })

  it("debería usar el page/limit/status que se le pasan", async () => {
    global.fetch.mockResolvedValue(
      fakeResponse({ body: { matches: [], page: 2, limit: 5, total: 0 } })
    )

    await fetchFriendlyMatches({ page: 2, limit: 5, status: "PENDING" })

    const [url] = global.fetch.mock.calls[0]
    expect(url).toContain("page=2")
    expect(url).toContain("limit=5")
  })

  it("debería mapear los campos de cada match recibido", async () => {
    global.fetch.mockResolvedValue(
      fakeResponse({
        body: {
          matches: [
            {
              match_id: 1,
              team_host_id: 10,
              team_away_id: 20,
              status: "PENDING",
              match_duration: 90,
            },
          ],
          page: 1,
          limit: 20,
          total: 1,
        },
      })
    )

    const data = await fetchFriendlyMatches()

    expect(data.matches).toEqual([
      { matchId: 1, teamHostId: 10, teamAwayId: 20, status: "PENDING", matchDuration: 90 },
    ])
  })

  it("debería mantener el orden en el que vienen los matches del backend", async () => {
    global.fetch.mockResolvedValue(
      fakeResponse({
        body: {
          matches: [
            { match_id: 3, team_host_id: 1, team_away_id: 2, status: "PENDING", match_duration: 90 },
            { match_id: 1, team_host_id: 1, team_away_id: 2, status: "PENDING", match_duration: 90 },
          ],
          page: 1,
          limit: 20,
          total: 2,
        },
      })
    )

    const data = await fetchFriendlyMatches()

    expect(data.matches.map((m) => m.matchId)).toEqual([3, 1])
  })

  it("debería devolver una lista vacía cuando el backend responde matches: []", async () => {
    global.fetch.mockResolvedValue(
      fakeResponse({ body: { matches: [], page: 1, limit: 20, total: 0 } })
    )

    const data = await fetchFriendlyMatches()

    expect(data.matches).toEqual([])
  })

  it("debería propagar el error cuando falla la comunicación con el backend", async () => {
    global.fetch.mockResolvedValue(
      fakeResponse({ status: 500, ok: false, body: { error: "SERVER_ERROR", message: "boom" } })
    )

    await expect(fetchFriendlyMatches()).rejects.toThrow("boom")
  })
})
