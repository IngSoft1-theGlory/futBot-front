// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

// Se simula solo el pedido al back: el filtro por tipo es el real
vi.mock("../../services/behaviors", async (importOriginal) => ({
  ...(await importOriginal()),
  fetchBehaviors: vi.fn(),
}))
vi.mock("../../services/matches", () => ({ changePlayerBehavior: vi.fn(), requestSubstitution: vi.fn() }))

import { ApiError } from "../../services/createhttpService"
import { fetchBehaviors } from "../../services/behaviors"
import { changePlayerBehavior, requestSubstitution } from "../../services/matches"
import PauseMenu from "./PauseMenu"

const MESSI = { player_id: 101, team_id: 1, name: "Messi", number: 10, behavior_id: 3 }
const DI_MARIA = { player_id: 102, team_id: 1, name: "Di María", number: 11, behavior_id: 3 }
const RONALDO = { player_id: 205, team_id: 2, name: "Ronaldo", number: 7, behavior_id: null }
const GONZALEZ = { player_id: 105, team_id: 1, name: "Nico González", number: 15, behavior_id: 3 }

const BEHAVIORS = [
  { behavior_id: 3, name: "Defensivo", is_default: true, behavior_type: "PLAYER" },
  { behavior_id: 8, name: "Mi delantero", is_default: false, behavior_type: "PLAYER" },
]

const HALF_TIME = { type: "HALF_TIME", remainingSeconds: 20 }

const button = (name) => screen.getByRole("button", { name })
const options = (select) => within(select).getAllByRole("option").map((option) => option.textContent)

function renderMenu(overrides = {}) {
  const props = {
    matchId: 12,
    teamId: 1,
    pause: HALF_TIME,
    players: [MESSI, DI_MARIA, RONALDO],
    substitutes: [GONZALEZ],
    onSubstituted: vi.fn(),
    onBehaviorChanged: vi.fn(),
    ...overrides,
  }
  const result = render(<PauseMenu {...props} />)
  return { ...result, props }
}

async function elegirSustitucion(user) {
  await user.selectOptions(screen.getByLabelText("Sale"), "#10 Messi")
  await user.selectOptions(screen.getByLabelText("Entra"), "#15 Nico González")
}

