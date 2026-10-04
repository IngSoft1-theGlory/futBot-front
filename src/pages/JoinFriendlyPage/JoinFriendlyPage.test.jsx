// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, act, fireEvent } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"

vi.mock("../../services/createhttpService", async (importOriginal) => {
  const original = await importOriginal()
  return { ...original, httpService: { post: vi.fn() } }
})

vi.mock("../../hooks/useSession", () => ({
  useSession: () => ({ user: { user_id: 1, team_id: 8, username: "Maradona10" } }),
}))

// TacticalSetup tiene sus propios tests: acá se reemplaza por una versión simple
// que permite confirmar una configuración fija y ver qué props recibe.
const TACTICAL_CONFIG = {
  formation_type: "2-1",
  starting_players: [
    { player_id: 105, role: "DEF_LEFT", behavior_id: 2 },
    { player_id: 103, role: "DEF_RIGHT", behavior_id: 2 },
    { player_id: 101, role: "FORWARD", behavior_id: 1 },
  ],
  substitute_players: [
    { player_id: 106, behavior_id: 2 },
    { player_id: 104, behavior_id: 1 },
    { player_id: 107, behavior_id: 1 },
  ],
}

vi.mock("../../components/TacticalSetup/TacticalSetup", () => ({
  default: ({ onConfirm, onCancel, isSubmitting, errorMessage, confirmLabel }) => (
    <div data-testid="tactical-setup">
      {errorMessage && <p data-testid="tactical-error">{errorMessage}</p>}
      <button type="button" onClick={onCancel}>
        Cancelar configuración
      </button>
      <button type="button" disabled={isSubmitting} onClick={() => onConfirm(TACTICAL_CONFIG)}>
        {confirmLabel}
      </button>
    </div>
  ),
}))

import { httpService, ApiError } from "../../services/createhttpService"
import JoinFriendlyPage from "./JoinFriendlyPage"

// ---------- Helpers ----------

function renderPage(matchId = "12") {
  render(
    <MemoryRouter initialEntries={[`/friendlies/${matchId}/join`]}>
      <Routes>
        <Route path="/friendlies" element={<h1>Lista de amistosos</h1>} />
        <Route path="/friendlies/:matchId/join" element={<JoinFriendlyPage />} />
        <Route path="/matches/:matchId" element={<h1>Pantalla del partido</h1>} />
        <Route path="/players" element={<h1>Mis jugadores</h1>} />
      </Routes>
    </MemoryRouter>
  )
}

// Vuelve a montar la página de cero (para probar varios casos en un mismo test)
function remount(matchId = "12") {
  cleanup()
  httpService.post.mockReset()
  renderPage(matchId)
}

function button(name) {
  return screen.getByRole("button", { name })
}

// Click que espera a que la request simulada se resuelva y React actualice la
// pantalla. No se usa userEvent porque con timers falsos o con la suite completa
// corriendo en paralelo los asserts podían llegar antes que el render.
async function click(element) {
  await act(async () => {
    fireEvent.click(element)
  })
}

async function advance(ms) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

function apiError(status, error, message = "mensaje del backend") {
  return new ApiError(status, error, message)
}

const JOIN_OK = { match_id: 12, team_host_id: 5, team_away_id: 8, status: "IN_PROGRESS", match_duration: 5 }

// ---------- Tests ----------

