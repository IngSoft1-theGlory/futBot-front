// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("../../services/behaviors", () => ({ fetchBehaviors: vi.fn() }))
vi.mock("../../services/matches", () => ({ changePlayerBehavior: vi.fn() }))

import { ApiError } from "../../services/createhttpService"
import { fetchBehaviors } from "../../services/behaviors"
import { changePlayerBehavior } from "../../services/matches"
import BehaviorSelector from "./BehaviorSelector"

const COMPORTAMIENTOS = [
  { behavior_id: 1, name: "Defensivo", is_default: true },
  { behavior_id: 8, name: "Mi delantero", is_default: false },
]

const button = (name) => screen.getByRole("button", { name })

function renderSelector(onChanged = vi.fn()) {
  render(<BehaviorSelector matchId={12} playerId={101} currentBehaviorId={1} onChanged={onChanged} />)
  return onChanged
}

async function abrirYElegir(user, nombre) {
  await user.click(button("Cambiar comportamiento"))
  await user.selectOptions(await screen.findByRole("combobox"), screen.getByRole("option", { name: nombre }))
}

describe("BehaviorSelector", () => {
  beforeEach(() => {
    fetchBehaviors.mockReset()
    changePlayerBehavior.mockReset()
    fetchBehaviors.mockResolvedValue(COMPORTAMIENTOS)
  })

  afterEach(() => {
    cleanup()
  })

  it("Debería pedir la lista actualizada cada vez que se abre y mostrar los predeterminados y los propios", async () => {
    const user = userEvent.setup()
    renderSelector()

    await user.click(button("Cambiar comportamiento"))
    expect(await screen.findByRole("option", { name: "Defensivo · predeterminado (actual)" })).toBeTruthy()
    expect(screen.getByRole("option", { name: "Mi delantero" })).toBeTruthy()

    await user.click(button("Cancelar"))
    await user.click(button("Cambiar comportamiento"))

    expect(fetchBehaviors).toHaveBeenCalledTimes(2)
  })

  it("Debería no permitir confirmar sin elegir un comportamiento", async () => {
    const user = userEvent.setup()
    renderSelector()

    await user.click(button("Cambiar comportamiento"))
    await screen.findByRole("combobox")

    expect(button("Confirmar").disabled).toBe(true)
  })

  it("Debería enviar el cambio con los ids correctos y avisar que se aplica desde el próximo tick", async () => {
    changePlayerBehavior.mockResolvedValue({ match_id: 12, player_id: 101, behavior_id: 8 })
    const user = userEvent.setup()
    const onChanged = renderSelector()

    await abrirYElegir(user, "Mi delantero")
    await user.click(button("Confirmar"))

    expect(changePlayerBehavior).toHaveBeenCalledWith(12, 101, 8)
    expect(onChanged).toHaveBeenCalledWith(8)
    expect(screen.getByRole("status").textContent).toBe(
      "Listo: el nuevo comportamiento se aplica desde el próximo tick."
    )
  })

  it("Debería no enviar solicitudes duplicadas mientras el cambio está en curso", async () => {
    changePlayerBehavior.mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup()
    renderSelector()

    await abrirYElegir(user, "Mi delantero")
    await user.click(button("Confirmar"))
    await user.click(button("Confirmar"))

    expect(changePlayerBehavior).toHaveBeenCalledTimes(1)
    expect(button("Confirmar").disabled).toBe(true)
  })

  it("Debería informar el error y conservar el comportamiento anterior si el back rechaza el cambio", async () => {
    changePlayerBehavior.mockRejectedValue(
      new ApiError(422, "INVALID_BEHAVIOR", "El comportamiento seleccionado no pertenece a tu equipo")
    )
    const user = userEvent.setup()
    const onChanged = renderSelector()

    await abrirYElegir(user, "Mi delantero")
    await user.click(button("Confirmar"))

    expect(screen.getByRole("alert").textContent).toBe("Ese comportamiento no está disponible para tu equipo.")
    expect(onChanged).not.toHaveBeenCalled()
  })
})
