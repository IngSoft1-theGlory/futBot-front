// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, act } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"

// Se simulan solo los pedidos al back, el filtro por tipo es el real
vi.mock("../../services/behaviors", async (importOriginal) => ({
  ...(await importOriginal()),
  fetchBehaviors: vi.fn(),
}))
vi.mock("../../services/leagues", () => ({ chooseLeagueCoach: vi.fn() }))

import { ApiError } from "../../services/createhttpService"
import { fetchBehaviors } from "../../services/behaviors"
import { chooseLeagueCoach } from "../../services/leagues"
import CoachSelector from "./CoachSelector"

// ---------- Datos y helpers ----------

// Como GET /behaviors: mezcla los dos tipos
const COMPORTAMIENTOS = [
  { behavior_id: 1, name: "Defensivo", is_default: true, behavior_type: "PLAYER" },
  { behavior_id: 20, name: "DT ofensivo", is_default: false, behavior_type: "COACH" },
  { behavior_id: 21, name: "DT defensivo", is_default: false, behavior_type: "COACH" },
]

const LIGA_ID = 3
const EQUIPO_ID = 8

const button = (name) => screen.getByRole("button", { name })

// El Link del mensaje "sin comportamientos de DT" necesita un router
function renderSelector({ currentCoachId = null, disabled = false } = {}) {
  const onChanged = vi.fn()
  render(
    <MemoryRouter>
      <CoachSelector
        leagueId={LIGA_ID}
        teamId={EQUIPO_ID}
        currentCoachId={currentCoachId}
        disabled={disabled}
        onChanged={onChanged}
      />
    </MemoryRouter>
  )
  return onChanged
}

// Espera a que cargue la lista, elige una opción por su nombre y confirma
async function elegirYConfirmar(user, nombre) {
  await user.selectOptions(await screen.findByRole("combobox"), screen.getByRole("option", { name: nombre }))
  await user.click(button("Confirmar"))
}

// ---------- Tests ----------

