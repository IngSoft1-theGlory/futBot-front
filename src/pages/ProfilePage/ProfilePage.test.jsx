// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Routes, Route } from "react-router-dom"

vi.mock("../../services/teams", () => ({ fetchTeam: vi.fn() }))
vi.mock("../../hooks/useSession", () => ({
  useSession: () => ({ user: { user_id: 1, team_id: 7, username: "Fer", email: "fer@famaf.unc.edu.ar" } }),
}))

import { fetchTeam } from "../../services/teams"
import ProfilePage from "./ProfilePage"

const TEAM = {
  teamId: 7, name: "Instituto", logo: "data:image/png;base64,AAAA",
  position: 3, matchesPlayed: 10, wins: 6, draws: 2, losses: 2, points: 20,
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/profile"]}>
      <Routes>
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/profile/edit" element={<h1>Editar perfil</h1>} />
      </Routes>
    </MemoryRouter>
  )
}

describe("ProfilePage", () => {
  beforeEach(() => {
    fetchTeam.mockReset()
  })
  afterEach(cleanup)

  it("Debería mostrar el nombre de usuario y el email de la sesión", async () => {
    fetchTeam.mockResolvedValue(TEAM)
    renderPage()

    expect(screen.getByRole("heading", { name: "Fer" })).toBeTruthy()
    expect(screen.getByText("fer@famaf.unc.edu.ar")).toBeTruthy()
    await screen.findByText("Instituto")
  })

  it("Debería pedir el equipo del usuario y mostrar su nombre, logo y estadísticas", async () => {
    fetchTeam.mockResolvedValue(TEAM)
    renderPage()

    expect(await screen.findByText("Instituto")).toBeTruthy()
    expect(fetchTeam).toHaveBeenCalledWith(7)
    expect(screen.getByAltText("Logo de Instituto").getAttribute("src")).toBe(TEAM.logo)
    expect(screen.getByText("#3")).toBeTruthy()
    expect(screen.getByText("20")).toBeTruthy()
  })

  it("Debería mostrar cargando mientras espera los datos del equipo", () => {
    fetchTeam.mockReturnValue(new Promise(() => {}))
    renderPage()

    expect(screen.getByText("Cargando equipo...")).toBeTruthy()
  })

  it("Debería mostrar el error y volver a pedir el equipo al tocar Reintentar", async () => {
    fetchTeam.mockRejectedValueOnce(new Error("falló"))
    fetchTeam.mockResolvedValueOnce(TEAM)
    renderPage()

    expect(await screen.findByRole("alert")).toBeTruthy()
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }))
    expect(await screen.findByText("Instituto")).toBeTruthy()
  })

  it("Debería ir a la edición del perfil al tocar Editar perfil", async () => {
    fetchTeam.mockResolvedValue(TEAM)
    renderPage()

    await userEvent.click(screen.getByRole("button", { name: "Editar perfil" }))

    expect(screen.getByRole("heading", { name: "Editar perfil" })).toBeTruthy()
  })
})
