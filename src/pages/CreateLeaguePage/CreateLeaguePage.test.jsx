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
        Cancelar configuración
      </button>
      <button type="button" disabled={isSubmitting} onClick={() => onConfirm(TACTICAL_CONFIG)}>
        {confirmLabel}
      </button>
    </div>
  ),
}))

import { httpService, ApiError } from "../../services/createhttpService"
import CreateLeaguePage from "./CreateLeaguePage"

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/leagues/new"]}>
      <Routes>
        <Route path="/" element={<h1>Pantalla principal</h1>} />
        <Route path="/leagues/new" element={<CreateLeaguePage />} />
        <Route path="/leagues/:leagueId" element={<h1>Sala de espera</h1>} />
      </Routes>
    </MemoryRouter>
  )
}

const radio = (name) => screen.getByRole("radio", { name })
const button = (name) => screen.getByRole("button", { name })
const isStep1Visible = () => screen.queryByRole("heading", { name: "Datos de la liga" }) !== null

async function completeStep1(user, { isPrivate = false } = {}) {
  await user.type(screen.getByLabelText("Nombre de la liga"), "Liga FAMAF")
  await user.click(radio(/^5 min/))
  await user.click(radio(/^8 equipos/))
  if (isPrivate) {
    await user.click(radio(/^Privada/))
    await user.type(screen.getByLabelText("Contraseña"), "Asado123")
  }
  await user.click(button("Siguiente"))
}

