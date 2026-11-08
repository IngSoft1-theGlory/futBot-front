import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom/vitest"
import BehaviorForm from "./BehaviorForm"
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

// Datos válidos para completar el formulario
const VALID = {
  name: "Mi comportamiento",
  description: "Una descripción",
  code: "def on_tick(api): pass",
}

// Comportamiento Propio (de DT, para comprobar que al editar se muestra el tipo guardado y no el de por defecto)
const mockBehavior = { behavior_id: 7, ...VALID, is_default: false, behavior_type: "COACH" }

// Los labels terminan en ":", por eso se buscan con regex y no con el texto exacto
async function completarFormulario({ name, description, code }) {
  await userEvent.type(screen.getByLabelText(/nombre/i), name)
  await userEvent.type(screen.getByLabelText(/descripción/i), description)
  await userEvent.type(screen.getByLabelText(/código/i), code)
}

const guardar = () => screen.getByRole("button", { name: /guardar/i })

// Sin behaviorId el formulario crea; con behaviorId edita
function renderCrear(onSaved = vi.fn()) {
  return render(<BehaviorForm onBack={vi.fn()} onSaved={onSaved} />)
}

function renderEditar(onSaved = vi.fn(), onBack = vi.fn()) {
  return render(<BehaviorForm behaviorId={7} onBack={onBack} onSaved={onSaved} />)
}

