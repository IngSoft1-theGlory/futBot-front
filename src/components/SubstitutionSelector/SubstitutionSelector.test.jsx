// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("../../services/matches", () => ({ requestSubstitution: vi.fn() }))

import { ApiError } from "../../services/createhttpService"
import { requestSubstitution } from "../../services/matches"
import SubstitutionSelector from "./SubstitutionSelector"

const MESSI = { player_id: 101, team_id: 1, name: "Messi", number: 10 }
const GONZALEZ = { player_id: 105, team_id: 1, name: "Nico González", number: 15 }

const button = (name) => screen.getByRole("button", { name })

function renderSelector(overrides = {}) {
  const props = {
    matchId: 12,
    teamId: 1,
    player: MESSI,
    substitutes: [GONZALEZ],
    plannedSubstitution: null,
    onPlanned: vi.fn(),
    onSubstituted: vi.fn(),
    ...overrides,
  }
  render(<SubstitutionSelector {...props} />)
  return props
}

// Abre el selector y elige al suplente
async function elegirSuplente(user) {
  await user.click(button("Planificar cambio"))
  await user.selectOptions(screen.getByLabelText("Entra"), "105")
}

describe("SubstitutionSelector", () => {
  beforeEach(() => {
    requestSubstitution.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it("Debería no permitir confirmar si no se eligió un suplente", async () => {
    const user = userEvent.setup()
    renderSelector()

    await user.click(button("Planificar cambio"))

    expect(button("Confirmar").disabled).toBe(true)
  })

  it("Debería avisar el cambio planificado si el back responde 202", async () => {
    const user = userEvent.setup()
    requestSubstitution.mockResolvedValue({ planned: true })
    const props = renderSelector()

    await elegirSuplente(user)
    await user.click(button("Confirmar"))

    expect(requestSubstitution).toHaveBeenCalledWith(12, 1, 101, 105)
    expect(props.onPlanned).toHaveBeenCalledWith(101, 105)
    expect(props.onSubstituted).not.toHaveBeenCalled()
  })

  it("Debería avisar la sustitución aplicada si el back responde 201", async () => {
    const user = userEvent.setup()
    requestSubstitution.mockResolvedValue({ planned: false })
    const props = renderSelector()

    await elegirSuplente(user)
    await user.click(button("Confirmar"))

    expect(props.onSubstituted).toHaveBeenCalledWith(101, 105)
    expect(props.onPlanned).not.toHaveBeenCalled()
  })

  it("Debería mostrar el error y no avisar ningún cambio si el back rechaza el pedido", async () => {
    const user = userEvent.setup()
    requestSubstitution.mockRejectedValue(new ApiError(400, "INVALID_PLAYER_SELECTION", "inválido"))
    const props = renderSelector()

    await elegirSuplente(user)
    await user.click(button("Confirmar"))

    expect(screen.getByRole("alert").textContent).toBe("Elegí un titular que esté en cancha y un suplente de tu equipo.")
    expect(props.onPlanned).not.toHaveBeenCalled()
    expect(props.onSubstituted).not.toHaveBeenCalled()
  })

  it("Debería no enviar otro pedido mientras se procesa el primero", async () => {
    const user = userEvent.setup()
    requestSubstitution.mockReturnValue(new Promise(() => {})) // el back no responde todavía
    renderSelector()

    await elegirSuplente(user)
    await user.click(button("Confirmar"))
    await user.click(button("Confirmar"))

    expect(requestSubstitution).toHaveBeenCalledTimes(1)
  })

  it("Debería mostrar el cambio planificado en el panel del titular que sale", () => {
    renderSelector({ plannedSubstitution: { playerOutId: 101, playerInId: 105 } })

    expect(screen.getByRole("status").textContent).toBe("Sale en la próxima pausa por #15 Nico González")
  })
})