describe("CreateLeaguePage", () => {
  beforeEach(() => {
    httpService.post.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  describe("Paso 1: datos de la liga", () => {
    it("Debería ofrecer solo cupos pares de 4 a 12 equipos", () => {
      renderPage()

      const capacities = screen.getAllByRole("radio", { name: /equipos/ })
      expect(capacities.map((option) => option.textContent)).toEqual([
        "4 equipos",
        "6 equipos",
        "8 equipos",
        "10 equipos",
        "12 equipos",
      ])
    })

    it("Debería ofrecer las mismas duraciones que un amistoso (2 y 5 minutos)", () => {
      renderPage()

      expect(radio(/^2 min/)).toBeTruthy()
      expect(radio(/^5 min/)).toBeTruthy()
    })

    it("Debería pedir contraseña solo si la liga es privada", async () => {
      const user = userEvent.setup()
      renderPage()

      expect(screen.queryByLabelText("Contraseña")).toBeNull()
      await user.click(radio(/^Privada/))
      expect(screen.getByLabelText("Contraseña").getAttribute("type")).toBe("password")
    })

    it("Debería mostrar errores y no avanzar si faltan datos", async () => {
      const user = userEvent.setup()
      renderPage()

      await user.click(button("Siguiente"))

      expect(screen.getByText("El nombre de la liga es obligatorio")).toBeTruthy()
      expect(screen.getByText("Elegí la duración de cada partido")).toBeTruthy()
      expect(screen.getByText("Elegí la cantidad máxima de equipos")).toBeTruthy()
      expect(isStep1Visible()).toBe(true)
    })

    it("Debería avanzar al paso 2 sin llamar al backend", async () => {
      const user = userEvent.setup()
      renderPage()

      await completeStep1(user)

      expect(isStep1Visible()).toBe(false)
      expect(httpService.post).not.toHaveBeenCalled()
    })
  })

  describe("Navegación", () => {
    it("Debería volver al paso 1 sin perder lo ingresado", async () => {
      const user = userEvent.setup()
      renderPage()

      await completeStep1(user)
      await user.click(button(/Volver a los datos de la liga/))

      expect(screen.getByLabelText("Nombre de la liga").value).toBe("Liga FAMAF")
      expect(radio(/^8 equipos/).getAttribute("aria-checked")).toBe("true")
    })

    it("Debería volver a la pantalla principal sin llamar al backend al cancelar", async () => {
      const user = userEvent.setup()
      renderPage()

      await completeStep1(user)
      await user.click(button("Cancelar configuración"))

      expect(screen.getByText("Pantalla principal")).toBeTruthy()
      expect(httpService.post).not.toHaveBeenCalled()
    })
  })

  describe("Creación de la liga", () => {
    it("Debería enviar POST /leagues con el body de ambos pasos y password null si es pública", async () => {
      httpService.post.mockReturnValue(new Promise(() => {}))
      const user = userEvent.setup()
      renderPage()

      await completeStep1(user)
      await user.click(button("Crear liga"))

      expect(httpService.post).toHaveBeenCalledWith("/leagues", {
        league_name: "Liga FAMAF",
        match_duration: 5,
        max_teams: 8,
        password: null,
        team_id: 7,
        ...TACTICAL_CONFIG,
      })
      expect(button("Crear liga").disabled).toBe(true)
    })

    it("Debería enviar la contraseña si la liga es privada", async () => {
      httpService.post.mockReturnValue(new Promise(() => {}))
      const user = userEvent.setup()
      renderPage()

      await completeStep1(user, { isPrivate: true })
      await user.click(button("Crear liga"))

      expect(httpService.post.mock.calls[0][1].password).toBe("Asado123")
    })

    it("Debería mostrar un mensaje de éxito y redirigir a la sala de espera ante un 201", async () => {
      httpService.post.mockResolvedValue({ league_id: 3, status: "PENDING" })
      const user = userEvent.setup()
      renderPage()

      await completeStep1(user)
      await user.click(button("Crear liga"))

      expect(screen.getByRole("status").textContent).toMatch(/Liga creada/)
      expect(await screen.findByText("Sala de espera", {}, { timeout: 3000 })).toBeTruthy()
    })
  })

  describe("Manejo de errores", () => {
    it("Debería volver al paso 1 y mostrar el error del cupo ante INVALID_LEAGUE_CAPACITY", async () => {
      httpService.post.mockRejectedValue(
        new ApiError(400, "INVALID_LEAGUE_CAPACITY", "Cupo inválido")
      )
      const user = userEvent.setup()
      renderPage()

      await completeStep1(user)
      await user.click(button("Crear liga"))

      expect(isStep1Visible()).toBe(true)
      expect(await screen.findByText("Cupo inválido")).toBeTruthy()
    })

    it("Debería quedarse en el paso 2 y mostrar el error ante INVALID_CONFIGURATION", async () => {
      httpService.post.mockRejectedValue(
        new ApiError(400, "INVALID_CONFIGURATION", "La alineación no es válida")
      )
      const user = userEvent.setup()
      renderPage()

      await completeStep1(user)
      await user.click(button("Crear liga"))

      expect(screen.getByTestId("tactical-setup").textContent).toContain("La alineación no es válida")
      expect(isStep1Visible()).toBe(false)
    })

    it("Debería mostrar un enlace a mis jugadores ante INSUFFICIENT_TEAM_SETUP", async () => {
      httpService.post.mockRejectedValue(
        new ApiError(422, "INSUFFICIENT_TEAM_SETUP", "Necesitas al menos 6 jugadores")
      )
      const user = userEvent.setup()
      renderPage()

      await completeStep1(user)
      await user.click(button("Crear liga"))

      expect(await screen.findByRole("link", { name: /Ir a mis jugadores/ })).toBeTruthy()
    })

    it("Debería permitir reintentar con el mismo body si no hay conexión", async () => {
      httpService.post.mockRejectedValueOnce(new TypeError("Failed to fetch"))
      httpService.post.mockReturnValueOnce(new Promise(() => {}))
      const user = userEvent.setup()
      renderPage()

      await completeStep1(user)
      await user.click(button("Crear liga"))
      await user.click(await screen.findByRole("button", { name: "Reintentar" }))

      expect(httpService.post).toHaveBeenCalledTimes(2)
      expect(httpService.post.mock.calls[1]).toEqual(httpService.post.mock.calls[0])
    })
  })
})
