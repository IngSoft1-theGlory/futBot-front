// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Routes, Route } from "react-router-dom"

vi.mock("../../services/leagueLineup", () => ({
  fetchLeagueLineup: vi.fn(),
  updateLeagueLineup: vi.fn(),
}))

vi.mock("../../hooks/useSession", () => ({
  useSession: () => ({ user: { user_id: 1, team_id: 42, username: "Maradona10" } }),
}))

const ALINEACION_VIGENTE = {
  formation_type: "1-2",
  starting_players: [{ player_id: 101, role: "DEFENDER", behavior_id: 1 }],
  substitute_players: [{ player_id: 104, behavior_id: 1 }],
}

const ALINEACION_NUEVA = {
  formation_type: "2-1",
  starting_players: [{ player_id: 102, role: "FORWARD", behavior_id: 2 }],
  substitute_players: [{ player_id: 105, behavior_id: 2 }],
}

// TacticalSetup tiene sus propios tests: acá se reemplaza por una versión simple
// que muestra la formación que recibe y confirma siempre ALINEACION_NUEVA
vi.mock("../../components/TacticalSetup/TacticalSetup", () => ({
  default: ({ initialConfig, onConfirm, onCancel, isSubmitting, errorMessage, confirmLabel }) => (
    <div data-testid="tactical-setup">
      <p>Formación cargada: {initialConfig?.formation_type}</p>
      {errorMessage && <p>{errorMessage}</p>}
      <button type="button" onClick={onCancel}>
        Cancelar
      </button>
      <button type="button" disabled={isSubmitting} onClick={() => onConfirm(ALINEACION_NUEVA)}>
        {confirmLabel}
      </button>
    </div>
  ),
}))

import { ApiError } from "../../services/createhttpService"
import { fetchLeagueLineup, updateLeagueLineup } from "../../services/leagueLineup"
import LeagueLineupPage from "./LeagueLineupPage"

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/leagues/3/lineup"]}>
      <Routes>
        <Route path="/leagues/:leagueId/lineup" element={<LeagueLineupPage />} />
        <Route path="/leagues/:leagueId" element={<h1>Lobby de la liga</h1>} />
      </Routes>
    </MemoryRouter>
  )
}

const button = (name) => screen.getByRole("button", { name })

async function abrirPantalla() {
  fetchLeagueLineup.mockResolvedValue(ALINEACION_VIGENTE)
  renderPage()
  await screen.findByTestId("tactical-setup")
}

describe("LeagueLineupPage", () => {
  beforeEach(() => {
    fetchLeagueLineup.mockReset()
    updateLeagueLineup.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it("Debería mostrar la alineación vigente cargada en la configuración táctica", async () => {
    await abrirPantalla()

    expect(fetchLeagueLineup).toHaveBeenCalledWith("3", 42)
    expect(screen.getByText("Formación cargada: 1-2")).toBeTruthy()
  })

  it("Debería guardar la nueva alineación, avisar que rige desde el próximo partido y volver al lobby", async () => {
    updateLeagueLineup.mockResolvedValue(ALINEACION_NUEVA)
    const user = userEvent.setup()
    await abrirPantalla()

    await user.click(button("Guardar alineación"))

    expect(updateLeagueLineup).toHaveBeenCalledWith("3", 42, ALINEACION_NUEVA)
    expect(screen.getByRole("status").textContent).toBe(
      "Tu nueva alineación rige desde el próximo partido."
    )
    expect(await screen.findByText("Lobby de la liga", {}, { timeout: 3000 })).toBeTruthy()
  })

  it("Debería deshabilitar la confirmación mientras se guarda", async () => {
    updateLeagueLineup.mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup()
    await abrirPantalla()

    await user.click(button("Guardar alineación"))

    expect(button("Guardar alineación").disabled).toBe(true)
  })

  it("Debería mostrar el error de INVALID_CONFIGURATION en la configuración táctica sin perder la selección", async () => {
    updateLeagueLineup.mockRejectedValue(
      new ApiError(400, "INVALID_CONFIGURATION", "La formación o la alineación seleccionados no es válida.")
    )
    const user = userEvent.setup()
    await abrirPantalla()
    const configuracion = screen.getByTestId("tactical-setup")

    await user.click(button("Guardar alineación"))

    expect(configuracion.textContent).toContain("La formación o la alineación seleccionados no es válida.")
    expect(screen.getByTestId("tactical-setup")).toBe(configuracion)
  })

  it("Debería volver al lobby sin llamar al back al cancelar", async () => {
    const user = userEvent.setup()
    await abrirPantalla()

    await user.click(button("Cancelar"))

    expect(screen.getByText("Lobby de la liga")).toBeTruthy()
    expect(updateLeagueLineup).not.toHaveBeenCalled()
  })

  it("Debería permitir reintentar si falla la carga de la alineación", async () => {
    fetchLeagueLineup
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(ALINEACION_VIGENTE)
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole("button", { name: "Reintentar" }))

    expect(await screen.findByText("Formación cargada: 1-2")).toBeTruthy()
    expect(fetchLeagueLineup).toHaveBeenCalledTimes(2)
  })
})
