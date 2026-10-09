import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom/vitest"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import BehaviorListPage from "./BehaviorListPage"
import { httpService, ApiError } from "../../services/createhttpService"

vi.mock("../../services/createhttpService", async () => {
  const actual = await vi.importActual("../../services/createhttpService")
  return { ...actual, httpService: { get: vi.fn() } }
})

const mockBehaviors = [
  { behavior_id: 1, name: "Atacar arco", description: "Corre y patea", code: "def on_tick(api): pass", is_default: true },
  { behavior_id: 2, name: "Defender", description: "Se queda atras", code: "def on_tick(api): api.idle()", is_default: true },
]

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/behaviors"]}>
      <Routes>
        <Route path="/behaviors" element={<BehaviorListPage />} />
        <Route path="/behaviors/:behaviorId" element={<p>Pantalla de detalle</p>} />
        <Route path="/" element={<p>Pantalla de inicio</p>} />
      </Routes>
    </MemoryRouter>
  )
}

describe("BehaviorListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  describe("Lista con elementos", () => {
    it("Debería pedir los comportamientos por default y mostrar nombre y descripción de cada uno, sin el código", async () => {
      httpService.get.mockResolvedValue(mockBehaviors)
      renderPage()

      // findBy espera a que lleguen los datos
      // Después ya se puede usar getBy sin problemas
      expect(await screen.findByText("Atacar arco")).toBeInTheDocument()
      expect(screen.getByText("Corre y patea")).toBeInTheDocument()
      expect(screen.getByText("Defender")).toBeInTheDocument()
      expect(screen.getByText("Se queda atras")).toBeInTheDocument()

      expect(screen.getAllByTestId("behavior-card")).toHaveLength(2)
      expect(httpService.get).toHaveBeenCalledWith("/behaviors?is_default=true")
      expect(screen.queryByText(/def on_tick/)).not.toBeInTheDocument()
    })
  })

  describe("Estados", () => {
    it("Debería mostrar el indicador de carga (y no el mensaje de vacío) mientras espera la respuesta", () => {
      httpService.get.mockReturnValue(new Promise(() => {}))   // nunca se resuelve
      renderPage()

      expect(screen.getByText(/cargando comportamientos/i)).toBeInTheDocument()
      expect(screen.queryByText(/no hay comportamientos/i)).not.toBeInTheDocument()
    })

    it("Debería mostrar un mensaje de lista vacía, y no un error, cuando la respuesta es []", async () => {
      httpService.get.mockResolvedValue([])
      renderPage()

      expect(await screen.findByText(/no hay comportamientos disponibles/i)).toBeInTheDocument()
      expect(screen.queryByRole("alert")).not.toBeInTheDocument()
      expect(screen.queryAllByTestId("behavior-card")).toHaveLength(0)
    })
  })

  describe("Errores", () => {
    it.each([
      [
        "403 (permisos)",
        new ApiError(403, "FORBIDDEN", "Mensaje del backend que no se debe mostrar"),
        "No tenés permisos para ver los comportamientos.",
      ],
      [
        "otro error de la API (usa el message del contrato)",
        new ApiError(400, "INVALID_QUERY_PARAMS", "El parámetro 'is_default' debe ser un booleano válido."),
        "El parámetro 'is_default' debe ser un booleano válido.",
      ],
      [
        "fallo de red (no es un ApiError)",
        new Error("fail"),
        "No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo.",
      ],
    ])("Debería mostrar el mensaje correcto ante %s", async (_caso, error, mensajeEsperado) => {
      httpService.get.mockRejectedValue(error)
      renderPage()

      expect(await screen.findByRole("alert")).toHaveTextContent(mensajeEsperado)
      expect(screen.queryByText(/cargando comportamientos/i)).not.toBeInTheDocument()
    })
  })

  describe("Interacciones", () => {
    it("Debería navegar al detalle del comportamiento al hacer click en su tarjeta", async () => {
      httpService.get.mockResolvedValue(mockBehaviors)
      renderPage()

      await userEvent.click(await screen.findByRole("button", { name: /atacar arco/i }))

      expect(screen.getByText("Pantalla de detalle")).toBeInTheDocument()
    })

    it("Debería volver al inicio con el enlace 'Volver al inicio'", async () => {
      httpService.get.mockResolvedValue(mockBehaviors)
      renderPage()

      await userEvent.click(screen.getByRole("link", { name: /volver al inicio/i }))

      expect(screen.getByText("Pantalla de inicio")).toBeInTheDocument()
    })
  })
})