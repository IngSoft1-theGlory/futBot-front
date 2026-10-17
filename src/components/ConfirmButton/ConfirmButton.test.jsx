import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom/vitest"
import ConfirmButton from "./ConfirmButton"

const LABEL = "Salir"
const MESSAGE = "¿Estas seguro de querer salir?"

function renderConfirmButton(props = {}) {
  // Prepara la simulación de interacciones de un usuario con la pantalla
  const user = userEvent.setup()
  // Crea un mock que registra cuantas veces se llamó la función
  const onConfirm = vi.fn()

  render(
    <ConfirmButton
      label={LABEL}
      confirmMessage={MESSAGE}
      onConfirm={onConfirm}
      {...props}
    />
  )

  return { user, onConfirm }
}

describe("ConfirmButton", () => {
  afterEach(() => {
    cleanup()
  })

  it("Debería mostrar el botón inicial sin mostrar la confirmación", () => {
    renderConfirmButton()  // Renderizamos la pantalla

    expect(screen.getByRole("button", { name: LABEL })).toBeInTheDocument()  // Vemos si existe el boton inicial
    expect(screen.queryByText(MESSAGE)).not.toBeInTheDocument()  // No deberia estar el mensaje
  })

  it("Debería mostrar el mensaje y las acciones al pulsar el botón inicial", async () => {
    const { user, onConfirm } = renderConfirmButton()     // Renderizamos el boton de confirmar

    await user.click(screen.getByRole("button", { name: LABEL }))    // El usuario presiona el boton inicial

    expect(screen.getByText(MESSAGE)).toBeInTheDocument()   // Deberia aparecer el mensaje del ConfirmButton
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeInTheDocument()  // Deberia aparecer el boton Confirmar 
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument()  // Deberia aparecer el boton Cancelar
    expect(screen.queryByRole("button", { name: LABEL })).not.toBeInTheDocument()  // No deberia aparecer el boton inicial
    expect(onConfirm).not.toHaveBeenCalled()     // No deberia mandarse la acción de confirmar
  })

  it("Debería llamar a onConfirm y volver al botón inicial al confirmar", async () => {
    const { user, onConfirm } = renderConfirmButton()

    await user.click(screen.getByRole("button", { name: LABEL }))
    await user.click(screen.getByRole("button", { name: "Confirmar" }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("button", { name: LABEL })).toBeInTheDocument()
    expect(screen.queryByText(MESSAGE)).not.toBeInTheDocument()
  })

  it("Debería volver al botón inicial sin llamar a onConfirm al cancelar", async () => {
    const { user, onConfirm } = renderConfirmButton()

    await user.click(screen.getByRole("button", { name: LABEL }))
    await user.click(screen.getByRole("button", { name: "Cancelar" }))

    expect(onConfirm).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: LABEL })).toBeInTheDocument()
    expect(screen.queryByText(MESSAGE)).not.toBeInTheDocument()
  })

  it("Debería impedir abrir la confirmación si el botón está deshabilitado", async () => {
    const { user, onConfirm } = renderConfirmButton({ disabled: true })

    const button = screen.getByRole("button", { name: LABEL })
    expect(button).toBeDisabled()

    await user.click(button)

    expect(screen.queryByText(MESSAGE)).not.toBeInTheDocument()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it("Debería impedir abrir la confirmación mientras está cargando", async () => {
    const { user, onConfirm } = renderConfirmButton({ isLoading: true })

    const button = screen.getByRole("button", { name: LABEL })
    expect(button).toBeDisabled()

    await user.click(button)

    expect(screen.queryByText(MESSAGE)).not.toBeInTheDocument()
    expect(onConfirm).not.toHaveBeenCalled()
  })
})