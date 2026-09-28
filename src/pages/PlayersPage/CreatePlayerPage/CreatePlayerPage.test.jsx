// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Routes, Route } from "react-router-dom"

// Reemplazamos solo httpService.post por una función falsa.
// ApiError se mantiene real, porque la página usa `instanceof ApiError`.
vi.mock("../../../services/createhttpService", async (importOriginal) => {
  const original = await importOriginal()
  return { ...original, httpService: { post: vi.fn() } }
})

import { httpService, ApiError } from "../../../services/createhttpService.js"
import CreatePlayerPage from "./CreatePlayerPage"

// 5 atributos x 60 = 300 puntos: valores válidos "de fábrica"
const VALID_DATA = {
  name: "Lionel Messi",
  number: "10",
}

// Renderiza la página dentro de un router, con una pantalla "anterior" falsa
// para poder comprobar que "Cancelar" vuelve atrás.
function renderPage() {
  render(
    <MemoryRouter initialEntries={["/", "/players/createplayer"]} initialIndex={1}>
      <Routes>
        <Route path="/" element={<h1>Pantalla anterior</h1>} />
        <Route path="/players/createplayer" element={<CreatePlayerPage />} />
      </Routes>
    </MemoryRouter>
  )
}

// Los inputs se buscan por su id (el mismo que el nombre del campo)
function field(id) {
  return document.getElementById(id)
}

function submitButton() {
  return screen.getByRole("button", { name: /crear jugador/i })
}

// Completa nombre y número. Los atributos PACSS quedan en su valor por defecto (60 c/u = 300).
async function fillForm(user, overrides = {}) {
  const data = { ...VALID_DATA, ...overrides }
  for (const [id, value] of Object.entries(data)) {
    if (value === "") continue
    await user.clear(field(id))
    await user.type(field(id), value)
  }
}

describe("CreatePlayerPage", () => {
  beforeEach(() => {
    httpService.post.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  describe("Interfaz", () => {
    it("Muestra nombre, número, los cinco atributos PACSS y los botones", () => {
      renderPage()

      expect(field("name")).not.toBeNull()
      expect(field("number")).not.toBeNull()
      for (const atributo of ["power", "agility", "control", "speed", "strength"]) {
        expect(field(atributo)).not.toBeNull()
      }
      expect(submitButton()).toBeTruthy()
      expect(screen.getByRole("button", { name: /cancelar/i })).toBeTruthy()
    })

    it("Arranca mostrando el total en 300 puntos", () => {
      renderPage()

      expect(screen.getByText("Total repartido: 300 / 300 puntos")).toBeTruthy()
    })

    it("Cancelar vuelve a la pantalla anterior", async () => {
      const user = userEvent.setup()
      renderPage()

      await user.click(screen.getByRole("button", { name: /cancelar/i }))

      expect(screen.getByText("Pantalla anterior")).toBeTruthy()
    })
  })

  describe("Validaciones del frontend", () => {
    it("Con campos vacíos muestra los errores y no llama al backend", async () => {
      const user = userEvent.setup()
      renderPage()

      await user.click(submitButton())

      expect(screen.getByText("El nombre del jugador es obligatorio.")).toBeTruthy()
      expect(screen.getByText("El número de camiseta es obligatorio.")).toBeTruthy()
      expect(httpService.post).not.toHaveBeenCalled()
    })

    it("Con un atributo fuera de rango (20-100) muestra el error y no llama al backend", async () => {
      const user = userEvent.setup()
      renderPage()

      await fillForm(user)
      await user.clear(field("power"))
      await user.type(field("power"), "10")
      await user.click(submitButton())

      expect(
        screen.getByText("Cada atributo debe valer entre 20 y 100 puntos.")
      ).toBeTruthy()
      expect(httpService.post).not.toHaveBeenCalled()
    })

    it("Con atributos dentro de rango pero que no suman 300 muestra el error y no llama al backend", async () => {
      const user = userEvent.setup()
      renderPage()

      await fillForm(user)
      await user.clear(field("power"))
      await user.type(field("power"), "80") // total pasa a 320

      await user.click(submitButton())

      expect(
        screen.getByText("La suma de los atributos debe dar exactamente 300 puntos (ahora suma 320).")
      ).toBeTruthy()
      expect(httpService.post).not.toHaveBeenCalled()
    })

    it("Al corregir un campo, su mensaje de error desaparece", async () => {
      const user = userEvent.setup()
      renderPage()

      await user.click(submitButton())
      await user.type(field("name"), "Lionel Messi")

      expect(screen.queryByText("El nombre del jugador es obligatorio.")).toBeNull()
    })
  })

  describe("Integración con el endpoint", () => {
    it("Con datos válidos envía POST /players con el body del contrato", async () => {
      httpService.post.mockResolvedValue({})
      const user = userEvent.setup()
      renderPage()

      await fillForm(user)
      await user.click(submitButton())

      expect(httpService.post).toHaveBeenCalledWith("/players", {
        name: "Lionel Messi",
        number: 10,
        power: 60,
        agility: 60,
        control: 60,
        speed: 60,
        strength: 60,
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

    it("Ante un 201 muestra el mensaje de éxito", async () => {
      httpService.post.mockResolvedValue({ player_id: 1 })
      const user = userEvent.setup()
      renderPage()

      await fillForm(user)
      await user.click(submitButton())

      expect(await screen.findByText("¡Jugador creado con éxito!")).toBeTruthy()
    })

    it("Ante DUPLICATE_JERSEY_NUMBER muestra el error en el número de camiseta", async () => {
      httpService.post.mockRejectedValue(
        new ApiError(400, "DUPLICATE_JERSEY_NUMBER", "Ya existe un jugador con ese número en el equipo.")
      )
      const user = userEvent.setup()
      renderPage()

      await fillForm(user)
      await user.click(submitButton())

      expect(await screen.findByText("Ya existe un jugador con ese número en el equipo.")).toBeTruthy()
      expect(screen.queryByText("¡Jugador creado con éxito!")).toBeNull()
    })

    it("Ante INVALID_PACSS_DATA del backend muestra el error en la sección de atributos", async () => {
      httpService.post.mockRejectedValue(
        new ApiError(400, "INVALID_PACSS_DATA", "Los atributos no suman 300 puntos.")
      )
      const user = userEvent.setup()
      renderPage()

      await fillForm(user)
      await user.click(submitButton())

      expect(await screen.findByText("Los atributos no suman 300 puntos.")).toBeTruthy()
    })

    it("Ante 404 TEAM_NOT_FOUND notifica que primero hace falta un equipo", async () => {
      httpService.post.mockRejectedValue(
        new ApiError(404, "TEAM_NOT_FOUND", "Primero tenés que crear tu equipo.")
      )
      const user = userEvent.setup()
      renderPage()

      await fillForm(user)
      await user.click(submitButton())

      expect(await screen.findByText("Primero tenés que crear tu equipo.")).toBeTruthy()
    })

    it("Ante 401 UNAUTHORIZED notifica que la sesión expiró", async () => {
      httpService.post.mockRejectedValue(
        new ApiError(401, "UNAUTHORIZED", "Tu sesión expiró, iniciá sesión de nuevo.")
      )
      const user = userEvent.setup()
      renderPage()

      await fillForm(user)
      await user.click(submitButton())

      expect(await screen.findByText("Tu sesión expiró, iniciá sesión de nuevo.")).toBeTruthy()
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
