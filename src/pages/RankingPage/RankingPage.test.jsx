// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"

vi.mock("../../services/rankings", async () => {
  const actual = await vi.importActual("../../services/rankings")
  return { ...actual, fetchGlobalRanking: vi.fn() }
})
vi.mock("../../hooks/useSession", () => ({ useSession: () => ({ user: { team_id: 8 } }) }))

import { fetchGlobalRanking } from "../../services/rankings"
import RankingPage from "./RankingPage"

function club(position, teamId, teamName, points) {
  return {
    position, teamId, teamName, teamLogo: null, matchesPlayed: 3, wins: 1, draws: 0,
    losses: 2, goalsFor: 4, goalsAgainst: 2, goalDiff: 2, points,
  }
}

const RANKING = [club(1, 5, "alfajoresFC", 9), club(2, 8, "BocaJuniors", 6), club(3, 2, "Los Pibes", 3)]

function renderPage() {
  return render(
    <MemoryRouter>
      <RankingPage />
    </MemoryRouter>
  )
}

describe("RankingPage", () => {
  beforeEach(() => {
    fetchGlobalRanking.mockReset()
  })
  afterEach(cleanup)

  it("Debería mostrar los clubes en el orden que devuelve el back", async () => {
    fetchGlobalRanking.mockResolvedValue({ ranking: RANKING, hasNextPage: false })
    renderPage()
    await screen.findByText("alfajoresFC")
    const rows = screen.getAllByRole("row").slice(1)
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("alfajoresFC"),
      expect.stringContaining("BocaJuniors"),
      expect.stringContaining("Los Pibes"),
    ])
  })

  it("Debería resaltar el club del usuario", async () => {
    fetchGlobalRanking.mockResolvedValue({ ranking: RANKING, hasNextPage: false })
    renderPage()
    const row = (await screen.findByText("BocaJuniors")).closest("tr")
    expect(row.className).toContain("data-table__row--highlighted")
    expect(screen.getByText("alfajoresFC").closest("tr").className).not.toContain("highlighted")
  })

  it("Debería mostrar cargando mientras espera la respuesta", () => {
    fetchGlobalRanking.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByText("Cargando ranking...")).toBeTruthy()
  })

  it("Debería avisar cuando no hay clubes en el ranking", async () => {
    fetchGlobalRanking.mockResolvedValue({ ranking: [], hasNextPage: false })
    renderPage()
    expect(await screen.findByText("Todavía no hay clubes en el ranking.")).toBeTruthy()
  })

  it("Debería mostrar el error y volver a pedir el ranking al tocar Reintentar", async () => {
    fetchGlobalRanking.mockRejectedValueOnce(new Error("falló"))
    fetchGlobalRanking.mockResolvedValueOnce({ ranking: RANKING, hasNextPage: false })
    renderPage()
    expect(await screen.findByRole("alert")).toBeTruthy()
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }))
    expect(await screen.findByText("alfajoresFC")).toBeTruthy()
  })

  it("Debería pedir la página siguiente al tocar Siguiente", async () => {
    fetchGlobalRanking.mockResolvedValue({ ranking: RANKING, hasNextPage: true })
    renderPage()
    await screen.findByText("alfajoresFC")
    expect(screen.getByRole("button", { name: "Anterior" }).disabled).toBe(true)
    await userEvent.click(screen.getByRole("button", { name: "Siguiente" }))
    expect(fetchGlobalRanking).toHaveBeenLastCalledWith({ page: 2, limit: 20 })
    expect(await screen.findByText("Página 2")).toBeTruthy()
  })
})
