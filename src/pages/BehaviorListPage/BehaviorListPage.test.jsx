import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom/vitest"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import BehaviorListPage from "./BehaviorListPage"
import { httpService, ApiError } from "../../services/createhttpService"

vi.mock("../../services/createhttpService", async () => {
  const actual = await vi.importActual("../../services/createhttpService")
  return { ...actual, httpService: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }
})

vi.mock("@uiw/react-codemirror", () => ({
  default: ({ id, value, onChange }) => (
    <textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}))

const mockBehaviors = [
  { behavior_id: 1, name: "Atacar arco", description: "Corre y patea", code: "def on_tick(api): pass", is_default: true },
  { behavior_id: 2, name: "Defender", description: "Se queda atras", code: "def on_tick(api): api.idle()", is_default: true },
]

// Comportamiento propio
const mockCustom = { 
  behavior_id: 15, 
  name: "Mi comportamiento", 
  description: "Una descripción", 
  code: "def on_tick(api): pass", 
  is_default: false,
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/behaviors"]}>
      <Routes>
        <Route path="/behaviors" element={<BehaviorListPage />} />
        <Route path="/" element={<p>Pantalla de inicio</p>} />
      </Routes>
    </MemoryRouter>
  )
}

// Simula que el back responde según la ruta pedida
function mockGet(rutas) {
  httpService.get.mockImplementation((path) => Promise.resolve(rutas[path]))
}

describe("BehaviorListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  describe("Lista con elementos", () => {
    it("Debería pedir los comportamientos y mostrar nombre y descripción de cada uno, sin el código", async () => {
      httpService.get.mockResolvedValue(mockBehaviors)
      renderPage()

      // findBy espera a que lleguen los datos
      // Después ya se puede usar getBy sin problemas
      expect(await screen.findByText("Atacar arco")).toBeInTheDocument()
      expect(screen.getByText("Corre y patea")).toBeInTheDocument()
      expect(screen.getByText("Defender")).toBeInTheDocument()
      expect(screen.getByText("Se queda atras")).toBeInTheDocument()

      expect(screen.getAllByTestId("behavior-card")).toHaveLength(2)
      expect(httpService.get).toHaveBeenCalledWith("/behaviors")
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
    it("Debería abrir el detalle al hacer click en una tarjeta y volver a la colección sin volver a pedir la lista", async () => {
      httpService.get
        .mockResolvedValueOnce(mockBehaviors)      // 1° pedido: la lista
        .mockResolvedValueOnce(mockBehaviors[0])   // 2° pedido: el detalle
      renderPage()

      await userEvent.click(await screen.findByRole("button", { name: /atacar arco/i }))
      expect(httpService.get).toHaveBeenLastCalledWith("/behaviors/1")
      expect(await screen.findByText("def on_tick(api): pass")).toBeInTheDocument()
      expect(screen.queryAllByTestId("behavior-card")).toHaveLength(0)

      await userEvent.click(screen.getByRole("button", { name: /volver a la colección/i }))
      expect(screen.getAllByTestId("behavior-card")).toHaveLength(2)
      expect(httpService.get).toHaveBeenCalledTimes(2)   // la lista una sola vez + el detalle
    })

    it("Debería volver al inicio con el enlace 'Volver al inicio'", async () => {
      httpService.get.mockResolvedValue(mockBehaviors)
      renderPage()

      await userEvent.click(screen.getByRole("link", { name: /volver al inicio/i }))

      expect(screen.getByText("Pantalla de inicio")).toBeInTheDocument()
    })
  })

  describe("Crear y editar", () => {
    it("Debería abrir el formulario de creación y volver a la lista al cancelar sin pedirla de nuevo", async () => {
      httpService.get.mockResolvedValue(mockBehaviors)
      renderPage()
      await screen.findByText("Atacar arco")

      await userEvent.click(screen.getByRole("button", { name: /crear comportamiento/i }))
      expect(screen.getByRole("heading", { name: /crear comportamiento/i })).toBeInTheDocument()
      expect(screen.queryAllByTestId("behavior-card")).toHaveLength(0)

      await userEvent.click(screen.getByRole("button", { name: /cancelar/i }))
      expect(screen.getAllByTestId("behavior-card")).toHaveLength(2)
      expect(httpService.get).toHaveBeenCalledTimes(1)
    })

    it("Debería crear el comportamiento, abrir su detalle, avisar el éxito y volver a cargar la lista", async () => {
      const nuevo = { ...mockCustom, behavior_id: 9 }
      mockGet({ "/behaviors": mockBehaviors, "/behaviors/9": nuevo })
      httpService.post.mockResolvedValue(nuevo)
      renderPage()

      await userEvent.click(screen.getByRole("button", { name: /crear comportamiento/i }))
      await userEvent.type(screen.getByLabelText(/nombre/i), nuevo.name)
      await userEvent.type(screen.getByLabelText(/descripción/i), nuevo.description)
      await userEvent.type(screen.getByLabelText(/código/i), nuevo.code)
      await userEvent.click(screen.getByRole("button", { name: /guardar/i }))

      expect(await screen.findByText("Comportamiento creado correctamente")).toBeInTheDocument()
      expect(await screen.findByRole("heading", { name: nuevo.name })).toBeInTheDocument()
      // La lista se pidió dos veces: al montar la página y después de guardar
      const pedidosDeLista = httpService.get.mock.calls.filter(([path]) => path === "/behaviors")
      expect(pedidosDeLista).toHaveLength(2)
    })

    it("Debería editar desde el detalle, mostrar el éxito y los datos actualizados", async () => {
      // Este back falso "guarda" el cambio: después del PUT, los GET devuelven el comportamiento editado
      const rutas = { "/behaviors": [...mockBehaviors, mockCustom], "/behaviors/15": mockCustom }
      httpService.get.mockImplementation((path) => Promise.resolve(rutas[path]))
      httpService.put.mockImplementation(async (path, body) => {
        const editado = { ...mockCustom, ...body }
        rutas["/behaviors/15"] = editado
        return editado
      })
      renderPage()

      await userEvent.click(await screen.findByRole("button", { name: /mi comportamiento/i }))
      await userEvent.click(await screen.findByRole("button", { name: /editar/i }))
      const nombre = await screen.findByLabelText(/nombre/i)
      await userEvent.clear(nombre)
      await userEvent.type(nombre, "Nombre editado")
      await userEvent.click(screen.getByRole("button", { name: /guardar/i }))

      expect(httpService.put).toHaveBeenCalledWith("/behaviors/15", {
        name: "Nombre editado",
        description: mockCustom.description,
        code: mockCustom.code,
      })
      expect(await screen.findByText("Comportamiento editado correctamente")).toBeInTheDocument()
      expect(await screen.findByRole("heading", { name: "Nombre editado" })).toBeInTheDocument()
    })

    it("Debería volver al detalle, sin guardar, al cancelar la edición", async () => {
      mockGet({ "/behaviors": [...mockBehaviors, mockCustom], "/behaviors/15": mockCustom })
      renderPage()

      await userEvent.click(await screen.findByRole("button", { name: /mi comportamiento/i }))
      await userEvent.click(await screen.findByRole("button", { name: /editar/i }))
      await userEvent.click(await screen.findByRole("button", { name: /cancelar/i }))

      expect(await screen.findByRole("heading", { name: mockCustom.name })).toBeInTheDocument()
      expect(httpService.put).not.toHaveBeenCalled()
    })
  })
})