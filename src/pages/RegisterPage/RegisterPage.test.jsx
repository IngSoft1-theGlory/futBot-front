// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Routes, Route } from "react-router-dom"

// Reemplazamos solo httpService.post por una función falsa.
// ApiError se mantiene real, porque la página usa `instanceof ApiError`.
vi.mock("../../services/createhttpService", async (importOriginal) => {
  const original = await importOriginal()
  return { ...original, httpService: { post: vi.fn() } }
})

import { httpService, ApiError } from "../../services/createhttpService.js"
import RegisterPage from "./RegisterPage"

const VALID_DATA = {
  username: "Maradona10",
  email: "diego@famaf.unc.edu.ar",
  password: "Password123!",
  teamName: "alfajoresFC",
}

// Crea un archivo de imagen falso para adjuntar como logo
function makeFile(name, type, sizeInBytes = 10) {
  return new File([new Uint8Array(sizeInBytes)], name, { type })
}

const VALID_LOGO = makeFile("alfajores.png", "image/png")

// Renderiza la página dentro de un router, con una pantalla de login falsa
// para poder comprobar las redirecciones.
function renderPage() {
  render(
    <MemoryRouter initialEntries={["/register"]}>
      <Routes>
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<h1>Pantalla de login</h1>} />
      </Routes>
    </MemoryRouter>
  )
}

// Los inputs se buscan por su id (el mismo que el nombre del campo)
function field(id) {
  return document.getElementById(id)
}

function submitButton() {
  return screen.getByRole("button", { name: /crear cuenta/i })
}

// Completa el formulario. Se puede sobrescribir cualquier campo;
// si un valor es "" (o el logo es null), ese campo se deja vacío.
async function fillForm(user, { logo = VALID_LOGO, ...overrides } = {}) {
  const data = { ...VALID_DATA, ...overrides }
  for (const [id, value] of Object.entries(data)) {
    if (value) await user.type(field(id), value)
  }
  if (logo) await user.upload(field("teamLogo"), logo)
}

