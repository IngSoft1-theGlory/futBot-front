// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, act } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
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

function button(name) {
  return screen.getByRole("button", { name })
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
    it("Debería mostrar directamente la configuración táctica, sin pasos previos", () => {
      renderPage()

      expect(screen.getByRole("heading", { name: "Unirse al amistoso" })).toBeTruthy()
      expect(screen.getByTestId("tactical-setup")).toBeTruthy()
      expect(screen.queryByRole("radio")).toBeNull()
    })

    it("Debería mostrar el número del amistoso", () => {
      renderPage("12")

      expect(screen.getByText(/Amistoso #12/)).toBeTruthy()
    })

    it("Debería usar 'Unirme al amistoso' como texto de confirmación", () => {
      renderPage()

      expect(button("Unirme al amistoso")).toBeTruthy()
    })

    it("Debería volver a la lista al cancelar, sin llamar al backend", async () => {
      const user = userEvent.setup()
      renderPage()

      await user.click(button("Cancelar configuración"))

      expect(screen.getByText("Lista de amistosos")).toBeTruthy()
      expect(httpService.post).not.toHaveBeenCalled()
    })
  })

  describe("Envío", () => {
    it("Debería enviar el team_id del usuario y la configuración táctica al endpoint del amistoso", async () => {
      const user = userEvent.setup()
      httpService.post.mockResolvedValue(JOIN_OK)
      renderPage("12")

      await user.click(button("Unirme al amistoso"))

      expect(httpService.post).toHaveBeenCalledWith("/friendly/12/teams", {
        team_id: 8,
        ...TACTICAL_CONFIG,
      })
    })

    it("Debería deshabilitar la confirmación mientras se envía", async () => {
      const user = userEvent.setup()
      httpService.post.mockReturnValue(new Promise(() => {}))
      renderPage()

      await user.click(button("Unirme al amistoso"))

      expect(button("Unirme al amistoso").disabled).toBe(true)
    })

    it("Debería mostrar un mensaje de éxito y llevar a la pantalla del partido", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      httpService.post.mockResolvedValue(JOIN_OK)
      renderPage("12")

      await user.click(button("Unirme al amistoso"))

      expect(screen.getByRole("status").textContent).toMatch(/Te uniste al amistoso/)
      expect(button("Unirme al amistoso").disabled).toBe(true)

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1500)
      })
      expect(screen.getByText("Pantalla del partido")).toBeTruthy()
    })

    it("Debería usar el mensaje del backend si viene en la respuesta", async () => {
      const user = userEvent.setup()
      httpService.post.mockResolvedValue({ ...JOIN_OK, message: "Te has unido al partido exitosamente." })
      renderPage()

      await user.click(button("Unirme al amistoso"))

      expect(screen.getByRole("status").textContent).toBe("Te has unido al partido exitosamente.")
    })
  })

  describe("Errores", () => {
    it.each(["INVALID_SETTING", "INVALID_CONFIGURATION"])(
      "Debería mostrar el error %s en la configuración táctica y permitir corregir",
      async (code) => {
        const user = userEvent.setup()
        httpService.post.mockRejectedValue(apiError(400, code, "La alineación es inválida."))
        renderPage()

        await user.click(button("Unirme al amistoso"))

        expect(screen.getByTestId("tactical-error").textContent).toBe("La alineación es inválida.")
        expect(button("Unirme al amistoso").disabled).toBe(false)
        expect(screen.queryByRole("alert")).toBeNull()
      }
    )

    it.each([
      { code: "MATCH_NOT_FOUND", status: 404, texto: /ya no existe o fue cancelado/ },
      { code: "MATCH_UNAVAILABLE", status: 409, texto: /ya comenzó o ya tiene un rival/ },
    ])(
      "Debería informar $code, no permitir reintentar y volver a la lista",
      async ({ code, status, texto }) => {
        vi.useFakeTimers({ shouldAdvanceTime: true })
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
        httpService.post.mockRejectedValue(apiError(status, code))
        renderPage()

        await user.click(button("Unirme al amistoso"))

        expect(screen.getByRole("alert").textContent).toMatch(texto)
        expect(button("Unirme al amistoso").disabled).toBe(true)
        expect(screen.queryByRole("button", { name: "Reintentar" })).toBeNull()

        await act(async () => {
          await vi.advanceTimersByTimeAsync(1500)
        })
        expect(screen.getByText("Lista de amistosos")).toBeTruthy()
      }
    )

    it("Debería informar que faltan jugadores con un link para crearlos", async () => {
      const user = userEvent.setup()
      httpService.post.mockRejectedValue(apiError(422, "PRECONDITION_FAILED"))
      renderPage()

      await user.click(button("Unirme al amistoso"))

      expect(screen.getByRole("alert").textContent).toMatch(/mínimo de jugadores/)
      await user.click(screen.getByRole("link", { name: /Ir a mis jugadores/ }))
      expect(screen.getByText("Mis jugadores")).toBeTruthy()
    })

    it("Debería mostrar el mensaje del backend ante un código desconocido", async () => {
      const user = userEvent.setup()
      httpService.post.mockRejectedValue(
        apiError(400, "INVALID_SETTINGS", "El equipo no puede unirse a su propio partido.")
      )
      renderPage()

      await user.click(button("Unirme al amistoso"))

      expect(screen.getByRole("alert").textContent).toMatch(/no puede unirse a su propio partido/)
      expect(button("Unirme al amistoso").disabled).toBe(false)
    })

    it("Debería ofrecer reintentar ante un error de red y reenviar la misma configuración", async () => {
      const user = userEvent.setup()
      httpService.post
        .mockRejectedValueOnce(new TypeError("Failed to fetch"))
        .mockResolvedValueOnce(JOIN_OK)
      renderPage("12")

      await user.click(button("Unirme al amistoso"))
      expect(screen.getByRole("alert").textContent).toMatch(/No se pudo conectar/)

      await user.click(button("Reintentar"))

      expect(httpService.post).toHaveBeenCalledTimes(2)
      expect(httpService.post).toHaveBeenLastCalledWith("/friendly/12/teams", {
        team_id: 8,
        ...TACTICAL_CONFIG,
      })
      expect(screen.getByRole("status").textContent).toMatch(/Te uniste al amistoso/)
    })

    it("Debería ofrecer reintentar ante un error 5xx", async () => {
      const user = userEvent.setup()
      httpService.post.mockRejectedValue(apiError(500, "INTERNAL_ERROR", "Error interno."))
      renderPage()

      await user.click(button("Unirme al amistoso"))

      expect(screen.getByRole("alert").textContent).toMatch(/Error interno/)
      expect(button("Reintentar")).toBeTruthy()
    })

    it("Debería no mostrar mensajes propios ante un 401, porque lo resuelve la sesión", async () => {
      const user = userEvent.setup()
      httpService.post.mockRejectedValue(apiError(401, "UNAUTHORIZED"))
      renderPage()

      await user.click(button("Unirme al amistoso"))

      expect(screen.queryByRole("alert")).toBeNull()
      expect(screen.queryByTestId("tactical-error")).toBeNull()
    })
  })
})
