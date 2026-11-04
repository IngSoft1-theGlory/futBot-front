// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("../../services/rankings", () => ({ fetchGlobalRanking: vi.fn() }))

import { fetchGlobalRanking } from "../../services/rankings"
import RankingPreview from "./RankingPreview"

const TOP = [
  { position: 1, teamId: 5, teamName: "alfajoresFC", points: 9 },
  { position: 2, teamId: 8, teamName: "BocaJuniors", points: 6 },
  { position: 3, teamId: 2, teamName: "Los Pibes", points: 3 },
]

describe("RankingPreview", () => {
  beforeEach(() => {
    fetchGlobalRanking.mockReset()
  })
  afterEach(cleanup)

  it("Debería pedir solo los tres primeros y mostrarlos en orden", async () => {
    fetchGlobalRanking.mockResolvedValue({ ranking: TOP, hasNextPage: true })
    render(<RankingPreview teamId={1} onSeeAll={() => {}} />)

    await screen.findByText("alfajoresFC")
    expect(fetchGlobalRanking).toHaveBeenCalledWith({ page: 1, limit: 3 })
    const items = screen.getAllByRole("listitem").map((item) => item.textContent)
    expect(items).toEqual(["1alfajoresFC9 pts", "2BocaJuniors6 pts", "3Los Pibes3 pts"])
  })

  it("Debería resaltar el club del usuario si está en el top", async () => {
    fetchGlobalRanking.mockResolvedValue({ ranking: TOP, hasNextPage: true })
    render(<RankingPreview teamId={8} onSeeAll={() => {}} />)

    const item = (await screen.findByText("BocaJuniors")).closest("li")
    expect(item.className).toContain("ranking-preview__club--own")
  })

  it("Debería seguir mostrando el botón aunque falle la carga", async () => {
    fetchGlobalRanking.mockRejectedValue(new Error("falló"))
    const onSeeAll = vi.fn()
    render(<RankingPreview teamId={1} onSeeAll={onSeeAll} />)

    expect(await screen.findByText("No se pudo cargar el ranking.")).toBeTruthy()
    await userEvent.click(screen.getByRole("button", { name: "Ver ranking completo" }))
    expect(onSeeAll).toHaveBeenCalled()
  })
})
