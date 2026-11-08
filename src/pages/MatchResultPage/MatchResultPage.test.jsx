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

// penaltyGoals en null significa "no hubo penales" (igual que lo deja fetchMatchResult)
const equipo = (id, name, goals, penaltyGoals = null) => ({ id, name, goals, penaltyGoals })
const resultado = (homeGoals, awayGoals, homePenalties = null, awayPenalties = null) => ({
  matchId: 9,
  home: equipo(5, "Los Pumas", homeGoals, homePenalties),
  away: equipo(7, "Los Tigres", awayGoals, awayPenalties),
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
  it("Debería decidir si gana, pierde o empata según los goles de SU equipo (sea local o visitante)", () => {
    expect(getOutcome(resultado(2, 1), 5)).toBe("won")
    expect(getOutcome(resultado(1, 2), 5)).toBe("lost")
    expect(getOutcome(resultado(1, 1), 5)).toBe("draw")
    expect(getOutcome(resultado(1, 2), 7)).toBe("won") // el usuario es el visitante
  })

  it("Debería devolver null si su equipo no jugó el partido", () => {
    expect(getOutcome(resultado(2, 1), 99)).toBeNull()
    expect(getOutcome(resultado(0, 0, 2, 1), 99)).toBeNull() // tampoco con penales
  })

  it("Debería decidir por penales si hay empate en goles y hubo penales (sea local o visitante)", () => {
    // 0 - 0, el local gana 2 a 1 por penales
    expect(getOutcome(resultado(0, 0, 2, 1), 5)).toBe("won")
    expect(getOutcome(resultado(0, 0, 2, 1), 7)).toBe("lost")

    // 3 - 3, el visitante gana 5 a 4 por penales
    expect(getOutcome(resultado(3, 3, 4, 5), 5)).toBe("lost")
    expect(getOutcome(resultado(3, 3, 4, 5), 7)).toBe("won")

    // 1 - 1, el local no convirtió ningún penal: 0 tambien cuenta como resultado de la tanda
    expect(getOutcome(resultado(1, 1, 0, 3), 5)).toBe("lost")
    expect(getOutcome(resultado(1, 1, 0, 3), 7)).toBe("won")
  })
})