describe("PauseMenu", () => {
  beforeEach(() => {
    requestSubstitution.mockReset()
    changePlayerBehavior.mockReset()
    fetchBehaviors.mockReset()
    fetchBehaviors.mockResolvedValue(BEHAVIORS)
  })

  afterEach(() => {
    cleanup()
  })

  describe("Cuenta regresiva", () => {
    it.each([
      { type: "HALF_TIME", nombre: "Half-Time" },
      { type: "COOLING_BREAK", nombre: "Cooling Break" },
    ])("Debería mostrar $nombre con los segundos restantes cuando la pausa es $type", ({ type, nombre }) => {
      renderMenu({ pause: { type, remainingSeconds: 10 } })

      expect(screen.getByRole("heading", { name: nombre })).toBeTruthy()
      expect(screen.getByRole("timer").textContent).toBe("Quedan 10 s")
    })

    it("Debería actualizar los segundos cuando cambian", () => {
      const { rerender, props } = renderMenu()

      rerender(<PauseMenu {...props} pause={{ ...HALF_TIME, remainingSeconds: 19 }} />)

      expect(screen.getByRole("timer").textContent).toBe("Quedan 19 s")
    })
  })

  describe("Sustitución", () => {
    it("Debería ofrecer como salientes solo a los titulares propios y como entrantes a los suplentes", () => {
      renderMenu()

      expect(options(screen.getByLabelText("Sale"))).toEqual(["Elegí un jugador", "#10 Messi", "#11 Di María"])
      expect(options(screen.getByLabelText("Entra"))).toEqual(["Elegí un jugador", "#15 Nico González"])
    })

    it("Debería no permitir confirmar hasta elegir quién sale y quién entra", async () => {
      const user = userEvent.setup()
      renderMenu()
      expect(button("Confirmar sustitución").disabled).toBe(true)

      await user.selectOptions(screen.getByLabelText("Sale"), "#10 Messi")
      expect(button("Confirmar sustitución").disabled).toBe(true)

      await user.selectOptions(screen.getByLabelText("Entra"), "#15 Nico González")
      expect(button("Confirmar sustitución").disabled).toBe(false)
    })

    it("Debería pedir la sustitución y, si el back la confirma, actualizar la cancha y limpiar la selección", async () => {
      requestSubstitution.mockResolvedValue({})
      const user = userEvent.setup()
      const { props } = renderMenu()

      await elegirSustitucion(user)
      await user.click(button("Confirmar sustitución"))

      expect(requestSubstitution).toHaveBeenCalledWith(12, 1, 101, 105)
      expect(props.onSubstituted).toHaveBeenCalledWith(101, 105)
      expect(screen.getByRole("status").textContent).toBe("Listo: la sustitución ya se ve en la cancha.")
      expect(screen.getByLabelText("Sale").value).toBe("")
      expect(screen.getByLabelText("Entra").value).toBe("")
    })

    it("Debería no enviar solicitudes duplicadas mientras la sustitución está en curso", async () => {
      requestSubstitution.mockReturnValue(new Promise(() => {}))
      const user = userEvent.setup()
      renderMenu()

      await elegirSustitucion(user)
      await user.click(button("Confirmar sustitución"))
      await user.click(button("Confirmar sustitución"))

      expect(requestSubstitution).toHaveBeenCalledTimes(1)
      expect(button("Confirmar sustitución").disabled).toBe(true)
    })

    it.each([
      {
        caso: "ya hizo un cambio",
        error: new ApiError(409, "SUBSTITUTION_LIMIT_EXCEEDED", "Límite de sustituciones"),
        mensaje: "Ya hiciste un cambio en esta pausa.",
      },
      {
        caso: "la selección no es válida",
        error: new ApiError(400, "INVALID_PLAYER_SELECTION", "Selección inválida"),
        mensaje: "Elegí un titular que esté en cancha y un suplente de tu equipo.",
      },
      {
        caso: "el usuario no participa en el partido",
        error: new ApiError(403, "UNAUTHORIZED_ACTION", "No participás"),
        mensaje: "No participás en este partido.",
      },
      {
        caso: "el código no es conocido (se usa el mensaje del back)",
        error: new ApiError(400, "MATCH_NOT_PAUSED", "El partido no está en pausa."),
        mensaje: "El partido no está en pausa.",
      },
      {
        caso: "no hay conexión",
        error: new TypeError("Failed to fetch"),
        mensaje: "No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo.",
      },
    ])("Debería mostrar el error y no tocar la cancha cuando $caso", async ({ error, mensaje }) => {
      requestSubstitution.mockRejectedValue(error)
      const user = userEvent.setup()
      const { props } = renderMenu()

      await elegirSustitucion(user)
      await user.click(button("Confirmar sustitución"))

      expect(screen.getByRole("alert").textContent).toBe(mensaje)
      expect(props.onSubstituted).not.toHaveBeenCalled()
      expect(screen.queryByRole("status")).toBeNull()
    })

    it("Debería no mostrar error con un 401: de eso se encarga la gestión de sesión", async () => {
      requestSubstitution.mockRejectedValue(new ApiError(401, "UNAUTHORIZED", "Sesión vencida"))
      const user = userEvent.setup()
      renderMenu()

      await elegirSustitucion(user)
      await user.click(button("Confirmar sustitución"))

      expect(screen.queryByRole("alert")).toBeNull()
    })
  })

  describe("Comportamiento", () => {
    async function abrirSelector(user) {
      await user.selectOptions(screen.getByLabelText("Jugador"), "#10 Messi")
      await user.click(button("Cambiar comportamiento"))
      await user.selectOptions(await screen.findByLabelText("Nuevo comportamiento"), "Mi delantero")
    }

    it("Debería ofrecer el selector recién al elegir uno de los jugadores propios", async () => {
      const user = userEvent.setup()
      renderMenu()

      expect(options(screen.getByLabelText("Jugador"))).toEqual(["Elegí un jugador", "#10 Messi", "#11 Di María"])
      expect(screen.queryByRole("button", { name: "Cambiar comportamiento" })).toBeNull()

      await user.selectOptions(screen.getByLabelText("Jugador"), "#10 Messi")
      expect(button("Cambiar comportamiento")).toBeTruthy()
    })

    it("Debería reasignar el comportamiento del jugador elegido y avisar con su id", async () => {
      changePlayerBehavior.mockResolvedValue({ player_id: 101, behavior_id: 8 })
      const user = userEvent.setup()
      const { props } = renderMenu()

      await abrirSelector(user)
      await user.click(button("Confirmar"))

      expect(changePlayerBehavior).toHaveBeenCalledWith(12, 101, 8)
      expect(props.onBehaviorChanged).toHaveBeenCalledWith(101, 8)
    })

    it("Debería mostrar el error si el back rechaza el comportamiento", async () => {
      changePlayerBehavior.mockRejectedValue(new ApiError(422, "INVALID_BEHAVIOR", "Comportamiento inválido"))
      const user = userEvent.setup()
      const { props } = renderMenu()

      await abrirSelector(user)
      await user.click(button("Confirmar"))

      expect(screen.getByRole("alert").textContent).toBe("Ese comportamiento no está disponible para tu equipo.")
      expect(props.onBehaviorChanged).not.toHaveBeenCalled()
    })
  })
})
