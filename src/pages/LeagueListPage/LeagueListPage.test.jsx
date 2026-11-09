// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, waitFor, act } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Routes, Route } from "react-router-dom"

vi.mock("../../services/leagues", async () => {
  const actual = await vi.importActual("../../services/leagues")
  return { ...actual, fetchLeagues: vi.fn() }
})
// Guarda los listeners para poder emitir eventos desde los tests
const mockListeners = new Map()
vi.mock("../../services/globalSocket", () => ({
  subscribe: vi.fn((eventName, listener) => {
    if (!mockListeners.has(eventName)) mockListeners.set(eventName, new Set())
    mockListeners.get(eventName).add(listener)
    return () => mockListeners.get(eventName)?.delete(listener)
  }),
}))

import { fetchLeagues } from "../../services/leagues"
import LeagueListPage from "./LeagueListPage"

const PUBLICA = { leagueId: 1, leagueName: "Liga Pública", teamsCurrent: 2, maxTeams: 8, isPrivate: false, status: "PENDING" }
const PRIVADA = { leagueId: 2, leagueName: "Liga Privada", teamsCurrent: 3, maxTeams: 4, isPrivate: true, status: "PENDING" }
const LLENA = { leagueId: 3, leagueName: "Liga Llena", teamsCurrent: 4, maxTeams: 4, isPrivate: false, status: "PENDING" }
const MIEMBRO_PUBLICA = { ...PUBLICA, leagueId: 4, leagueName: "Mi Liga Pública", isMember: true }
const MIEMBRO_PRIVADA = { ...PRIVADA, leagueId: 5, leagueName: "Mi Liga Privada", isMember: true }
const MIEMBRO_LLENA = { ...LLENA, leagueId: 6, leagueName: "Mi Liga Llena", isMember: true }
const PUBLICA_EN_CURSO = { ...PUBLICA, leagueId: 7, leagueName: "Liga Pública en curso", status: "IN_PROGRESS" }
const PRIVADA_EN_CURSO = { ...PRIVADA, leagueId: 8, leagueName: "Liga Privada en curso", status: "IN_PROGRESS" }
const MIEMBRO_EN_CURSO = { ...PUBLICA_EN_CURSO, leagueId: 9, leagueName: "Mi Liga en curso", isMember: true }
const LLENA_EN_CURSO = { ...PUBLICA_EN_CURSO, leagueId: 10, leagueName: "Liga llena en curso", teamsCurrent: 4, maxTeams: 4 }


// state: lo que manda otra pantalla al navegar al listado (ej: { message })
function renderPage(state) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: "/leagues", state }]}>
      <Routes>
        <Route path="/leagues" element={<LeagueListPage />} />
        <Route path="/leagues/new" element={<h1>Crear liga</h1>} />
        <Route path="/leagues/:leagueId/join" element={<h1>Inscripción</h1>} />
        <Route path="/leagues/:leagueId/verify-password" element={<h1>Verificar contraseña</h1>} />
        <Route path="/leagues/:leagueId" element={<h1>Lobby</h1>} />
      </Routes>
    </MemoryRouter>
  )
}