describe("MatchResultPage", () => {
  it("Debería mostrar un estado de carga mientras se resuelve el pedido", () => {
    fetchMatchResult.mockReturnValue(new Promise(() => {}))
    renderPage()

    expect(screen.getByText("Cargando Resultado...")).toBeTruthy()
  })

  it("Debería mostrar los dos equipos con sus goles y que el usuario ganó", async () => {
    fetchMatchResult.mockResolvedValue(resultado(3, 1))
    renderPage()

    expect(await screen.findByText("Los Pumas")).toBeTruthy()
    expect(screen.getByText("Los Tigres")).toBeTruthy()
    expect(screen.getByLabelText("Goles de Los Pumas").textContent).toBe("3")
    expect(screen.getByLabelText("Goles de Los Tigres").textContent).toBe("1")
    expect(screen.getByText("¡Ganaste!")).toBeTruthy()
  })

  it("Debería indicar que perdió y que empató", async () => {
    fetchMatchResult.mockResolvedValue(resultado(0, 2))
    renderPage()
    expect(await screen.findByText("Perdiste")).toBeTruthy()

    cleanup()
    fetchMatchResult.mockResolvedValue(resultado(2, 2))
    renderPage()
    expect(await screen.findByText("Empataste")).toBeTruthy()
  })

  it("Debería ocultar los penales en las dos tarjetas si no hubo penales", async () => {
    fetchMatchResult.mockResolvedValue(resultado(2, 2))
    renderPage()

    expect(await screen.findByText("Empataste")).toBeTruthy()
    expect(screen.queryByLabelText("Penales de Los Pumas")).toBeNull()
    expect(screen.queryByLabelText("Penales de Los Tigres")).toBeNull()
  })

  it("Debería mostrar (2) 0 en el local y 0 (1) en el visitante si hubo penales", async () => {
    fetchMatchResult.mockResolvedValue(resultado(0, 0, 2, 1))
    renderPage()

    // el contenedor del marcador de cada tarjeta tiene los goles y los penales, en ese orden
    const marcadorLocal = (await screen.findByLabelText("Goles de Los Pumas")).parentElement
    const marcadorVisitante = screen.getByLabelText("Goles de Los Tigres").parentElement
    expect(marcadorLocal.textContent).toBe("(2)0")
    expect(marcadorVisitante.textContent).toBe("0(1)")
  })

  it("Debería mostrar un equipo con 0 penales convertidos como (0)", async () => {
    fetchMatchResult.mockResolvedValue(resultado(1, 1, 0, 1))
    renderPage()

    expect((await screen.findByLabelText("Penales de Los Pumas")).textContent).toBe("(0)")
    expect(screen.getByLabelText("Penales de Los Tigres").textContent).toBe("(1)")
  })

  it("Debería indicar al ganador por penales que ganó y al perdedor que perdió, sin mostrar que empató", async () => {
    // el usuario es el local (team_id 5) y gana por penales
    fetchMatchResult.mockResolvedValue(resultado(0, 0, 2, 1))
    renderPage()
    expect(await screen.findByText("¡Ganaste!")).toBeTruthy()
    expect(screen.queryByText("Empataste")).toBeNull()

    // el usuario es el visitante (team_id 7) y pierde por penales
    cleanup()
    mockUser = { user_id: 2, team_id: 7 }
    renderPage()
    expect(await screen.findByText("Perdiste")).toBeTruthy()
    expect(screen.queryByText("Empataste")).toBeNull()
  })

  it("Debería mostrar el marcador con penales sin mensaje de resultado a un usuario que no jugó el partido", async () => {
    mockUser = { user_id: 3, team_id: 99 }
    fetchMatchResult.mockResolvedValue(resultado(0, 0, 2, 1))
    renderPage()

    expect((await screen.findByLabelText("Penales de Los Pumas")).textContent).toBe("(2)")
    expect(screen.getByLabelText("Penales de Los Tigres").textContent).toBe("(1)")
    expect(screen.queryByText("¡Ganaste!")).toBeNull()
    expect(screen.queryByText("Perdiste")).toBeNull()
    expect(screen.queryByText("Empataste")).toBeNull()
  })

  it("Debería destacar solo el equipo del usuario", async () => {
    fetchMatchResult.mockResolvedValue(resultado(3, 1))
    renderPage()

    const propio = (await screen.findByText("Los Pumas")).closest("section")
    const rival = screen.getByText("Los Tigres").closest("section")
    expect(propio.className).toContain("result-team--own")
    expect(rival.className).not.toContain("result-team--own")
    expect(screen.getByText("Tu Equipo")).toBeTruthy()
  })

  it("Debería redirigir a la pantalla del partido si el partido sigue en curso", async () => {
    fetchMatchResult.mockRejectedValue(new ApiError(400, "MATCH_NOT_FINISHED", "Todavía no terminó."))
    renderPage()

    expect(await screen.findByText("Pantalla del partido")).toBeTruthy()
  })

  it("Debería informar que el partido no existe y ofrecer volver al inicio", async () => {
    fetchMatchResult.mockRejectedValue(new ApiError(404, "MATCH_NOT_FOUND", "No existe."))
    renderPage()

    expect(await screen.findByText("El partido no existe")).toBeTruthy()
    expect(screen.getByRole("link", { name: "Volver al Inicio" }).getAttribute("href")).toBe("/")
  })

  it("Debería mostrar un mensaje y permitir reintentar ante un error de red", async () => {
    fetchMatchResult.mockRejectedValueOnce(new TypeError("Failed to fetch"))
    fetchMatchResult.mockResolvedValueOnce(resultado(1, 0))
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText(/No se pudo cargar el resultado/)).toBeTruthy()
    await user.click(screen.getByRole("button", { name: "Reintentar" }))

    expect(await screen.findByText("Los Pumas")).toBeTruthy()
    expect(fetchMatchResult).toHaveBeenCalledTimes(2)
  })

  it("Debería dejar que la sesión gestione un 401, sin mostrar error", async () => {
    fetchMatchResult.mockRejectedValue(new ApiError(401, "UNAUTHORIZED", "Sesión expirada."))
    renderPage()

    expect(await screen.findByText("Cargando Resultado...")).toBeTruthy()
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("Debería ofrecer volver al inicio y ver los amistosos", async () => {
    fetchMatchResult.mockResolvedValue(resultado(1, 0))
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole("button", { name: "Ver Amistosos" }))
    expect(screen.getByText("Amistosos")).toBeTruthy()
  })

  it("Debería llevar al inicio con el botón Volver al Inicio", async () => {
    fetchMatchResult.mockResolvedValue(resultado(1, 0))
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole("button", { name: "Volver al Inicio" }))
    expect(screen.getByText("Inicio")).toBeTruthy()
  })
})