describe("RegisterPage", () => {
  beforeEach(() => {
    httpService.post.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  describe("Interfaz", () => {
    it("Muestra los cinco campos y el botón de envío", () => {
      renderPage()

      for (const id of [...Object.keys(VALID_DATA), "teamLogo"]) {
        expect(field(id)).not.toBeNull()
      }
      expect(field("teamLogo").type).toBe("file")
      expect(submitButton()).toBeTruthy()
    })

    it("El enlace de login navega a la pantalla de login", async () => {
      const user = userEvent.setup()
      renderPage()

      await user.click(screen.getByRole("link", { name: /iniciá sesión/i }))

      expect(screen.getByText("Pantalla de login")).toBeTruthy()
    })
  })

  describe("Validaciones del frontend", () => {
    it("Con campos vacíos muestra los errores y no llama al backend", async () => {
      const user = userEvent.setup()
      renderPage()

      await user.click(submitButton())

      expect(screen.getByText("El nombre de usuario es obligatorio.")).toBeTruthy()
      expect(screen.getByText("El email es obligatorio.")).toBeTruthy()
      expect(screen.getByText("La contraseña es obligatoria.")).toBeTruthy()
      expect(screen.getByText("El nombre del equipo es obligatorio.")).toBeTruthy()
      expect(screen.getByText("El logo del equipo es obligatorio.")).toBeTruthy()
      expect(httpService.post).not.toHaveBeenCalled()
    })

    it("Con un email inválido muestra el error y no llama al backend", async () => {
      const user = userEvent.setup()
      renderPage()

      await fillForm(user, { email: "diego-sin-arroba" })
      await user.click(submitButton())

      expect(screen.getByText("El email ingresado no tiene un formato válido.")).toBeTruthy()
      expect(httpService.post).not.toHaveBeenCalled()
    })

    it("Con un logo de formato no permitido muestra el error y no llama al backend", async () => {
      // applyAccept: false permite adjuntar un archivo que el selector normalmente filtraría
      const user = userEvent.setup({ applyAccept: false })
      renderPage()

      await fillForm(user, { logo: makeFile("logo.gif", "image/gif") })
      await user.click(submitButton())

      expect(
        screen.getByText("El logo debe ser una imagen .png, .jpg, .jpeg o .svg.")
      ).toBeTruthy()
      expect(httpService.post).not.toHaveBeenCalled()
    })

    it("Con un logo de más de 1 MB muestra el error y no llama al backend", async () => {
      const user = userEvent.setup()
      renderPage()

      await fillForm(user, { logo: makeFile("enorme.png", "image/png", 1024 * 1024 + 1) })
      await user.click(submitButton())

      expect(screen.getByText("El logo no puede superar 1 MB.")).toBeTruthy()
      expect(httpService.post).not.toHaveBeenCalled()
    })

    it("Acepta un logo .svg", async () => {
      httpService.post.mockResolvedValue({})
      const user = userEvent.setup()
      renderPage()

      await fillForm(user, { logo: makeFile("alfajores.svg", "image/svg+xml") })
      await user.click(submitButton())

      expect(httpService.post).toHaveBeenCalledTimes(1)
    })

    it("Muestra el nombre del archivo adjuntado", async () => {
      const user = userEvent.setup()
      renderPage()

      await user.upload(field("teamLogo"), VALID_LOGO)

      expect(screen.getByText("alfajores.png")).toBeTruthy()
    })

    it("Al corregir un campo, su mensaje de error desaparece", async () => {
      const user = userEvent.setup()
      renderPage()

      await user.click(submitButton())
      await user.type(field("username"), "Maradona10")

      expect(screen.queryByText("El nombre de usuario es obligatorio.")).toBeNull()
    })
  })

  describe("Integración con el endpoint", () => {
    it("Con datos válidos envía POST /auth/register con el body del contrato", async () => {
      httpService.post.mockResolvedValue({})
      const user = userEvent.setup()
      renderPage()

      await fillForm(user)
      await user.click(submitButton())

      // El logo se envía como texto "data:image/png;base64,..."
      expect(httpService.post).toHaveBeenCalledWith("/auth/register", {
        username: "Maradona10",
        email: "diego@famaf.unc.edu.ar",
        password: "Password123!",
        team_name: "alfajoresFC",
        team_logo: expect.stringMatching(/^data:image\/png;base64,/),
      })
    })

    it("Mientras la solicitud está en curso no permite un segundo envío", async () => {
      // Una promesa que nunca se resuelve simula una request que sigue en curso
      httpService.post.mockReturnValue(new Promise(() => {}))
      const user = userEvent.setup()
      renderPage()

      await fillForm(user)
      await user.click(submitButton())
      await user.click(submitButton())

      expect(submitButton().disabled).toBe(true)
      expect(httpService.post).toHaveBeenCalledTimes(1)
    })

    it("Ante un 201 muestra el mensaje de éxito y redirige al login", async () => {
      httpService.post.mockResolvedValue({ user_id: 1, team_id: 1 })
      const user = userEvent.setup()
      renderPage()

      await fillForm(user)
      await user.click(submitButton())

      expect(await screen.findByText(/Registro exitoso/)).toBeTruthy()
      expect(
        await screen.findByText("Pantalla de login", {}, { timeout: 3000 })
      ).toBeTruthy()
    })

    it("Ante DUPLICATE_EMAIL muestra el mensaje y conserva los datos", async () => {
      httpService.post.mockRejectedValue(
        new ApiError(400, "DUPLICATE_EMAIL", "El email ingresado se encuentra en uso. Intentar de nuevo")
      )
      const user = userEvent.setup()
      renderPage()

      await fillForm(user)
      await user.click(submitButton())

      expect(await screen.findByText(/se encuentra en uso/)).toBeTruthy()
      expect(field("email").value).toBe(VALID_DATA.email)
      expect(field("username").value).toBe(VALID_DATA.username)
    })

    it.each([
      ["VOID_USERNAME", "El campo nombre de usuario no puede estar vacío."],
      ["VOID_TEAM_NAME", "El nombre del equipo no puede quedar vacío."],
      ["VOID_TEAM_LOGO", "Debes proporcionar un logo para el equipo."],
      ["INVALID_LOGO_FORMAT", "El logo ingresado tiene un formato inválido."],
    ])("Ante %s muestra el mensaje sin reiniciar el formulario", async (code, message) => {
      httpService.post.mockRejectedValue(new ApiError(400, code, message))
      const user = userEvent.setup()
      renderPage()

      await fillForm(user)
      await user.click(submitButton())

      expect(await screen.findByText(message)).toBeTruthy()
      expect(field("teamName").value).toBe(VALID_DATA.teamName)
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