describe("CoachSelector", () => {
  beforeEach(() => {
    fetchBehaviors.mockReset()
    chooseLeagueCoach.mockReset()
    fetchBehaviors.mockResolvedValue(COMPORTAMIENTOS)
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers() // por si un test usó timers falsos
  })

  it("Debería ofrecer solo los comportamientos COACH y la opción Sin DT, y mostrar el DT actual", async () => {
    renderSelector({ currentCoachId: 21 })

    await screen.findByRole("combobox")

    const opciones = screen.getAllByRole("option").map((option) => option.textContent)
    expect(opciones).toEqual(["Sin DT", "DT ofensivo", "DT defensivo"])
    expect(screen.getByText("DT defensivo", { selector: "strong" })).toBeTruthy()
  })

  it.each([
    { caso: "elegir un DT", actual: null, nombre: "DT ofensivo", behaviorId: 20 },
    { caso: "quitar el DT con Sin DT", actual: 20, nombre: "Sin DT", behaviorId: null },
  ])("Debería enviar behavior_id $behaviorId y avisar con onChanged al $caso", async ({ actual, nombre, behaviorId }) => {
    chooseLeagueCoach.mockResolvedValue({ league_id: LIGA_ID, team_id: EQUIPO_ID, behavior_id: behaviorId })
    const user = userEvent.setup()
    const onChanged = renderSelector({ currentCoachId: actual })

    await elegirYConfirmar(user, nombre)

    expect(chooseLeagueCoach).toHaveBeenCalledWith(LIGA_ID, EQUIPO_ID, behaviorId)
    expect(onChanged).toHaveBeenCalledWith(behaviorId)
    expect((await screen.findByRole("status")).textContent).toBe(
      "Listo: tu DT se aplicará desde el próximo partido."
    )
  })

  it.each([
    {
      caso: "la liga no está en curso",
      error: new ApiError(409, "LEAGUE_NOT_IN_PROGRESS", "mensaje del back"),
      mensaje: "El DT solo se puede elegir mientras la liga está en curso.",
    },
    {
      caso: "el equipo no es del usuario",
      error: new ApiError(403, "UNAUTHORIZED_ACTION", "mensaje del back"),
      mensaje: "Solo podés elegir el DT de tu propio equipo.",
    },
    {
      caso: "el comportamiento no es de DT",
      error: new ApiError(400, "INVALID_DATA", "mensaje del back"),
      mensaje: "Ese comportamiento no es de director técnico.",
    },
    {
      caso: "el código de error no está traducido",
      error: new ApiError(500, "INTERNAL_ERROR", "Ocurrió un error en el servidor."),
      mensaje: "Ocurrió un error en el servidor.",
    },
    {
      caso: "falla la conexión",
      error: new TypeError("Failed to fetch"),
      mensaje: "No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo.",
    },
  ])("Debería mostrar el error y conservar el DT anterior cuando $caso", async ({ error, mensaje }) => {
    chooseLeagueCoach.mockRejectedValue(error)
    const user = userEvent.setup()
    const onChanged = renderSelector()

    await elegirYConfirmar(user, "DT ofensivo")

    expect((await screen.findByRole("alert")).textContent).toBe(mensaje)
    expect(onChanged).not.toHaveBeenCalled()
  })

  it.each([
    { caso: "no cambió la opción", props: { currentCoachId: 20 }, selectDeshabilitado: false },
    { caso: "disabled es true", props: { disabled: true }, selectDeshabilitado: true },
  ])("Debería dejar Confirmar deshabilitado cuando $caso", async ({ props, selectDeshabilitado }) => {
    renderSelector(props)

    const select = await screen.findByRole("combobox")

    expect(select.disabled).toBe(selectDeshabilitado)
    expect(button("Confirmar").disabled).toBe(true)
  })

  it("Debería no enviar solicitudes duplicadas mientras el pedido está en curso", async () => {
    chooseLeagueCoach.mockReturnValue(new Promise(() => {})) // nunca responde
    const user = userEvent.setup()
    renderSelector()

    await elegirYConfirmar(user, "DT ofensivo")
    await user.click(button("Confirmar"))

    expect(chooseLeagueCoach).toHaveBeenCalledTimes(1)
    expect(button("Confirmar").disabled).toBe(true)
  })

  it("Debería mostrar el mensaje con el link a /behaviors si no hay comportamientos COACH", async () => {
    fetchBehaviors.mockResolvedValue([COMPORTAMIENTOS[0]]) // solo hay uno PLAYER
    renderSelector()

    await screen.findByText(/Todavía no tenés comportamientos de DT/)

    expect(screen.getByRole("link", { name: "Comportamientos" }).getAttribute("href")).toBe("/behaviors")
    expect(screen.queryByRole("combobox")).toBeNull()
  })

  it("Debería mostrar el error de carga y volver a pedir la lista al tocar Reintentar", async () => {
    fetchBehaviors.mockRejectedValueOnce(new TypeError("Failed to fetch")) // solo falla la primera vez
    const user = userEvent.setup()
    renderSelector()

    expect((await screen.findByRole("alert")).textContent).toContain("No se pudieron cargar los comportamientos.")

    await user.click(button("Reintentar"))

    expect(await screen.findByRole("combobox")).toBeTruthy()
    expect(fetchBehaviors).toHaveBeenCalledTimes(2)
  })

  // Si este test te da problemas con los timers, podés borrarlo: no es parte de los criterios de aceptación
  it("Debería ocultar el mensaje de éxito a los 4 segundos", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true }) // sin esa opción, findBy* se cuelga con timers falsos
    chooseLeagueCoach.mockResolvedValue({ league_id: LIGA_ID, team_id: EQUIPO_ID, behavior_id: 20 })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderSelector()

    await elegirYConfirmar(user, "DT ofensivo")
    await screen.findByRole("status")

    act(() => {
      vi.advanceTimersByTime(4000)
    })

    expect(screen.queryByRole("status")).toBeNull()
  })
})