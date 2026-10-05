// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Routes, Route } from "react-router-dom"

let mockUser = { user_id: 1, team_id: 5 }

vi.mock("../../hooks/useSession", () => ({
  useSession: () => ({ user: mockUser }),
}))

vi.mock("../../services/matchResult", async () => {
  const actual = await vi.importActual("../../services/matchResult")
  return { ...actual, fetchMatchResult: vi.fn() }
})

import { ApiError } from "../../services/createhttpService"
import { fetchMatchResult, getOutcome } from "../../services/matchResult"
import MatchResultPage from "./MatchResultPage"

const equipo = (id, name, goals) => ({ id, name, goals })
const resultado = (homeGoals, awayGoals) => ({
  matchId: 9,
  home: equipo(5, "Los Pumas", homeGoals),
  away: equipo(7, "Los Tigres", awayGoals),
})

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/matches/9/result"]}>
      <Routes>
        <Route path="/matches/:matchId/result" element={<MatchResultPage />} />
        <Route path="/matches/:matchId" element={<h1>Pantalla del partido</h1>} />
        <Route path="/friendlies" element={<h1>Amistosos</h1>} />
        <Route path="/" element={<h1>Inicio</h1>} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  mockUser = { user_id: 1, team_id: 5 }
  fetchMatchResult.mockReset()
})

afterEach(cleanup)

describe("getOutcome", () => {
  it("Gana, pierde o empata según los goles de SU equipo (sea local o visitante)", () => {
    expect(getOutcome(resultado(2, 1), 5)).toBe("won")
    expect(getOutcome(resultado(1, 2), 5)).toBe("lost")
    expect(getOutcome(resultado(1, 1), 5)).toBe("draw")
    expect(getOutcome(resultado(1, 2), 7)).toBe("won") // el usuario es el visitante
  })

  it("Devuelve null si su equipo no jugó el partido", () => {
    expect(getOutcome(resultado(2, 1), 99)).toBeNull()
  })
})

describe("MatchResultPage", () => {
  it("Muestra un estado de carga mientras se resuelve el pedido", () => {
    fetchMatchResult.mockReturnValue(new Promise(() => {}))
    renderPage()

    expect(screen.getByText("Cargando Resultado...")).toBeTruthy()
  })

  it("Muestra los dos equipos con sus goles y que el usuario ganó", async () => {
    fetchMatchResult.mockResolvedValue(resultado(3, 1))
    renderPage()

    expect(await screen.findByText("Los Pumas")).toBeTruthy()
    expect(screen.getByText("Los Tigres")).toBeTruthy()
    expect(screen.getByLabelText("Goles de Los Pumas").textContent).toBe("3")
    expect(screen.getByLabelText("Goles de Los Tigres").textContent).toBe("1")
    expect(screen.getByText("¡Ganaste!")).toBeTruthy()
  })

  it("Indica que perdió y que empató", async () => {
    fetchMatchResult.mockResolvedValue(resultado(0, 2))
    renderPage()
    expect(await screen.findByText("Perdiste")).toBeTruthy()

    cleanup()
    fetchMatchResult.mockResolvedValue(resultado(2, 2))
    renderPage()
    expect(await screen.findByText("Empataste")).toBeTruthy()
  })

  it("Destaca solo el equipo del usuario", async () => {
    fetchMatchResult.mockResolvedValue(resultado(3, 1))
    renderPage()

    const propio = (await screen.findByText("Los Pumas")).closest("section")
    const rival = screen.getByText("Los Tigres").closest("section")
    expect(propio.className).toContain("result-team--own")
    expect(rival.className).not.toContain("result-team--own")
    expect(screen.getByText("Tu Equipo")).toBeTruthy()
  })

  it("Si el partido sigue en curso, redirige a la pantalla del partido", async () => {
    fetchMatchResult.mockRejectedValue(new ApiError(400, "MATCH_NOT_FINISHED", "Todavía no terminó."))
    renderPage()

    expect(await screen.findByText("Pantalla del partido")).toBeTruthy()
  })

  it("Si el partido no existe, lo informa y ofrece volver al inicio", async () => {
    fetchMatchResult.mockRejectedValue(new ApiError(404, "MATCH_NOT_FOUND", "No existe."))
    renderPage()

    expect(await screen.findByText("El partido no existe")).toBeTruthy()
    expect(screen.getByRole("link", { name: "Volver al Inicio" }).getAttribute("href")).toBe("/")
  })

  it("Ante un error de red muestra un mensaje y permite reintentar", async () => {
    fetchMatchResult.mockRejectedValueOnce(new TypeError("Failed to fetch"))
    fetchMatchResult.mockResolvedValueOnce(resultado(1, 0))
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText(/No se pudo cargar el resultado/)).toBeTruthy()
    await user.click(screen.getByRole("button", { name: "Reintentar" }))

    expect(await screen.findByText("Los Pumas")).toBeTruthy()
    expect(fetchMatchResult).toHaveBeenCalledTimes(2)
  })

  it("Con un 401 no muestra error (lo gestiona la sesión)", async () => {
    fetchMatchResult.mockRejectedValue(new ApiError(401, "UNAUTHORIZED", "Sesión expirada."))
    renderPage()

    expect(await screen.findByText("Cargando Resultado...")).toBeTruthy()
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("Ofrece volver al inicio y ver los amistosos", async () => {
    fetchMatchResult.mockResolvedValue(resultado(1, 0))
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole("button", { name: "Ver Amistosos" }))
    expect(screen.getByText("Amistosos")).toBeTruthy()
  })

  it("El botón Volver al inicio lleva al inicio", async () => {
    fetchMatchResult.mockResolvedValue(resultado(1, 0))
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole("button", { name: "Volver al Inicio" }))
    expect(screen.getByText("Inicio")).toBeTruthy()
  })
})