describe("BehaviorForm", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  describe("Crear", () => {
    it("Debería mostrar el formulario vacío con el tipo Jugador por defecto, sin pedir nada al back, y enviar los campos con POST /behaviors", async () => {
      const guardado = { behavior_id: 9, ...VALID, is_default: false, behavior_type: "PLAYER" }
      httpService.post.mockResolvedValue(guardado)
      const onSaved = vi.fn()
      renderCrear(onSaved)

      expect(screen.getByRole("heading", { name: /crear comportamiento/i })).toBeInTheDocument()
      expect(screen.getByLabelText(/nombre/i)).toHaveValue("")
      expect(screen.getByLabelText(/tipo/i)).toHaveValue("PLAYER")   // sin tocar nada, queda Jugador
      expect(httpService.get).not.toHaveBeenCalled()

      await completarFormulario(VALID)
      await userEvent.click(guardar())

      expect(httpService.post).toHaveBeenCalledWith("/behaviors", { ...VALID, behavior_type: "PLAYER" })
      await waitFor(() => expect(onSaved).toHaveBeenCalledWith(guardado))
    })

    // Se elige cada opción por el texto que ve el usuario y se comprueba el valor que llega al back
    it.each([
      ["Jugador", "PLAYER"],
      ["DT", "COACH"],
    ])("Debería enviar el tipo elegido al crear: '%s' se manda como %s", async (opcion, tipoEnviado) => {
      httpService.post.mockResolvedValue({ behavior_id: 9, ...VALID, is_default: false, behavior_type: tipoEnviado })
      renderCrear()

      await userEvent.selectOptions(screen.getByLabelText(/tipo/i), opcion)
      await completarFormulario(VALID)
      await userEvent.click(guardar())

      expect(httpService.post).toHaveBeenCalledWith("/behaviors", { ...VALID, behavior_type: tipoEnviado })
    })
  })

  describe("Validación en el front", () => {
    it("Debería mostrar un error por campo vacío (o solo espacios), no enviar nada y quitar el error al corregirlo", async () => {
      renderCrear()
      await userEvent.type(screen.getByLabelText(/nombre/i), "   ")

      await userEvent.click(guardar())

      expect(screen.getByText("El nombre es obligatorio")).toBeInTheDocument()
      expect(screen.getByText("La descripción es obligatoria")).toBeInTheDocument()
      expect(screen.getByText("El código es obligatorio")).toBeInTheDocument()
      expect(httpService.post).not.toHaveBeenCalled()

      const nombre = screen.getByLabelText(/nombre/i)
      expect(nombre).toHaveClass("behavior-form__input--error")
      await userEvent.clear(nombre)
      await userEvent.type(nombre, "Nombre válido")

      expect(screen.queryByText("El nombre es obligatorio")).not.toBeInTheDocument()
      expect(nombre).not.toHaveClass("behavior-form__input--error")
      expect(screen.getByText("La descripción es obligatoria")).toBeInTheDocument()
      expect(screen.getByText("El código es obligatorio")).toBeInTheDocument()
    })

    // Se usa fireEvent.change porque escribir 5000 caracteres con userEvent.type sería lentísimo
    it.each([
      ["el nombre", /nombre/i, 101, "El nombre no puede tener más de 100 caracteres"],
      ["la descripción", /descripción/i, 501, "La descripción no puede tener más de 500 caracteres"],
      ["el código", /código/i, 5001, "El código no puede tener más de 5000 caracteres"],
    ])("Debería rechazar %s si supera el largo permitido", async (_campo, label, largo, mensaje) => {
      renderCrear()
      await completarFormulario(VALID)
      fireEvent.change(screen.getByLabelText(label), { target: { value: "a".repeat(largo) } })

      await userEvent.click(guardar())

      expect(screen.getByText(mensaje)).toBeInTheDocument()
      expect(httpService.post).not.toHaveBeenCalled()
    })
  })

  describe("Editar", () => {
    it("Debería precargar los campos y enviar los tres con PUT aunque solo se haya cambiado el nombre", async () => {
      const editado = { ...mockBehavior, name: "Nuevo nombre" }
      httpService.get.mockResolvedValue(mockBehavior)
      httpService.put.mockResolvedValue(editado)
      const onSaved = vi.fn()
      renderEditar(onSaved)

      // findBy espera a que termine la carga; después ya se puede usar getBy
      const nombre = await screen.findByLabelText(/nombre/i)
      expect(httpService.get).toHaveBeenCalledWith("/behaviors/7")
      expect(nombre).toHaveValue(VALID.name)
      expect(screen.getByLabelText(/descripción/i)).toHaveValue(VALID.description)
      expect(screen.getByLabelText(/código/i)).toHaveValue(VALID.code)

      await userEvent.clear(nombre)
      await userEvent.type(nombre, "Nuevo nombre")
      await userEvent.click(guardar())

      expect(httpService.put).toHaveBeenCalledWith("/behaviors/7", { ...VALID, name: "Nuevo nombre" })
      expect(httpService.post).not.toHaveBeenCalled()
      await waitFor(() => expect(onSaved).toHaveBeenCalledWith(editado))
    })

    it("Debería mostrar el tipo guardado como texto, sin ningún campo para cambiarlo, y no enviarlo en el PUT", async () => {
      httpService.get.mockResolvedValue(mockBehavior)
      httpService.put.mockResolvedValue(mockBehavior)
      renderEditar()

      // El tipo que vino del back (DT), no el de por defecto (Jugador)
      expect(await screen.findByText("DT")).toBeInTheDocument()
      expect(screen.getByText(/tipo:/i)).toBeInTheDocument()
      // No hay campo del tipo: ni desplegable ni caja de texto
      expect(screen.queryByLabelText(/tipo/i)).not.toBeInTheDocument()
      expect(screen.queryByRole("combobox")).not.toBeInTheDocument()

      await userEvent.click(guardar())

      await waitFor(() => expect(httpService.put).toHaveBeenCalledTimes(1))
      const [, bodyEnviado] = httpService.put.mock.calls[0]
      expect(bodyEnviado).toEqual(VALID)                     // solo nombre, descripción y código
      expect(bodyEnviado).not.toHaveProperty("behavior_type")
    })

    it("No debería mostrar la línea del tipo si el back no mandó behavior_type", async () => {
      const { behavior_type: _sinTipo, ...comportamientoSinTipo } = mockBehavior
      httpService.get.mockResolvedValue(comportamientoSinTipo)
      renderEditar()

      await screen.findByLabelText(/nombre/i)   // espera a que termine la carga

      expect(screen.queryByText(/tipo:/i)).not.toBeInTheDocument()
      expect(screen.queryByLabelText(/tipo/i)).not.toBeInTheDocument()
    })

    it("Debería mostrar el error de carga y permitir volver si el comportamiento no existe", async () => {
      httpService.get.mockRejectedValue(new ApiError(404, "BEHAVIOR_NOT_FOUND", "Mensaje del backend que no se debe mostrar"))
      const onBack = vi.fn()
      renderEditar(vi.fn(), onBack)

      expect(await screen.findByRole("alert")).toHaveTextContent("El comportamiento no existe o fue eliminado.")

      await userEvent.click(screen.getByRole("button", { name: /volver/i }))

      expect(onBack).toHaveBeenCalledTimes(1)
    })
  })

  describe("Errores al enviar", () => {
    it.each([
      [
        "un rechazo del back (usa el message del contrato)",
        new ApiError(400, "INVALID_DATA", "Los datos ingresados para el comportamiento no son válidos"),
        "Los datos ingresados para el comportamiento no son válidos",
      ],
      [
        "un 403 (comportamiento predeterminado)",
        new ApiError(403, "UNAUTHORIZED_ACTION", "Mensaje del backend que no se debe mostrar"),
        "No tenés permiso para modificar este comportamiento.",
      ],
      [
        "un fallo de red (no es un ApiError)",
        new TypeError("Failed to fetch"),
        "No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo.",
      ],
    ])("Debería mostrar el mensaje, conservar lo escrito y habilitar el botón ante %s", async (_caso, error, mensajeEsperado) => {
      httpService.post.mockRejectedValue(error)
      renderCrear()
      await completarFormulario(VALID)

      await userEvent.click(guardar())

      expect(await screen.findByRole("alert")).toHaveTextContent(mensajeEsperado)
      // Lo que el usuario escribió no se pierde
      expect(screen.getByLabelText(/nombre/i)).toHaveValue(VALID.name)
      expect(screen.getByLabelText(/descripción/i)).toHaveValue(VALID.description)
      expect(screen.getByLabelText(/código/i)).toHaveValue(VALID.code)
      // El .finally vuelve a habilitar el botón
      await waitFor(() => expect(guardar()).toBeEnabled())
    })

    it("Debería permitir reenviar después de un rechazo del back", async () => {
      const guardado = { behavior_id: 9, ...VALID, is_default: false }
      httpService.post
        .mockRejectedValueOnce(new ApiError(400, "INVALID_DATA", "Los datos ingresados para el comportamiento no son válidos"))
        .mockResolvedValueOnce(guardado)
      const onSaved = vi.fn()
      renderCrear(onSaved)
      await completarFormulario(VALID)

      await userEvent.click(guardar())
      await screen.findByRole("alert")
      await waitFor(() => expect(guardar()).toBeEnabled())
      await userEvent.click(guardar())

      await waitFor(() => expect(onSaved).toHaveBeenCalledWith(guardado))
      expect(httpService.post).toHaveBeenCalledTimes(2)
      expect(screen.queryByRole("alert")).not.toBeInTheDocument()   // el error anterior se limpió
    })

    it("Ante un 401 no debería mostrar ningún mensaje (la app redirige al login)", async () => {
      httpService.post.mockRejectedValue(new ApiError(401, "UNAUTHORIZED", "El token de sesión no es válido o ha expirado"))
      renderCrear()
      await completarFormulario(VALID)

      await userEvent.click(guardar())

      await waitFor(() => expect(guardar()).toBeEnabled())
      expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    })
  })

  describe("Doble envío", () => {
    it("Debería deshabilitar el botón y enviar una sola petición aunque se haga click dos veces", async () => {
      httpService.post.mockReturnValue(new Promise(() => {}))
      renderCrear()
      await completarFormulario(VALID)

      await userEvent.click(guardar())
      await userEvent.click(guardar())

      expect(httpService.post).toHaveBeenCalledTimes(1)
      expect(guardar()).toBeDisabled()
    })
  })
})