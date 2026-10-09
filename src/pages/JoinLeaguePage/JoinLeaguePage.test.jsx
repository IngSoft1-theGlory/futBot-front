// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Routes, Route } from "react-router-dom"

vi.mock("../../services/createhttpService", async (importOriginal) => {
  const original = await importOriginal()
  return { ...original, httpService: { post: vi.fn() } }
})

vi.mock("../../hooks/useSession", () => ({
  useSession: () => ({ user: { user_id: 1, team_id: 42, username: "Maradona10" } }),
}))

// TacticalSetup tiene sus propios tests: acá se reemplaza por una versión simple
const TACTICAL_CONFIG = {
  formation_type: "2-1",
  starting_players: [{ player_id: 101, role: "FORWARD", behavior_id: 1 }],
  substitute_players: [{ player_id: 104, behavior_id: 1 }],
}

vi.mock("../../components/TacticalSetup/TacticalSetup", () => ({
  default: ({ onConfirm, onCancel, isSubmitting, errorMessage, confirmLabel }) => (
    <div data-testid="tactical-setup">
      {errorMessage && <p>{errorMessage}</p>}
      <button type="button" onClick={onCancel}>
        Cancelar
      </button>
      <button type="button" disabled={isSubmitting} onClick={() => onConfirm(TACTICAL_CONFIG)}>
        {confirmLabel}
      </button>
    </div>
  ),
}))

import { httpService, ApiError } from "../../services/createhttpService"
import JoinLeaguePage from "./JoinLeaguePage"

function renderPage(state) {
  render(
    <MemoryRouter initialEntries={[{ pathname: "/leagues/3/join", state }]}>
      <Routes>
        <Route path="/leagues" element={<h1>Listado de ligas</h1>} />
        <Route path="/leagues/:leagueId/join" element={<JoinLeaguePage />} />
        <Route path="/leagues/:leagueId" element={<h1>Sala de espera</h1>} />
        <Route path="/leagues/:leagueId/verify-password" element={<h1>Verificar contraseña</h1>} />
      </Routes>
    </MemoryRouter>
  )
}

const button = (name) => screen.getByRole("button", { name })

async function confirm(user) {
  await user.click(button("Unirme a la liga"))
}

function rejectWith(status, code, message = "Mensaje del backend") {
  httpService.post.mockRejectedValue(new ApiError(status, code, message))
}

describe("JoinLeaguePage", () => {
  beforeEach(() => {
    httpService.post.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it("Debería volver al listado sin llamar al backend al cancelar", async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(button("Cancelar"))

    expect(screen.getByText("Listado de ligas")).toBeTruthy()
    expect(httpService.post).not.toHaveBeenCalled()
  })

  it("Debería enviar el team_id y la configuración táctica sin join_token si la liga es pública", async () => {
    httpService.post.mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup()
    renderPage()

    await confirm(user)

    expect(httpService.post).toHaveBeenCalledWith("/leagues/3/teams", {
      team_id: 42,
      ...TACTICAL_CONFIG,
    })
  })

  it("Debería enviar el join_token si la liga es privada", async () => {
    httpService.post.mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup()
    renderPage({ joinToken: "token-123" })

    await confirm(user)

    expect(httpService.post.mock.calls[0][1].join_token).toBe("token-123")
  })

  it("Debería deshabilitar la confirmación mientras la solicitud está en curso", async () => {
    httpService.post.mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup()
    renderPage()

    await confirm(user)

    expect(button("Unirme a la liga").disabled).toBe(true)
  })

  it("Debería mostrar un mensaje de éxito y redirigir a la sala de espera ante un 201", async () => {
    httpService.post.mockResolvedValue({ league_id: 3, team_id: 42 })
    const user = userEvent.setup()
    renderPage()

    await confirm(user)

    expect(screen.getByRole("status").textContent).toMatch(/Te uniste a la liga/)
    expect(await screen.findByText("Sala de espera", {}, { timeout: 3000 })).toBeTruthy()
  })

  it("Debería mostrar el error en la configuración táctica ante INVALID_CONFIGURATION", async () => {
    rejectWith(400, "INVALID_CONFIGURATION", "La alineación no es válida")
    const user = userEvent.setup()
    renderPage()

    await confirm(user)

    expect(screen.getByTestId("tactical-setup").textContent).toContain("La alineación no es válida")
    expect(button("Unirme a la liga").disabled).toBe(false)
  })

  it("Debería ofrecer volver al listado ante LEAGUE_UNAVAILABLE", async () => {
    rejectWith(400, "LEAGUE_UNAVAILABLE")
    const user = userEvent.setup()
    renderPage()

    await confirm(user)

    expect(await screen.findByText(/La liga ya comenzó/)).toBeTruthy()
    expect(screen.getByRole("link", { name: /Volver al listado/ })).toBeTruthy()
  })

  it("Debería ofrecer ir a la sala de espera ante ALREADY_JOINED", async () => {
    rejectWith(409, "ALREADY_JOINED")
    const user = userEvent.setup()
    renderPage()

    await confirm(user)

    await user.click(await screen.findByRole("link", { name: /Ir a la sala de espera/ }))
    expect(screen.getByText("Sala de espera")).toBeTruthy()
  })

  it("Debería redirigir a la verificación de contraseña ante JOIN_TOKEN_EXPIRED", async () => {
    rejectWith(403, "JOIN_TOKEN_EXPIRED", "La verificación de la contraseña expiró.")
    const user = userEvent.setup()
    renderPage({ joinToken: "token-viejo" })

    await confirm(user)

    expect(await screen.findByText("La verificación de la contraseña expiró.")).toBeTruthy()
    expect(await screen.findByText("Verificar contraseña", {}, { timeout: 3000 })).toBeTruthy()
  })

  it("Debería volver al listado si la liga ya no existe (NOT_FOUND)", async () => {
    rejectWith(404, "NOT_FOUND")
    const user = userEvent.setup()
    renderPage()

    await confirm(user)

    expect(await screen.findByText("La liga ya no existe.")).toBeTruthy()
    expect(await screen.findByText("Listado de ligas", {}, { timeout: 3000 })).toBeTruthy()
  })

  it("Debería permitir reintentar si no hay conexión con el servidor", async () => {
    httpService.post.mockRejectedValueOnce(new TypeError("Failed to fetch"))
    httpService.post.mockReturnValueOnce(new Promise(() => {}))
    const user = userEvent.setup()
    renderPage()

    await confirm(user)
    await user.click(await screen.findByRole("button", { name: "Reintentar" }))

    expect(httpService.post).toHaveBeenCalledTimes(2)
  })
})
