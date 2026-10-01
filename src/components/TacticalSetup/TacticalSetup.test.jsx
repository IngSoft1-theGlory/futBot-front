// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"

vi.mock("../../services/createhttpService", async (importOriginal) => {
  const original = await importOriginal()
  return { ...original, httpService: { get: vi.fn(), post: vi.fn() } }
})

import { httpService, ApiError } from "../../services/createhttpService"
import TacticalSetup from "./TacticalSetup"

// ---------- Datos de prueba ----------

const PLAYERS = [
  { player_id: 101, name: "Lionel Messi", number: 10 },
  { player_id: 102, name: "Julián Álvarez", number: 9 },
  { player_id: 103, name: "Cuti Romero", number: 13 },
  { player_id: 104, name: "Enzo Fernández", number: 24 },
  { player_id: 105, name: "Dibu Martínez", number: 23 },
  { player_id: 106, name: "Nahuel Molina", number: 26 },
  { player_id: 107, name: "Lautaro Martínez", number: 22 },
]

const BEHAVIORS = [
  { behavior_id: 1, name: "Patear al arco", is_default: true },
  { behavior_id: 2, name: "Defensor", is_default: true },
]

function playersPage(data, page = 1, totalPages = 1) {
  return {
    data,
    pagination: { current_page: page, per_page: 100, total_items: data.length, total_pages: totalPages },
  }
}

// Simula el backend según la ruta pedida
function mockBackend({ players = PLAYERS, behaviors = BEHAVIORS } = {}) {
  httpService.get.mockImplementation(async (path) => {
    if (path.startsWith("/players")) return playersPage(players)
    if (path.startsWith("/behaviors")) return behaviors
    throw new Error(`Ruta no esperada: ${path}`)
  })
}

// ---------- Helpers ----------

function renderSetup(props = {}) {
  const handlers = { onConfirm: vi.fn(), onCancel: vi.fn() }
  const utils = render(
    <MemoryRouter>
      <TacticalSetup {...handlers} {...props} />
    </MemoryRouter>
  )
  return { ...handlers, ...utils }
}

// Espera a que termine la carga inicial
async function waitForLoad() {
  await screen.findByRole("heading", { name: "Titulares" })
}

function playerSelect(label) {
  return screen.getByRole("combobox", { name: `Jugador (${label})` })
}

function behaviorSelect(label) {
  return screen.getByRole("combobox", { name: `Comportamiento (${label})` })
}

function confirmButton() {
  return screen.getByRole("button", { name: "Confirmar" })
}

async function fillRow(user, label, playerId, behaviorId) {
  await user.selectOptions(playerSelect(label), String(playerId))
  await user.selectOptions(behaviorSelect(label), String(behaviorId))
}

// Completa las 6 filas con la formación 2-1
async function fillLineup(user) {
  await fillRow(user, "Defensor izquierdo", 105, 2)
  await fillRow(user, "Defensor derecho", 103, 2)
  await fillRow(user, "Delantero", 101, 1)
  await fillRow(user, "Suplente 1", 106, 2)
  await fillRow(user, "Suplente 2", 104, 1)
  await fillRow(user, "Suplente 3", 107, 1)
}

// ---------- Tests ----------

