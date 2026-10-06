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
  useSession: () => ({ user: { user_id: 1, team_id: 7, username: "Maradona10" } }),
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
      {errorMessage && <p role="alert">{errorMessage}</p>}
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
import CreateFriendlyPage from "./CreateFriendlyPage"

// ---------- Helpers ----------

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/friendlies/new"]}>
      <Routes>
        <Route path="/" element={<h1>Pantalla principal</h1>} />
        <Route path="/friendlies/new" element={<CreateFriendlyPage />} />
        <Route path="/friendlies/:matchId" element={<h1>Sala de espera</h1>} />
        <Route path="/players" element={<h1>Mis jugadores</h1>} />
      </Routes>
    </MemoryRouter>
  )
}

function durationOption(minutes) {
  return screen.getByRole("radio", { name: new RegExp(`^${minutes} min`) })
}

function button(name) {
  return screen.getByRole("button", { name })
}

function isStepVisible(name) {
  return screen.queryByRole("heading", { name }) !== null
}

async function completeStep1(user, minutes = 5) {
  await user.click(durationOption(minutes))
  await user.click(button("Siguiente"))
}

// ---------- Tests ----------

describe("CreateFriendlyPage", () => {
  beforeEach(() => {
    httpService.post.mockReset()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  describe("Paso 1: duración", () => {
    it("Debería mostrar solo las duraciones permitidas, sin nombre, cupo ni contraseña", () => {
      renderPage()

      const options = screen.getAllByRole("radio")
      expect(options).toHaveLength(2)
      expect(durationOption(2)).toBeTruthy()
      expect(durationOption(5)).toBeTruthy()
      expect(screen.queryByRole("textbox")).toBeNull()
      expect(screen.queryByRole("spinbutton")).toBeNull()
      expect(document.querySelector('input[type="password"]')).toBeNull()
    })

    it("Debería marcar la duración elegida", async () => {
      const user = userEvent.setup()
      renderPage()

      await user.click(durationOption(2))

      expect(durationOption(2).getAttribute("aria-checked")).toBe("true")
      expect(durationOption(5).getAttribute("aria-checked")).toBe("false")
    })

    it("Debería mostrar un error si no se eligió ninguna duración", async () => {
      const user = userEvent.setup()
      renderPage()

      await user.click(button("Siguiente"))

      expect(screen.getByText("Elegí la duración del partido")).toBeTruthy()
      expect(isStepVisible("Duración del partido")).toBe(true)
    })

    it("Debería avanzar al paso 2 sin llamar al backend", async () => {
      const user = userEvent.setup()
      renderPage()

      await completeStep1(user)

      expect(screen.getByTestId("tactical-setup")).toBeTruthy()
      expect(isStepVisible("Duración del partido")).toBe(false)
      expect(httpService.post).not.toHaveBeenCalled()
    })
  })

  describe("Navegación entre pasos", () => {
    it("Debería volver al paso 1 conservando la duración ingresada", async () => {
      const user = userEvent.setup()
      renderPage()

      await completeStep1(user, 2)
      await user.click(button(/Volver a la duración/))

      expect(isStepVisible("Duración del partido")).toBe(true)
      expect(durationOption(2).getAttribute("aria-checked")).toBe("true")
    })

    it("Debería mantener montada la configuración táctica al volver al paso 1", async () => {
      const user = userEvent.setup()
      renderPage()

      await completeStep1(user)
      const tacticalSetup = screen.getByTestId("tactical-setup")
      await user.click(button(/Volver a la duración/))
      await user.click(button("Siguiente"))

      // Es el mismo componente: no se desmontó, así que conserva la selección
      expect(screen.getByTestId("tactical-setup")).toBe(tacticalSetup)
    })

    it("Debería volver a la pantalla principal sin llamar al backend al cancelar en el paso 1", async () => {
      const user = userEvent.setup()
      renderPage()

      await user.click(button("Cancelar"))

      expect(screen.getByText("Pantalla principal")).toBeTruthy()
      expect(httpService.post).not.toHaveBeenCalled()
    })

    it("Debería volver a la pantalla principal sin llamar al backend al cancelar en el paso 2", async () => {
      const user = userEvent.setup()
      renderPage()

      await completeStep1(user)
      await user.click(button("Cancelar configuración"))

      expect(screen.getByText("Pantalla principal")).toBeTruthy()
      expect(httpService.post).not.toHaveBeenCalled()
    })
  })

  describe("Creación del amistoso", () => {
    it("Debería enviar POST /friendly con el body combinado de ambos pasos", async () => {
      httpService.post.mockReturnValue(new Promise(() => {}))
      const user = userEvent.setup()
      renderPage()

      await completeStep1(user, 5)
      await user.click(button("Crear amistoso"))

      expect(httpService.post).toHaveBeenCalledWith("/friendly", {
        team_id: 7,
        match_duration: 5,
        ...TACTICAL_CONFIG,
      })
    })

    it("Debería deshabilitar la confirmación mientras la solicitud está en curso", async () => {
      httpService.post.mockReturnValue(new Promise(() => {}))
      const user = userEvent.setup()
      renderPage()

      await completeStep1(user)
      await user.click(button("Crear amistoso"))
      await user.click(button("Crear amistoso"))

      expect(button("Crear amistoso").disabled).toBe(true)
      expect(httpService.post).toHaveBeenCalledTimes(1)
    })

    it("Debería mostrar un mensaje de éxito y redirigir a la sala de espera ante un 201", async () => {
      httpService.post.mockResolvedValue({
        match_id: 5,
        team_host_id: 7,
        status: "PENDING",
        match_duration: 5,
      })
      const user = userEvent.setup()
      renderPage()

      await completeStep1(user)
      await user.click(button("Crear amistoso"))

      expect(screen.getByRole("status").textContent).toMatch(/Amistoso creado/)
      expect(await screen.findByText("Sala de espera", {}, { timeout: 3000 })).toBeTruthy()
    })
  })

  describe("Manejo de errores", () => {
    it("Debería volver al paso 1 y mostrar el error junto a la duración ante INVALID_SETTINGS", async () => {
      httpService.post.mockRejectedValue(
        new ApiError(400, "INVALID_SETTINGS", "La duración del partido es inválida")
      )
      const user = userEvent.setup()
      renderPage()

      await completeStep1(user)
      await user.click(button("Crear amistoso"))

      expect(isStepVisible("Duración del partido")).toBe(true)
      expect(await screen.findByText("La duración del partido es inválida")).toBeTruthy()
    })

    it("Debería quedarse en el paso 2 y pasarle el error a la configuración táctica ante INVALID_CONFIGURATION", async () => {
      httpService.post.mockRejectedValue(
        new ApiError(400, "INVALID_CONFIGURATION", "La formación o la alineación seleccionados no es válida.")
      )
      const user = userEvent.setup()
      renderPage()

      await completeStep1(user)
      await user.click(button("Crear amistoso"))

      const tacticalSetup = screen.getByTestId("tactical-setup")
      expect(tacticalSetup.textContent).toContain("La formación o la alineación seleccionados no es válida.")
      expect(isStepVisible("Duración del partido")).toBe(false)
    })

    it("Debería mostrar un enlace para crear jugadores ante PRECONDITION_FAILED", async () => {
      httpService.post.mockRejectedValue(
        new ApiError(422, "PRECONDITION_FAILED", "El equipo no cumple con el mínimo de jugadores")
      )
      const user = userEvent.setup()
      renderPage()

      await completeStep1(user)
      await user.click(button("Crear amistoso"))

      expect(await screen.findByText(/necesita el mínimo de jugadores/)).toBeTruthy()
      await user.click(screen.getByRole("link", { name: /Ir a mis jugadores/ }))
      expect(screen.getByText("Mis jugadores")).toBeTruthy()
    })

    it("Debería mostrar el mensaje del backend ante un código de error desconocido", async () => {
      httpService.post.mockRejectedValue(new ApiError(500, "ALGO_RARO", "Algo salió mal"))
      const user = userEvent.setup()
      renderPage()

      await completeStep1(user)
      await user.click(button("Crear amistoso"))

      expect(await screen.findByText("Algo salió mal")).toBeTruthy()
      expect(button("Crear amistoso").disabled).toBe(false)
    })

    it("Debería mostrar un mensaje genérico si no hay conexión con el servidor", async () => {
      httpService.post.mockRejectedValue(new TypeError("Failed to fetch"))
      const user = userEvent.setup()
      renderPage()

      await completeStep1(user)
      await user.click(button("Crear amistoso"))

      expect(await screen.findByText(/No se pudo conectar con el servidor/)).toBeTruthy()
    })

    it("No debería mostrar ningún mensaje ante un 401, porque lo maneja la sesión", async () => {
      httpService.post.mockRejectedValue(new ApiError(401, "UNAUTHORIZED", "Token inválido o vencido"))
      const user = userEvent.setup()
      renderPage()

      await completeStep1(user)
      await user.click(button("Crear amistoso"))

      expect(screen.queryByText("Token inválido o vencido")).toBeNull()
    })
  })
})