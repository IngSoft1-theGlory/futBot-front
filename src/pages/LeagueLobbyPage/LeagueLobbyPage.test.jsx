// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, act, fireEvent } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"

vi.mock("../../services/createhttpService", async (importOriginal) => {
  const original = await importOriginal()
  return { ...original, httpService: { get: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

let mockUser = null
vi.mock("../../hooks/useSession", () => ({
  useSession: () => ({ user: mockUser }),
}))

// Guarda los listeners para poder emitir eventos desde los tests
const mockListeners = new Map()

vi.mock("../../services/globalSocket", () => ({
  subscribe: vi.fn((eventName, listener) => {
    if (!mockListeners.has(eventName)) mockListeners.set(eventName, new Set())
    mockListeners.get(eventName).add(listener)
    return () => mockListeners.get(eventName)?.delete(listener)
  }),
}))

import { httpService, ApiError } from "../../services/createhttpService.js"
import LeagueLobbyPage from "./LeagueLobbyPage.jsx"

// ---------- Datos para los tests ----------

const EQUIPO_ANFITRION = { team_id: 1, team_name: "alfajoresFC" }
const EQUIPO_INVITADO = { team_id: 8, team_name: "BocaJuniors" }
const EQUIPO_NUEVO = { team_id: 14, team_name: "RiverPlate" }

const USUARIO_ANFITRION = {
  user_id: 1,
  team_id: 1,
  username: "Maradona10",
  email: "diego@famaf.unc.edu.ar",
}
const USUARIO_INVITADO = {
  user_id: 2,
  team_id: 8,
  username: "Riquelme10",
  email: "roman@famaf.unc.edu.ar",
}

// Lobby de liga pendiente. El anfitrión es el equipo 1.
function armarLiga(teams, isPrivate = false) {
  return {
    league_id: 3,
    league_name: "Liga FAMAF Apertura",
    status: "PENDING",
    is_private: isPrivate,
    host_team_id: EQUIPO_ANFITRION.team_id,
    max_teams: 8,
    current_teams_count: teams.length,
    match_duration: 5,
    teams,
  }
}

// La liga ya iniciada
function ligaIniciada(liga) {
  return { ...liga, status: "IN_PROGRESS" }
}

// Lista de N equipos
function armarEquipos(n) {
  const equipos = []
  for (let i = 1; i <= n; i++) {
    equipos.push({ team_id: i, team_name: `Equipo${i}` })
  }
  return equipos
}

// ---------- Helpers ----------

function renderPage(leagueId = "3") {
  return render(
    <MemoryRouter initialEntries={[`/leagues/${leagueId}`]}>
      <Routes>
        <Route path="/leagues/:leagueId" element={<LeagueLobbyPage />} />
        <Route path="/leagues" element={<h1>Lista de Ligas</h1>} />
      </Routes>
    </MemoryRouter>
  )
}

// Es async porque el evento dispara un nuevo GET (refetch): hay que esperar a que se resuelva
async function emitirEvento(event, data) {
  await act(async () => {
    mockListeners.get(event)?.forEach((listener) => listener(data))
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

// Renderiza el lobby ya cargado con dos equipos
async function abrirLobby() {
  httpService.get.mockResolvedValue(armarLiga([EQUIPO_ANFITRION, EQUIPO_INVITADO]))
  renderPage()
  await screen.findByText("Liga FAMAF Apertura")
}

// Renderiza el lobby como anfitrión, con N equipos y la liga PENDING.
async function abrirComoAnfitrion(equipos = 4) {
  mockUser = USUARIO_ANFITRION
  httpService.get.mockResolvedValue(armarLiga(armarEquipos(equipos)))
  renderPage()
  await screen.findByText("Liga FAMAF Apertura")
}

// Abandonar la liga lleva dos clicks: Primero "Abandonar liga" y luego "Confirmar"
function abandonarLiga() {
  fireEvent.click(screen.getByRole("button", { name: "Abandonar liga" }))
  fireEvent.click(screen.getByRole("button", { name: "Confirmar" }))
}

// ---------- Tests ----------

describe("LeagueLobbyPage", () => {
  beforeEach(() => {
    httpService.get.mockReset()
    httpService.put.mockReset()
    httpService.delete.mockReset()
    mockListeners.clear()
    mockUser = USUARIO_INVITADO
  })

  afterEach(() => {
    cleanup()
  })

  describe("Carga y errores", () => {
    it("Debería pedir la liga con el leagueId de la URL y mostrar un estado de carga mientras responde", () => {
      httpService.get.mockReturnValue(new Promise(() => {}))
      renderPage("42")

      expect(screen.getByText("Cargando liga...")).toBeTruthy()
      expect(httpService.get).toHaveBeenCalledWith("/leagues/42")
    })

    it.each([
      {
        caso: "el servidor responde 404",
        error: new ApiError(404, "LEAGUE_NOT_FOUND", "No existe la liga con el ID especificado."),
        mensaje: "La liga no existe.",
      },
      {
        caso: "el servidor responde con otro ApiError",
        error: new ApiError(500, "INTERNAL_ERROR", "Ocurrió un error en el servidor."),
        mensaje: "Ocurrió un error en el servidor.",
      },
      {
        caso: "falla por un problema de conexión",
        error: new TypeError("Failed to fetch"),
        mensaje: "No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo.",
      },
    ])("Debería mostrar '$mensaje' y un link para volver al inicio cuando $caso", async ({ error, mensaje }) => {
      httpService.get.mockRejectedValue(error)
      renderPage()

      const alerta = await screen.findByRole("alert")
      expect(alerta.textContent).toBe(mensaje)
      expect(screen.getByRole("link", { name: "Volver al inicio" })).toBeTruthy()
    })
  })

  describe("Sala de espera", () => {
    it("Debería mostrar el nombre, la duración, el cupo, el estado traducido y los equipos inscriptos", async () => {
      await abrirLobby()

      expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Liga FAMAF Apertura")
      expect(screen.getByText("5 min")).toBeTruthy()
      expect(screen.getByText("2 / 8")).toBeTruthy()
      expect(screen.getByText("Esperando equipos")).toBeTruthy()
      expect(screen.queryByText("PENDING")).toBeNull()
      expect(screen.getByText("alfajoresFC")).toBeTruthy()
      expect(screen.getByText("BocaJuniors")).toBeTruthy()
    })

    it("Debería marcar al anfitrión y distinguir visualmente el equipo del usuario", async () => {
      await abrirLobby()

      const filaAnfitrion = screen.getByText("alfajoresFC").closest("li")
      const filaPropia = screen.getByText("BocaJuniors").closest("li")

      expect(filaAnfitrion.textContent).toContain("Anfitrión")
      expect(filaAnfitrion.className).not.toContain("league-lobby__team--own")
      expect(filaPropia.textContent).toContain("Tu equipo")
      expect(filaPropia.className).toContain("league-lobby__team--own")
    })
  })

  describe("Acceso solo para los participantes", () => {
    it.each([
      { caso: "el usuario no está inscripto en la liga", user: { team_id: 99 } },
      { caso: "no hay datos de usuario en la sesión", user: null },
    ])("Debería redirigir a la lista de ligas si la liga es privada y $caso", async ({ user }) => {
      mockUser = user
      httpService.get.mockResolvedValue(armarLiga([EQUIPO_ANFITRION, EQUIPO_INVITADO], true))
      renderPage()

      expect(await screen.findByText("Lista de Ligas")).toBeTruthy()
      expect(screen.queryByText("Liga FAMAF Apertura")).toBeNull()
    })

    it("Debería redirigir a la lista de ligas si el servidor responde 403", async () => {
      httpService.get.mockRejectedValue(
        new ApiError(403, "FORBIDDEN", "No tienes permisos para ver esta liga")
      )
      renderPage()

      expect(await screen.findByText("Lista de Ligas")).toBeTruthy()
    })
  })

  describe("Actualización en vivo", () => {
    it("Debería mostrar al nuevo equipo y actualizar el cupo cuando alguien se une", async () => {
      httpService.get
        .mockResolvedValueOnce(armarLiga([EQUIPO_ANFITRION, EQUIPO_INVITADO]))
        .mockResolvedValueOnce(armarLiga([EQUIPO_ANFITRION, EQUIPO_INVITADO, EQUIPO_NUEVO]))
      await abrirLobby()

      await emitirEvento("TEAM_JOINED_LEAGUE", { league_id: 3 })

      expect(screen.getByText("RiverPlate")).toBeTruthy()
      expect(screen.getByText("3 / 8")).toBeTruthy()
      expect(httpService.get).toHaveBeenCalledTimes(2)
    })

    it("Debería quitar al equipo que abandona y actualizar el cupo", async () => {
      httpService.get
        .mockResolvedValueOnce(armarLiga([EQUIPO_ANFITRION, EQUIPO_INVITADO, EQUIPO_NUEVO]))
        .mockResolvedValueOnce(armarLiga([EQUIPO_ANFITRION, EQUIPO_INVITADO]))
      await abrirLobby()
      expect(screen.getByText("RiverPlate")).toBeTruthy()

      await emitirEvento("LEAVE_LOBBY_LEAGUE", { league_id: 3 })

      expect(screen.queryByText("RiverPlate")).toBeNull()
      expect(screen.getByText("2 / 8")).toBeTruthy()
    })

    it("Debería mostrar la liga en curso cuando llega LEAGUE_INITIATED de esta liga", async () => {
      httpService.get
        .mockResolvedValueOnce(armarLiga([EQUIPO_ANFITRION, EQUIPO_INVITADO]))
        .mockResolvedValueOnce(ligaIniciada(armarLiga([EQUIPO_ANFITRION, EQUIPO_INVITADO])))
      await abrirLobby()
      expect(screen.getByText("Esperando equipos")).toBeTruthy()

      await emitirEvento("LEAGUE_INITIATED", {
        league_id: 3,
        league_name: "Liga FAMAF Apertura",
        max_teams: 8,
        status: "IN_PROGRESS",
      })

      expect(screen.getByText("En curso")).toBeTruthy()
      expect(screen.queryByText("Esperando equipos")).toBeNull()
      expect(httpService.get).toHaveBeenCalledTimes(2)
    })

    it("Debería ignorar los eventos de otras ligas", async () => {
      await abrirLobby()

      await emitirEvento("TEAM_JOINED_LEAGUE", { league_id: 999 })
      await emitirEvento("LEAVE_LOBBY_LEAGUE", undefined)
      await emitirEvento("LEAGUE_INITIATED", { league_id: 999 })

      // Solo la carga inicial: no hubo ningún refetch
      expect(httpService.get).toHaveBeenCalledTimes(1)
    })

    it("Debería conservar la lista anterior, sin mostrar error, si falla el refetch", async () => {
      httpService.get
        .mockResolvedValueOnce(armarLiga([EQUIPO_ANFITRION, EQUIPO_INVITADO]))
        .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      await abrirLobby()

      await emitirEvento("TEAM_JOINED_LEAGUE", { league_id: 3 })

      expect(httpService.get).toHaveBeenCalledTimes(2)
      expect(screen.getByText("BocaJuniors")).toBeTruthy()
      expect(screen.queryByRole("alert")).toBeNull()
    })
  })

  describe("Abandonar liga", () => {
    it("Debería no llamar al servidor si el usuario cancela la confirmación", async () => {
      await abrirLobby()

      fireEvent.click(screen.getByRole("button", { name: "Abandonar liga" }))
      fireEvent.click(screen.getByRole("button", { name: "Cancelar" }))

      expect(httpService.delete).not.toHaveBeenCalled()
      expect(screen.getByRole("button", { name: "Abandonar liga" })).toBeTruthy()
    })

    it("Debería llamar al DELETE con el team_id del usuario y volver a la lista de ligas al confirmar", async () => {
      httpService.delete.mockResolvedValue(null)
      await abrirLobby()

      abandonarLiga()

      expect(await screen.findByText("Lista de Ligas")).toBeTruthy()
      expect(httpService.delete).toHaveBeenCalledWith("/leagues/3/teams/8")
    })

    it("Debería mostrar el mensaje recibido y seguir en el lobby si falla el abandono", async () => {
      await abrirLobby()
      httpService.delete.mockRejectedValue(
        new ApiError(400, "LEAGUE_STARTED", "No se puede abandonar una liga que ya ha comenzado.")
      )

      abandonarLiga()

      const alerta = await screen.findByRole("alert")
      expect(alerta.textContent).toBe("No se puede abandonar una liga que ya ha comenzado.")
      expect(screen.getByText("Liga FAMAF Apertura")).toBeTruthy()
      expect(screen.queryByText("Lista de Ligas")).toBeNull()
    })

    it("Debería deshabilitar el botón mientras el abandono está pendiente", async () => {
      await abrirLobby()
      httpService.delete.mockReturnValue(new Promise(() => {}))

      abandonarLiga()

      const boton = await screen.findByRole("button", { name: "Saliendo..." })
      expect(boton.disabled).toBe(true)
    })

    it.each([
      { caso: "es el anfitrión", user: USUARIO_ANFITRION },
      { caso: "no participa y la liga es pública", user: { team_id: 99 } },
    ])("Debería no mostrar 'Abandonar liga' si $caso", async ({ user }) => {
      mockUser = user
      await abrirLobby()

      expect(screen.queryByRole("button", { name: "Abandonar liga" })).toBeNull()
    })
  })

  describe("Iniciar liga", () => {
    it.each([
      { caso: "es el anfitrión y la liga está pendiente", user: USUARIO_ANFITRION, status: "PENDING", accion: "mostrar", visible: true },
      { caso: "no es el anfitrión", user: { team_id: 2 }, status: "PENDING", accion: "ocultar", visible: false },
      { caso: "la liga ya está en curso", user: USUARIO_ANFITRION, status: "IN_PROGRESS", accion: "ocultar", visible: false },
    ])("Debería $accion el botón 'Iniciar liga' si $caso", async ({ user, status, visible }) => {
      mockUser = user
      httpService.get.mockResolvedValue({ ...armarLiga(armarEquipos(6)), status })
      renderPage()
      await screen.findByText("Liga FAMAF Apertura")

      const boton = screen.queryByRole("button", { name: "Iniciar liga" })
      expect(boton !== null).toBe(visible)
    })

    it.each([
      { equipos: 2, estado: "deshabilitado", deshabilitado: true },
      { equipos: 3, estado: "deshabilitado", deshabilitado: true },
      { equipos: 4, estado: "habilitado", deshabilitado: false },
      { equipos: 5, estado: "deshabilitado", deshabilitado: true },
      { equipos: 6, estado: "habilitado", deshabilitado: false },
    ])("Debería dejar $estado el botón 'Iniciar liga' con $equipos equipos", async ({ equipos, deshabilitado }) => {
      await abrirComoAnfitrion(equipos)

      const boton = screen.getByRole("button", { name: "Iniciar liga" })
      expect(boton.disabled).toBe(deshabilitado)
    })

    it("Debería enviar el PUT con status IN_PROGRESS y mostrar la liga en curso cuando el servidor responde 200", async () => {
      httpService.get
        .mockResolvedValueOnce(armarLiga(armarEquipos(4)))
        .mockResolvedValueOnce(ligaIniciada(armarLiga(armarEquipos(4))))
      httpService.put.mockResolvedValue({
        league_id: 3,
        league_name: "Liga FAMAF Apertura",
        status: "IN_PROGRESS",
      })
      await abrirComoAnfitrion(4)

      fireEvent.click(screen.getByRole("button", { name: "Iniciar liga" }))

      expect(await screen.findByText("En curso")).toBeTruthy()
      expect(httpService.put).toHaveBeenCalledWith("/leagues/3", { status: "IN_PROGRESS" })
      expect(screen.queryByRole("button", { name: "Iniciar liga" })).toBeNull()
    })

    it("Debería deshabilitar el botón y no enviar un segundo PUT mientras la solicitud está en curso", async () => {
      httpService.put.mockReturnValue(new Promise(() => {}))
      await abrirComoAnfitrion(4)

      fireEvent.click(screen.getByRole("button", { name: "Iniciar liga" }))

      const boton = await screen.findByRole("button", { name: "Iniciando..." })
      expect(boton.disabled).toBe(true)

      fireEvent.click(boton)
      expect(httpService.put).toHaveBeenCalledTimes(1)
    })

    it.each([
      {
        caso: "no hay equipos suficientes",
        error: new ApiError(400, "INSUFFICIENT_TEAMS", "La liga no contiene el mínimo de equipos"),
        mensaje: "La liga no contiene el mínimo de equipos",
      },
      {
        caso: "la liga no existe",
        error: new ApiError(404, "LEAGUE_NOT_FOUND", "La liga seleccionada no existe"),
        mensaje: "La liga seleccionada no existe",
      },
      {
        caso: "falla por un problema de conexión",
        error: new TypeError("Failed to fetch"),
        mensaje: "No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo.",
      },
    ])("Debería mostrar '$mensaje' y seguir en el lobby cuando $caso", async ({ error, mensaje }) => {
      httpService.put.mockRejectedValue(error)
      await abrirComoAnfitrion(4)

      fireEvent.click(screen.getByRole("button", { name: "Iniciar liga" }))

      const alerta = await screen.findByRole("alert")
      expect(alerta.textContent).toBe(mensaje)
      expect(screen.getByText("Liga FAMAF Apertura")).toBeTruthy()
      // La pantalla sigue funcionando: el botón vuelve a estar disponible y no hubo refetch
      expect(screen.getByRole("button", { name: "Iniciar liga" }).disabled).toBe(false)
      expect(httpService.get).toHaveBeenCalledTimes(1)
    })

    it("Debería mostrar el mensaje y actualizar la vista al estado real si el servidor responde LEAGUE_ALREADY_STARTED", async () => {
      httpService.get
        .mockResolvedValueOnce(armarLiga(armarEquipos(4)))
        .mockResolvedValueOnce(ligaIniciada(armarLiga(armarEquipos(4))))
      httpService.put.mockRejectedValue(
        new ApiError(409, "LEAGUE_ALREADY_STARTED", "La liga ya está iniciada")
      )
      await abrirComoAnfitrion(4)

      fireEvent.click(screen.getByRole("button", { name: "Iniciar liga" }))

      const alerta = await screen.findByRole("alert")
      expect(alerta.textContent).toBe("La liga ya está iniciada")
      expect(await screen.findByText("En curso")).toBeTruthy()
      expect(httpService.get).toHaveBeenCalledTimes(2)
    })
  })
})