describe("JoinFriendlyPage", () => {
  beforeEach(() => {
    httpService.post.mockReset()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  describe("Formulario", () => {
    it("Debería mostrar directamente la configuración táctica con el número del amistoso y la confirmación 'Unirme al amistoso'", () => {
      renderPage("12")

      expect(screen.getByRole("heading", { name: "Unirse al amistoso" })).toBeTruthy()
      expect(screen.getByText(/Amistoso #12/)).toBeTruthy()
      expect(screen.getByTestId("tactical-setup")).toBeTruthy()
      expect(screen.queryByRole("radio")).toBeNull()
      expect(button("Unirme al amistoso")).toBeTruthy()
    })

    it("Debería volver a la lista al cancelar, sin llamar al backend", async () => {
      renderPage()

      await click(button("Cancelar configuración"))

      expect(screen.getByText("Lista de amistosos")).toBeTruthy()
      expect(httpService.post).not.toHaveBeenCalled()
    })
  })

  describe("Envío", () => {
    it("Debería enviar el team_id del usuario y la configuración táctica, y deshabilitar la confirmación mientras se envía", async () => {
      httpService.post.mockReturnValue(new Promise(() => {}))
      renderPage("12")

      await click(button("Unirme al amistoso"))

      expect(httpService.post).toHaveBeenCalledWith("/friendly/12/teams", {
        team_id: 8,
        ...TACTICAL_CONFIG,
      })
      expect(button("Unirme al amistoso").disabled).toBe(true)
    })

    it("Debería mostrar el mensaje de éxito (propio o del backend) y llevar a la pantalla del partido", async () => {
      vi.useFakeTimers()
      const casos = [
        { respuesta: JOIN_OK, texto: /Te uniste al amistoso/ },
        {
          respuesta: { ...JOIN_OK, message: "Te has unido al partido exitosamente." },
          texto: /^Te has unido al partido exitosamente\.$/,
        },
      ]

      for (const { respuesta, texto } of casos) {
        remount("12")
        httpService.post.mockResolvedValue(respuesta)

        await click(button("Unirme al amistoso"))

        expect(screen.getByRole("status").textContent).toMatch(texto)
        expect(button("Unirme al amistoso").disabled).toBe(true)

        await advance(1500)
        expect(screen.getByText("Pantalla del partido")).toBeTruthy()
      }
    })
  })

  describe("Errores", () => {
    it("Debería mostrar INVALID_SETTING e INVALID_CONFIGURATION en la configuración táctica y permitir corregir", async () => {
      for (const code of ["INVALID_SETTING", "INVALID_CONFIGURATION"]) {
        remount()
        httpService.post.mockRejectedValue(apiError(400, code, "La alineación es inválida."))

        await click(button("Unirme al amistoso"))

        expect(screen.getByTestId("tactical-error").textContent).toBe("La alineación es inválida.")
        expect(button("Unirme al amistoso").disabled).toBe(false)
        expect(screen.queryByRole("alert")).toBeNull()
      }
    })

    it("Debería informar MATCH_NOT_FOUND y MATCH_UNAVAILABLE, no permitir reintentar y volver a la lista", async () => {
      vi.useFakeTimers()
      const casos = [
        { code: "MATCH_NOT_FOUND", status: 404, texto: /ya no existe o fue cancelado/ },
        { code: "MATCH_UNAVAILABLE", status: 409, texto: /ya comenzó o ya tiene un rival/ },
      ]

      for (const { code, status, texto } of casos) {
        remount()
        httpService.post.mockRejectedValue(apiError(status, code))

        await click(button("Unirme al amistoso"))

        expect(screen.getByRole("alert").textContent).toMatch(texto)
        expect(button("Unirme al amistoso").disabled).toBe(true)
        expect(screen.queryByRole("button", { name: "Reintentar" })).toBeNull()

        await advance(1500)
        expect(screen.getByText("Lista de amistosos")).toBeTruthy()
      }
    })

    it("Debería informar que faltan jugadores con un link para crearlos", async () => {
      httpService.post.mockRejectedValue(apiError(422, "PRECONDITION_FAILED"))
      renderPage()

      await click(button("Unirme al amistoso"))

      expect(screen.getByRole("alert").textContent).toMatch(/mínimo de jugadores/)
      await click(screen.getByRole("link", { name: /Ir a mis jugadores/ }))
      expect(screen.getByText("Mis jugadores")).toBeTruthy()
    })

    it("Debería mostrar el mensaje del backend ante un código desconocido, sin ofrecer reintentar", async () => {
      httpService.post.mockRejectedValue(
        apiError(400, "INVALID_SETTINGS", "El equipo no puede unirse a su propio partido.")
      )
      renderPage()

      await click(button("Unirme al amistoso"))

      expect(screen.getByRole("alert").textContent).toMatch(/no puede unirse a su propio partido/)
      expect(button("Unirme al amistoso").disabled).toBe(false)
      expect(screen.queryByRole("button", { name: "Reintentar" })).toBeNull()
    })

    it("Debería ofrecer reintentar ante un error de red o 5xx y reenviar la misma configuración", async () => {
      const casos = [
        { error: new TypeError("Failed to fetch"), texto: /No se pudo conectar/ },
        { error: apiError(500, "INTERNAL_ERROR", "Error interno."), texto: /Error interno/ },
      ]

      for (const { error, texto } of casos) {
        remount("12")
        httpService.post.mockRejectedValueOnce(error).mockResolvedValueOnce(JOIN_OK)

        await click(button("Unirme al amistoso"))
        expect(screen.getByRole("alert").textContent).toMatch(texto)

        await click(button("Reintentar"))

        expect(httpService.post).toHaveBeenCalledTimes(2)
        expect(httpService.post).toHaveBeenLastCalledWith("/friendly/12/teams", {
          team_id: 8,
          ...TACTICAL_CONFIG,
        })
        expect(screen.getByRole("status").textContent).toMatch(/Te uniste al amistoso/)
      }
    })

    it("Debería no mostrar mensajes propios ante un 401, porque lo resuelve la sesión", async () => {
      httpService.post.mockRejectedValue(apiError(401, "UNAUTHORIZED"))
      renderPage()

      await click(button("Unirme al amistoso"))

      expect(screen.queryByRole("alert")).toBeNull()
      expect(screen.queryByTestId("tactical-error")).toBeNull()
    })
  })
})
