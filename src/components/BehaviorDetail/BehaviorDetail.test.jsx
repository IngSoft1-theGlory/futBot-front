import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom/vitest"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import BehaviorDetail from "./BehaviorDetail"
import SessionProvider from "../../context/SessionProvider"
import ProtectedRoute from "../ProtectedRoute/ProtectedRoute"
import PublicOnlyRoute from "../PublicOnlyRoute/PublicOnlyRoute"
import LoginPage from "../../pages/LoginPage/LoginPage"
import { httpService, ApiError } from "../../services/createhttpService"
import { setSession, clearSession, expireSession } from "../../services/session"

vi.mock("../../services/createhttpService", async () => {
  const actual = await vi.importActual("../../services/createhttpService")
  return { ...actual, httpService: { get: vi.fn() } }
})

// Código con indentación y una línea en blanco, para verificar que se muestra tal cual
const CODE = "def on_tick(api):\n    if api.ball_is_near():\n        api.kick()\n\n    api.idle()"

const mockBehavior = {
  behavior_id: 7,
  name: "Atacar arco",
  description: "El jugador corre hacia adelante y patea la pelota",
  code: CODE,
  is_default: true,
  behavior_type: "PLAYER",
}
const mockCustom = { ...mockBehavior, is_default: false }

function renderDetail(onBack = vi.fn(), onEdit = vi.fn()) {
  return render(<BehaviorDetail behaviorId={7} onBack={onBack} onEdit={onEdit} />)
}

describe("BehaviorDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
    clearSession()
  })

  describe("Carga", () => {
    it("Debería pedir GET /behaviors/{behaviorId} y mostrar el estado de carga mientras responde", () => {
      httpService.get.mockReturnValue(new Promise(() => {}))   // nunca se resuelve
      renderDetail()

      expect(httpService.get).toHaveBeenCalledWith("/behaviors/7")
      expect(screen.getByText(/cargando comportamiento/i)).toBeInTheDocument()
      expect(screen.queryByRole("button", { name: /editar/i })).not.toBeInTheDocument()
    })
  })

  describe("Respuesta 200", () => {
    it("Debería ser de solo lectura si es un comportamiento por default, sin permitir editar", async () => {
      httpService.get.mockResolvedValue(mockBehavior)
      const { container } = renderDetail()

      expect(await screen.findByRole("heading", { name: "Atacar arco" })).toBeInTheDocument()
      expect(screen.getByText(mockBehavior.description)).toBeInTheDocument()
      expect(screen.getByText("Por default")).toBeInTheDocument()
      expect(container.querySelector("pre").textContent).toBe(CODE)   // con los espacios y saltos de línea
      expect(screen.queryByText(/cargando comportamiento/i)).not.toBeInTheDocument()
      // Sin campos editables, y el único botón es "Volver a la colección"
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
      expect(screen.getAllByRole("button")).toHaveLength(1)
    })

    it("Debería mostrar el botón 'Editar' (y no el indicador) en un comportamiento propio, y llamar a onEdit al hacer click", async () => {
      httpService.get.mockResolvedValue(mockCustom)
      const onEdit = vi.fn()
      renderDetail(vi.fn(), onEdit)

      await userEvent.click(await screen.findByRole("button", { name: /editar/i }))

      expect(onEdit).toHaveBeenCalledTimes(1)
      expect(screen.queryByText("Por default")).not.toBeInTheDocument()
    })

    it.each([
      ["PLAYER", "Jugador"],
      ["COACH", "DT"],
    ])("Debería mostrar el tipo del comportamiento: %s se ve como '%s'", async (tipo, etiqueta) => {
      httpService.get.mockResolvedValue({ ...mockCustom, behavior_type: tipo })
      renderDetail()

      await screen.findByRole("heading", { name: "Atacar arco" })
      expect(screen.getByText(etiqueta)).toBeInTheDocument()
    })
  })

  describe("Errores", () => {
    it.each([
      [
        "403 FORBIDDEN",
        new ApiError(403, "FORBIDDEN", "Mensaje del backend que no se debe mostrar"),
        "No tenés permiso para ver este comportamiento.",
      ],
      [
        "404 BEHAVIOR_NOT_FOUND",
        new ApiError(404, "BEHAVIOR_NOT_FOUND", "Mensaje del backend que no se debe mostrar"),
        "El comportamiento no existe o fue eliminado.",
      ],
      [
        "otro error de la API (usa el message del contrato)",
        new ApiError(500, "UNKNOWN_ERROR", "Ocurrió un error inesperado"),
        "Ocurrió un error inesperado",
      ],
      [
        "fallo de red (no es un ApiError)",
        new TypeError("Failed to fetch"),
        "No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo.",
      ],
    ])("Debería mostrar el mensaje correcto ante %s", async (_caso, error, mensajeEsperado) => {
      httpService.get.mockRejectedValue(error)
      renderDetail()

      expect(await screen.findByRole("alert")).toHaveTextContent(mensajeEsperado)
      expect(screen.queryByText(/cargando comportamiento/i)).not.toBeInTheDocument()
      expect(screen.queryByRole("button", { name: /editar/i })).not.toBeInTheDocument()
    })

    // Acá usamos la sesión, las rutas y el login reales para probar el recorrido completo
    it("Ante 401 debería redirigir a /login con el aviso de sesión expirada", async () => {
      // Simulamos lo que hace createHttpService ante un 401: cierra la sesión y rechaza el pedido
      httpService.get.mockImplementation(async () => {
        await Promise.resolve()   // La respuesta llega un momento después, como en un fetch real
        expireSession()
        throw new ApiError(401, "UNAUTHORIZED", "El token de sesión no es válido o ha expirado")
      })
      setSession({ token: "token-vencido", tokenType: "Bearer", user: { user_id: 1 } })   // Arranca con sesión iniciada

      render(
        <MemoryRouter initialEntries={["/behaviors"]}>
          <SessionProvider>
            <Routes>
              <Route element={<ProtectedRoute />}>
                <Route path="/behaviors" element={<BehaviorDetail behaviorId={7} onBack={vi.fn()} onEdit={vi.fn()} />} />
              </Route>
              <Route element={<PublicOnlyRoute />}>
                <Route path="/login" element={<LoginPage />} />
              </Route>
            </Routes>
          </SessionProvider>
        </MemoryRouter>
      )

      expect(await screen.findByText("Tu sesión expiró. Iniciá sesión de nuevo.")).toBeInTheDocument()
      expect(screen.getByRole("heading", { name: "Iniciar sesión" })).toBeInTheDocument()
      expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    })
  })

  describe("Volver a la colección", () => {
    it("Debería llamar a onBack al hacer click en 'Volver a la colección'", async () => {
      httpService.get.mockResolvedValue(mockBehavior)
      const onBack = vi.fn()
      renderDetail(onBack)
      await screen.findByRole("heading", { name: "Atacar arco" })

      await userEvent.click(screen.getByRole("button", { name: /volver a la colección/i }))

      expect(onBack).toHaveBeenCalledTimes(1)
    })

    it("Debería permitir volver aunque haya un error", async () => {
      httpService.get.mockRejectedValue(new ApiError(404, "BEHAVIOR_NOT_FOUND", "No existe"))
      const onBack = vi.fn()
      renderDetail(onBack)
      await screen.findByRole("alert")

      await userEvent.click(screen.getByRole("button", { name: /volver a la colección/i }))

      expect(onBack).toHaveBeenCalledTimes(1)
    })
  })
})