describe("TacticalSetup", () => {
  beforeEach(() => {
    httpService.get.mockReset()
    httpService.post.mockReset()
    mockBackend()
  })

  afterEach(() => {
    cleanup()
  })

  describe("Carga de datos", () => {
    it("Debería pedir los jugadores y los comportamientos sin que la pantalla se los pase", async () => {
      renderSetup()
      await waitForLoad()

      const paths = httpService.get.mock.calls.map(([path]) => path)
      expect(paths.some((path) => path.startsWith("/players"))).toBe(true)
      expect(paths).toContain("/behaviors")
    })

    it("Debería pedir todas las páginas de jugadores", async () => {
      httpService.get.mockImplementation(async (path) => {
        if (path.startsWith("/players?page=1")) return playersPage(PLAYERS.slice(0, 4), 1, 2)
        if (path.startsWith("/players?page=2")) return playersPage(PLAYERS.slice(4), 2, 2)
        return BEHAVIORS
      })
      renderSetup()
      await waitForLoad()

      const options = within(playerSelect("Delantero")).getAllByRole("option")
      expect(options).toHaveLength(PLAYERS.length + 1) // + la opción "Elegí un jugador"
    })

    it("Debería mostrar un mensaje de error y permitir reintentar si falla la carga", async () => {
      httpService.get.mockRejectedValueOnce(new ApiError(500, "UNKNOWN_ERROR", "Error del servidor"))
      const user = userEvent.setup()
      renderSetup()

      expect(await screen.findByText("Error del servidor")).toBeTruthy()

      mockBackend()
      await user.click(screen.getByRole("button", { name: "Reintentar" }))

      expect(await screen.findByRole("heading", { name: "Titulares" })).toBeTruthy()
    })

    it("Debería avisar que faltan jugadores si el usuario tiene menos de 6", async () => {
      mockBackend({ players: PLAYERS.slice(0, 4) })
      renderSetup()

      expect(await screen.findByText(/Necesitás al menos 6 jugadores/)).toBeTruthy()
      expect(screen.getByRole("link", { name: /Ir a mis jugadores/ })).toBeTruthy()
    })
  })

  describe("Interfaz", () => {
    it("Debería mostrar las formaciones 2-1 y 1-2, con la 2-1 seleccionada por defecto", async () => {
      renderSetup()
      await waitForLoad()

      expect(screen.getByRole("radio", { name: /2-1/ }).getAttribute("aria-checked")).toBe("true")
      expect(screen.getByRole("radio", { name: /1-2/ }).getAttribute("aria-checked")).toBe("false")
    })

    it("Debería mostrar 3 titulares con sus roles en español y 3 suplentes", async () => {
      renderSetup()
      await waitForLoad()

      for (const label of ["Defensor izquierdo", "Defensor derecho", "Delantero"]) {
        expect(playerSelect(label)).toBeTruthy()
        expect(behaviorSelect(label)).toBeTruthy()
      }
      for (const label of ["Suplente 1", "Suplente 2", "Suplente 3"]) {
        expect(playerSelect(label)).toBeTruthy()
        expect(behaviorSelect(label)).toBeTruthy()
      }
    })

    it("Debería mostrar los roles de la formación 1-2 al elegirla", async () => {
      const user = userEvent.setup()
      renderSetup()
      await waitForLoad()

      await user.click(screen.getByRole("radio", { name: /1-2/ }))

      for (const label of ["Defensor", "Delantero izquierdo", "Delantero derecho"]) {
        expect(playerSelect(label)).toBeTruthy()
      }
    })
  })

  describe("Validaciones", () => {
    it("Debería tener la confirmación deshabilitada hasta completar las 6 filas", async () => {
      const user = userEvent.setup()
      renderSetup()
      await waitForLoad()

      expect(confirmButton().disabled).toBe(true)

      await fillRow(user, "Defensor izquierdo", 105, 2)
      await fillRow(user, "Defensor derecho", 103, 2)
      await fillRow(user, "Delantero", 101, 1)
      await fillRow(user, "Suplente 1", 106, 2)
      await fillRow(user, "Suplente 2", 104, 1)
      await user.selectOptions(playerSelect("Suplente 3"), "107")
      expect(confirmButton().disabled).toBe(true) // falta el comportamiento de la última fila

      await user.selectOptions(behaviorSelect("Suplente 3"), "1")
      expect(confirmButton().disabled).toBe(false)
    })

    it("No debería permitir elegir el mismo jugador en más de una fila", async () => {
      const user = userEvent.setup()
      renderSetup()
      await waitForLoad()

      await user.selectOptions(playerSelect("Delantero"), "101")

      const messiEnOtraFila = within(playerSelect("Suplente 1")).getByRole("option", { name: /Lionel Messi/ })
      expect(messiEnOtraFila.disabled).toBe(true)
    })

    it("Debería permitir asignar el mismo comportamiento a varios jugadores", async () => {
      const user = userEvent.setup()
      renderSetup()
      await waitForLoad()

      await fillLineup(user)
      // Varias filas usan el comportamiento 1 y 2 y la confirmación igual se habilita

      expect(confirmButton().disabled).toBe(false)
    })
  })

  describe("Cambio de formación", () => {
    it("Debería limpiar los titulares y conservar los suplentes", async () => {
      const user = userEvent.setup()
      renderSetup()
      await waitForLoad()

      await fillRow(user, "Delantero", 101, 1)
      await fillRow(user, "Suplente 1", 106, 2)

      await user.click(screen.getByRole("radio", { name: /1-2/ }))

      expect(playerSelect("Defensor").value).toBe("")
      expect(playerSelect("Delantero izquierdo").value).toBe("")
      expect(playerSelect("Delantero derecho").value).toBe("")
      expect(playerSelect("Suplente 1").value).toBe("106")
      expect(behaviorSelect("Suplente 1").value).toBe("2")
    })
  })

  describe("Confirmación", () => {
    it("Debería entregar la configuración con la estructura del contrato", async () => {
      const user = userEvent.setup()
      const { onConfirm } = renderSetup()
      await waitForLoad()

      await fillLineup(user)
      await user.click(confirmButton())

      expect(onConfirm).toHaveBeenCalledWith({
        formation_type: "2-1",
        starting_players: [
          { player_id: 105, role: "DEF_LEFT", behavior_id: 2 },
          { player_id: 103, role: "DEF_RIGHT", behavior_id: 2 },
          { player_id: 101, role: "FORWARD", behavior_id: 1 },
        ],
        substitute_players: [
          { player_id: 106, behavior_id: 2 },
          { player_id: 104, behavior_id: 1 },
          { player_id: 107, behavior_id: 1 },
        ],
      })
    })

    it("No debería llamar a ningún endpoint de crear o unirse al confirmar", async () => {
      const user = userEvent.setup()
      renderSetup()
      await waitForLoad()
      const getCallsBefore = httpService.get.mock.calls.length

      await fillLineup(user)
      await user.click(confirmButton())

      expect(httpService.post).not.toHaveBeenCalled()
      expect(httpService.get.mock.calls.length).toBe(getCallsBefore)
    })

    it("Debería deshabilitar la confirmación mientras hay un envío en curso", async () => {
      const initialConfig = {
        formation_type: "2-1",
        starting_players: [
          { player_id: 105, role: "DEF_LEFT", behavior_id: 2 },
          { player_id: 103, role: "DEF_RIGHT", behavior_id: 2 },
          { player_id: 101, role: "FORWARD", behavior_id: 1 },
        ],
        substitute_players: [
          { player_id: 106, behavior_id: 2 },
          { player_id: 104, behavior_id: 1 },
          { player_id: 107, behavior_id: 1 },
        ],
      }
      renderSetup({ initialConfig, isSubmitting: true })
      await waitForLoad()

      expect(confirmButton().disabled).toBe(true)
    })
  })

  describe("Configuración inicial y errores", () => {
    it("Debería mostrar la configuración inicial que recibe", async () => {
      const initialConfig = {
        formation_type: "1-2",
        starting_players: [{ player_id: 102, role: "FORWARD_LEFT", behavior_id: 1 }],
        substitute_players: [{ player_id: 104, behavior_id: 2 }],
      }
      renderSetup({ initialConfig })
      await waitForLoad()

      expect(screen.getByRole("radio", { name: /1-2/ }).getAttribute("aria-checked")).toBe("true")
      expect(playerSelect("Delantero izquierdo").value).toBe("102")
      expect(playerSelect("Suplente 1").value).toBe("104")
    })

    it("Debería mostrar el mensaje de error que recibe sin perder la selección del usuario", async () => {
      const user = userEvent.setup()
      const { rerender, onConfirm, onCancel } = renderSetup()
      await waitForLoad()

      await fillRow(user, "Delantero", 101, 1)

      rerender(
        <MemoryRouter>
          <TacticalSetup
            onConfirm={onConfirm}
            onCancel={onCancel}
            errorMessage="La formación o la alineación seleccionados no es válida."
          />
        </MemoryRouter>
      )

      expect(screen.getByRole("alert").textContent).toBe(
        "La formación o la alineación seleccionados no es válida."
      )
      expect(playerSelect("Delantero").value).toBe("101")
      expect(behaviorSelect("Delantero").value).toBe("1")
    })
  })

  describe("Cancelar", () => {
    it("Debería llamar a onCancel sin entregar la configuración", async () => {
      const user = userEvent.setup()
      const { onConfirm, onCancel } = renderSetup()
      await waitForLoad()

      await fillLineup(user)
      await user.click(screen.getByRole("button", { name: "Cancelar" }))

      expect(onCancel).toHaveBeenCalledTimes(1)
      expect(onConfirm).not.toHaveBeenCalled()
    })
  })
})