describe("LeagueListPage", () => {
  beforeEach(() => {
    fetchLeagues.mockReset()
    mockListeners.clear()
  })
  afterEach(cleanup)

  it("Debería dejar de mostrar la liga cancelada al llegar LEAGUE_CANCELLED, sin recargar", async () => {
    fetchLeagues.mockResolvedValueOnce([PUBLICA, PRIVADA]).mockResolvedValueOnce([PRIVADA])
    renderPage()
    expect(await screen.findByText("Liga Pública")).toBeTruthy()

    act(() => mockListeners.get("LEAGUE_CANCELLED").forEach((listener) => listener({ league_id: 1 })))

    await waitFor(() => expect(screen.queryByText("Liga Pública")).toBeNull())
    expect(screen.getByText("Liga Privada")).toBeTruthy()
  })

  it("Debería mostrar el aviso de cancelación por unos segundos", async () => {
    vi.useFakeTimers()
    fetchLeagues.mockResolvedValue([])
    renderPage({ message: "La liga fue cancelada por el anfitrión." })
    expect(screen.getByText("La liga fue cancelada por el anfitrión.")).toBeTruthy()

    act(() => vi.advanceTimersByTime(5000))

    expect(screen.queryByText("La liga fue cancelada por el anfitrión.")).toBeNull()
    vi.useRealTimers()
  })

  it("muestra nombre, cupo y tipo de cada liga", async () => {
    fetchLeagues.mockResolvedValue([PUBLICA, PRIVADA])
    renderPage()
    expect(await screen.findByText("Liga Pública")).toBeTruthy()
    expect(screen.getByText("2 / 8")).toBeTruthy()
    expect(screen.getByText("Privada")).toBeTruthy()
  })

  it("muestra cargando mientras espera", () => {
    fetchLeagues.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByText("Cargando ligas...")).toBeTruthy()
  })

  it("lista vacía: mensaje y opción de crear liga", async () => {
    fetchLeagues.mockResolvedValue([])
    renderPage()
    expect(await screen.findByText("No hay ligas disponibles")).toBeTruthy()
    await userEvent.click(screen.getByRole("button", { name: "Crear liga" }))
    expect(screen.getByRole("heading", { name: "Crear liga" })).toBeTruthy()
  })

  it("liga privada lleva a verificar contraseña", async () => {
    fetchLeagues.mockResolvedValue([PRIVADA])
    renderPage()
    await userEvent.click(await screen.findByText("Liga Privada"))
    expect(screen.getByRole("heading", { name: "Verificar contraseña" })).toBeTruthy()
  })

  it("liga pública lleva directo a la inscripción", async () => {
    fetchLeagues.mockResolvedValue([PUBLICA])
    renderPage()
    await userEvent.click(await screen.findByText("Liga Pública"))
    expect(screen.getByRole("heading", { name: "Inscripción" })).toBeTruthy()
  })

  it("liga llena se muestra como Llena y no se puede seleccionar", async () => {
    fetchLeagues.mockResolvedValue([LLENA])
    renderPage()
    expect(await screen.findByText("Llena")).toBeTruthy()
    expect(screen.getByRole("button", { name: /Liga Llena/ }).disabled).toBe(true)
  })

  it("paginación: Anterior deshabilitado en página 1 y Siguiente cambia de página", async () => {
    const fullPage = Array.from({ length: 20 }, (_, i) => ({ ...PUBLICA, leagueId: i + 1 }))
    fetchLeagues.mockResolvedValueOnce(fullPage).mockResolvedValue([PUBLICA])
    renderPage()

    await screen.findAllByText("Liga Pública")
    expect(screen.getByRole("button", { name: "Anterior" }).disabled).toBe(true)

    await userEvent.click(screen.getByRole("button", { name: "Siguiente" }))
    await waitFor(() => expect(fetchLeagues).toHaveBeenLastCalledWith({ page: 2, limit: 20 }))
    await waitFor(() => expect(screen.getByRole("button", { name: "Siguiente" }).disabled).toBe(true))
  })

  it("Debería redireccionar un miembro de la liga publica al lobby", async () => {
    fetchLeagues.mockResolvedValue([MIEMBRO_PUBLICA])
    renderPage()
    await userEvent.click(await screen.findByText("Mi Liga Pública"))
    expect(screen.getByRole("heading", { name: "Lobby" })).toBeTruthy()
  })

  it("Debería un miembro de una liga privada ir al lobby", async () => {
    fetchLeagues.mockResolvedValue([MIEMBRO_PRIVADA])
    renderPage()
    await userEvent.click(await screen.findByText("Mi Liga Privada"))
    expect(screen.getByRole("heading", { name: "Lobby" })).toBeTruthy()
  })

  it("Debería cambiar la tarjeta si sos miembro o no", async () => {
    fetchLeagues.mockResolvedValue([MIEMBRO_PUBLICA, PUBLICA])
    renderPage()
    expect(await screen.findByRole("button", { name: /Ir a la sala/ })).toBeTruthy()
    expect(screen.getByRole("button", { name: /Unirme/ })).toBeTruthy()
  })

  it("Debería un miembro de una liga en curso ver 'En curso' e 'Ir a la sala', y entrar al lobby", async () => {
    fetchLeagues.mockResolvedValue([MIEMBRO_EN_CURSO])
    renderPage()
    expect(await screen.findByText("En curso")).toBeTruthy()
    expect(screen.getByRole("button", { name: /Ir a la sala/ }).disabled).toBe(false)

    await userEvent.click(screen.getByText("Mi Liga en curso"))
    expect(screen.getByRole("heading", { name: "Lobby" })).toBeTruthy()
  })

  it.each([PUBLICA_EN_CURSO, PRIVADA_EN_CURSO, LLENA_EN_CURSO])(
    "Debería deshabilitar para un no miembro la liga en curso: $leagueName",
    async (league) => {
      fetchLeagues.mockResolvedValue([league])
      renderPage()
      expect(await screen.findByText(league.leagueName)).toBeTruthy()
      expect(screen.getByText(league.leagueName).closest("button").disabled).toBe(true)
      expect(screen.getByText("En curso")).toBeTruthy()
      expect(screen.queryByText("Unirme")).toBeNull()
      expect(screen.queryByText("Llena")).toBeNull()
    },
  )

  it("Debería pasar la liga a 'En curso' al llegar LEAGUE_INITIATED, sin recargar", async () => {
    fetchLeagues
      .mockResolvedValueOnce([PUBLICA])
      .mockResolvedValueOnce([{ ...PUBLICA, status: "IN_PROGRESS" }])
    renderPage()
    expect(await screen.findByText("Unirme")).toBeTruthy()
    expect(screen.queryByText("En curso")).toBeNull()

    act(() => mockListeners.get("LEAGUE_INITIATED").forEach((listener) => listener({ league_id: 1 })))

    expect(await screen.findByText("En curso")).toBeTruthy()
    expect(screen.queryByText("Unirme")).toBeNull()
    expect(fetchLeagues).toHaveBeenCalledTimes(2)
  })

  it("Debería sacar la liga del listado al llegar LEAGUE_FINISHED, sin recargar", async () => {
    fetchLeagues
      .mockResolvedValueOnce([MIEMBRO_EN_CURSO, PUBLICA])
      .mockResolvedValueOnce([PUBLICA])
    renderPage()
    expect(await screen.findByText("Mi Liga en curso")).toBeTruthy()

    act(() => mockListeners.get("LEAGUE_FINISHED").forEach((listener) => listener({ league_id: 9 })))

    await waitFor(() => expect(screen.queryByText("Mi Liga en curso")).toBeNull())
    expect(screen.getByText("Liga Pública")).toBeTruthy()
  })

  it("Debería un miembro de una liga llena poder entrar al lobby", async () => {
    fetchLeagues.mockResolvedValue([MIEMBRO_LLENA])
    renderPage()
    await userEvent.click(await screen.findByText("Mi Liga Llena"))
    expect(screen.getByRole("heading", { name: "Lobby" })).toBeTruthy()
  })
})
