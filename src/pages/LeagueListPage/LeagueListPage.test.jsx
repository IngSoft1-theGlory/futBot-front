// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Routes, Route } from "react-router-dom"

vi.mock("../../services/leagues", async () => {
  const actual = await vi.importActual("../../services/leagues")
  return { ...actual, fetchLeagues: vi.fn() }
})
vi.mock("../../services/globalSocket", () => ({ subscribe: vi.fn(() => () => {}) }))

import { fetchLeagues } from "../../services/leagues"
import LeagueListPage from "./LeagueListPage"

const PUBLICA = { leagueId: 1, leagueName: "Liga Pública", teamsCurrent: 2, maxTeams: 8, isPrivate: false }
const PRIVADA = { leagueId: 2, leagueName: "Liga Privada", teamsCurrent: 3, maxTeams: 4, isPrivate: true }
const LLENA = { leagueId: 3, leagueName: "Liga Llena", teamsCurrent: 4, maxTeams: 4, isPrivate: false }

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/leagues"]}>
      <Routes>
        <Route path="/leagues" element={<LeagueListPage />} />
        <Route path="/leagues/new" element={<h1>Crear liga</h1>} />
        <Route path="/leagues/:leagueId/join" element={<h1>Inscripción</h1>} />
        <Route path="/leagues/:leagueId/verify-password" element={<h1>Verificar contraseña</h1>} />
      </Routes>
    </MemoryRouter>
  )
}

describe("LeagueListPage", () => {
  beforeEach(() => {
    fetchLeagues.mockReset()
  })
  afterEach(cleanup)

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
})
