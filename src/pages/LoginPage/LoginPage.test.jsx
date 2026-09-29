// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Routes, Route } from "react-router-dom"

vi.mock("../../services/createhttpService", async (importOriginal) => {
  const original = await importOriginal()
  return { ...original, httpService: { post: vi.fn() } }
})

const mockStartSession = vi.fn()

vi.mock("../../hooks/useSession", () => ({
  useSession: () => ({ startSession: mockStartSession }),
}))

import { httpService, ApiError } from "../../services/createhttpService.js"
import LoginPage from "./LoginPage"

const VALID_DATA = {
  email: "diego@famaf.unc.edu.ar",
  password: "Password123!",
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<h1>Pantalla de registro</h1>} />
        <Route path="/" element={<h1>Pantalla principal</h1>} />
      </Routes>
    </MemoryRouter>
  )
}

function field(id) {
  return document.getElementById(id)
}

function submitButton() {
  return screen.getByRole("button", { name: /iniciar sesión/i })
}

async function fillForm(user, overrides = {}) {
  const data = { ...VALID_DATA, ...overrides }
  for (const [id, value] of Object.entries(data)) {
    if (value) await user.type(field(id), value)
  }
}

describe("LoginPage", () => {
  beforeEach(() => {
    httpService.post.mockReset()
    mockStartSession.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  describe("Interfaz", () => {
    it("Muestra los campos de email y contraseña, y el botón de envío", () => {
      renderPage()

      expect(field("email")).not.toBeNull()
      expect(field("password")).not.toBeNull()
      expect(submitButton()).toBeTruthy()
    })

    it("El campo de contraseña oculta lo que se escribe", () => {
      renderPage()

      expect(field("password").type).toBe("password")
    })

    it("El botón permanece habilitado incluso con campos vacíos", () => {
      renderPage()

      expect(submitButton().disabled).toBe(false)
    })

    it("El enlace de registro navega a la pantalla de registro", async () => {
      const user = userEvent.setup()
      renderPage()

      await user.click(screen.getByRole("link", { name: /registrate/i }))

      expect(screen.getByText("Pantalla de registro")).toBeTruthy()
    })
  })

  describe("Validaciones del frontend", () => {
    it("Con campos vacíos muestra los errores y no llama al backend", async () => {
      const user = userEvent.setup()
      renderPage()

      await user.click(submitButton())

      expect(screen.getByText("El email es obligatorio")).toBeTruthy()
      expect(screen.getByText("La contraseña es obligatoria")).toBeTruthy()
      expect(httpService.post).not.toHaveBeenCalled()
    })

    it("Con un email de formato inválido muestra el error y no llama al backend", async () => {
      const user = userEvent.setup()
      renderPage()

      await fillForm(user, { email: "diego-sin-arroba" })
      await user.click(submitButton())

      expect(screen.getByText("El email no tiene un formato válido")).toBeTruthy()
      expect(httpService.post).not.toHaveBeenCalled()
    })

    it("Un password de solo espacios se considera vacío", async () => {
      const user = userEvent.setup()
      renderPage()

      await fillForm(user, { password: "   " })
      await user.click(submitButton())

      expect(screen.getByText("La contraseña es obligatoria")).toBeTruthy()
      expect(httpService.post).not.toHaveBeenCalled()
    })

    it("Al corregir el campo email, su mensaje de error desaparece", async () => {
      const user = userEvent.setup()
      renderPage()

      await user.click(submitButton())
      expect(screen.getByText("El email es obligatorio")).toBeTruthy()

      await user.type(field("email"), "a")

      expect(screen.queryByText("El email es obligatorio")).toBeNull()
    })
  })

  describe("Integración con el endpoint", () => {
    it("Con datos válidos envía POST /auth/login con el body del contrato", async () => {
      httpService.post.mockResolvedValue({
        token: "abc123",
        token_type: "Bearer",
        user: { user_id: 1, team_id: 1, username: "Maradona10", email: VALID_DATA.email },
      })
      const user = userEvent.setup()
      renderPage()

      await fillForm(user)
      await user.click(submitButton())

      expect(httpService.post).toHaveBeenCalledWith("/auth/login", {
        email: VALID_DATA.email,
        password: VALID_DATA.password,
      })
    })

    it("Mientras la solicitud está en curso no permite un segundo envío", async () => {
      httpService.post.mockReturnValue(new Promise(() => {}))
      const user = userEvent.setup()
      renderPage()

      await fillForm(user)
      await user.click(submitButton())
      await user.click(submitButton())

      expect(submitButton().disabled).toBe(true)
      expect(httpService.post).toHaveBeenCalledTimes(1)
    })

    it("Mientras la solicitud está en curso deshabilita los campos del formulario", async () => {
      httpService.post.mockReturnValue(new Promise(() => {}))
      const user = userEvent.setup()
      renderPage()

      await fillForm(user)
      await user.click(submitButton())

      expect(document.querySelector(".login-form__section").disabled).toBe(true)
    })

    it("Ante un 200 OK guarda la sesión (con tokenType) y redirige a la pantalla principal", async () => {
      const responseData = {
        token: "abc123",
        token_type: "Bearer",
        user: { user_id: 1, team_id: 1, username: "Maradona10", email: VALID_DATA.email },
      }
      httpService.post.mockResolvedValue(responseData)
      const user = userEvent.setup()
      renderPage()

      await fillForm(user)
      await user.click(submitButton())

      expect(mockStartSession).toHaveBeenCalledWith({
        token: "abc123",
        tokenType: "Bearer",
        user: responseData.user,
      })
      expect(await screen.findByText("Pantalla principal")).toBeTruthy()
    })

    it("Ante 401 INVALID_CREDENTIALS muestra el mensaje sin marcar un campo puntual", async () => {
      httpService.post.mockRejectedValue(
        new ApiError(401, "INVALID_CREDENTIALS", "Email o contraseña incorrecto")
      )
      const user = userEvent.setup()
      renderPage()

      await fillForm(user)
      await user.click(submitButton())

      expect(await screen.findByText("Email o contraseña incorrecto")).toBeTruthy()
      expect(field("email").value).toBe(VALID_DATA.email)
      expect(field("password").value).toBe(VALID_DATA.password)
      expect(mockStartSession).not.toHaveBeenCalled()
    })

    it("El botón vuelve a estar habilitado tras un login fallido", async () => {
      httpService.post.mockRejectedValue(
        new ApiError(401, "INVALID_CREDENTIALS", "Email o contraseña incorrecto")
      )
      const user = userEvent.setup()
      renderPage()

      await fillForm(user)
      await user.click(submitButton())
      await screen.findByText("Email o contraseña incorrecto")

      expect(submitButton().disabled).toBe(false)
    })

    it("El mensaje de error general desaparece al volver a escribir", async () => {
      httpService.post.mockRejectedValue(
        new ApiError(401, "INVALID_CREDENTIALS", "Email o contraseña incorrecto")
      )
      const user = userEvent.setup()
      renderPage()

      await fillForm(user)
      await user.click(submitButton())
      await screen.findByText("Email o contraseña incorrecto")

      await user.type(field("password"), "x")

      expect(screen.queryByText("Email o contraseña incorrecto")).toBeNull()
    })

    it("Si no hay conexión con el servidor muestra un mensaje general", async () => {
      httpService.post.mockRejectedValue(new TypeError("Failed to fetch"))
      const user = userEvent.setup()
      renderPage()

      await fillForm(user)
      await user.click(submitButton())

      expect(await screen.findByText(/No se pudo conectar con el servidor/)).toBeTruthy()
    })
  })
})