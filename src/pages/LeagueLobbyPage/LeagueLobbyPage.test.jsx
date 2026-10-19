// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, act, fireEvent, within } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"

vi.mock("../../services/createhttpService", async (importOriginal) => {
  const original = await importOriginal()
  return { ...original, httpService: { get: vi.fn(), delete: vi.fn() } }
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

// Un partido del fixture, con el formato que manda el backend
function armarPartido(matchId) {
  return {
    match_id: matchId,
    round_number: 1,
    status: "PENDING",
    team_host: EQUIPO_ANFITRION,
    team_away: EQUIPO_INVITADO,
    score: { home: 0, away: 0 },
  }
}

// Una fila de la tabla de posiciones, con el formato que manda el backend
function armarPosicion(position, team, points) {
  return {
    position,
    team_id: team.team_id,
    team_name: team.team_name,
    matches_played: 1,
    wins: points === 3 ? 1 : 0,
    draws: 0,
    losses: points === 3 ? 0 : 1,
    goals_for: points === 3 ? 2 : 0,
    goals_against: points === 3 ? 0 : 2,
    goal_diff: points === 3 ? 2 : -2,
    points,
  }
}

// Liga ya iniciada: además de los datos del lobby trae la tabla (ranking) y los partidos (fixture).
// cambios: campos a reemplazar, por ejemplo { status: "FINISHED" }
function armarLigaEnCurso(cambios = {}) {
  return {
    ...armarLiga([EQUIPO_ANFITRION, EQUIPO_INVITADO]),
    status: "IN_PROGRESS",
    ranking: [armarPosicion(1, EQUIPO_INVITADO, 3), armarPosicion(2, EQUIPO_ANFITRION, 0)],
    fixture: [armarPartido(21), armarPartido(22)],
    ...cambios,
  }
}

// ---------- Helpers ----------

function renderPage(leagueId = "3") {
  return render(
    <MemoryRouter initialEntries={[`/leagues/${leagueId}`]}>
      <Routes>
        <Route path="/leagues/:leagueId" element={<LeagueLobbyPage />} />
        <Route path="/leagues/:leagueId/lineup" element={<h1>Editar alineación de la liga</h1>} />
        <Route path="/" element={<h1>Pantalla principal</h1>} />
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

// Renderiza el lobby ya cargado
async function abrirLobby() {
  httpService.get.mockResolvedValue(armarLiga([EQUIPO_ANFITRION, EQUIPO_INVITADO]))
  const resultado = renderPage("3")
  await screen.findByText("Liga FAMAF Apertura")
  return resultado
}

// Renderiza el lobby de una liga en curso ya cargada.
// Si el test preparó respuestas con mockResolvedValueOnce, se usan esas primero.
async function abrirLigaEnCurso() {
  httpService.get.mockResolvedValue(armarLigaEnCurso())
  const resultado = renderPage("3")
  await screen.findByText("En curso")
  return resultado
}

// ---------- Tests ----------

describe("LeagueLobbyPage", () => {
  beforeEach(() => {
    httpService.get.mockReset()
    httpService.delete.mockReset()
    mockListeners.clear()
    mockUser = USUARIO_INVITADO
    vi.spyOn(window, "confirm").mockReturnValue(true)
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

    it("Debería no mostrar ningún botón al anfitrión, porque no puede abandonar", async () => {
      mockUser = USUARIO_ANFITRION
      await abrirLobby()

      expect(screen.queryAllByRole("button")).toHaveLength(0)
    })
  })

  describe("Acceso solo para los participantes", () => {
    it.each([
      { caso: "el usuario no está inscripto en la liga", user: { team_id: 99 } },
      { caso: "no hay datos de usuario en la sesión", user: null },
    ])("Debería redirigir a la pantalla principal si la liga es privada y $caso", async ({ user }) => {
      mockUser = user
      httpService.get.mockResolvedValue(armarLiga([EQUIPO_ANFITRION, EQUIPO_INVITADO], true))
      renderPage()

      expect(await screen.findByText("Pantalla principal")).toBeTruthy()
      expect(screen.queryByText("Liga FAMAF Apertura")).toBeNull()
    })

    it("Debería redirigir a la pantalla principal si el servidor responde 403", async () => {
      httpService.get.mockRejectedValue(
       new ApiError(403, "FORBIDDEN", "No tienes permisos para ver esta liga")
      )
      renderPage()

      expect(await screen.findByText("Pantalla principal")).toBeTruthy()
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

    it("Debería ignorar los eventos de otras ligas", async () => {
      await abrirLobby()

      await emitirEvento("TEAM_JOINED_LEAGUE", { league_id: 999 })
      await emitirEvento("LEAVE_LOBBY_LEAGUE", undefined)

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

  describe("Pantalla de la liga en curso", () => {
    it("Debería mostrar la tabla de posiciones, el fixture y el botón para editar la alineación", async () => {
      await abrirLigaEnCurso()

      expect(screen.getByRole("heading", { name: "Tabla de posiciones" })).toBeTruthy()
      const tabla = screen.getByRole("table")
      expect(within(tabla).getByText("BocaJuniors")).toBeTruthy()
      expect(within(tabla).getByText("+2")).toBeTruthy()

      expect(screen.getByRole("heading", { name: "Fixture" })).toBeTruthy()
      expect(screen.getByText("Fecha 1")).toBeTruthy()

      expect(screen.getByRole("button", { name: "Editar alineación" })).toBeTruthy()
    })

    it("Debería llevar a la edición de la alineación al presionar el botón", async () => {
      await abrirLigaEnCurso()

      fireEvent.click(screen.getByRole("button", { name: "Editar alineación" }))

      expect(screen.getByText("Editar alineación de la liga")).toBeTruthy()
    })

    it("Debería seguir mostrando la sala de espera, sin tabla ni fixture, si la liga está en PENDING", async () => {
      await abrirLobby()

      expect(screen.getByText("Esperando equipos")).toBeTruthy()
      expect(screen.getByRole("button", { name: "Abandonar liga" })).toBeTruthy()
      expect(screen.queryByRole("heading", { name: "Tabla de posiciones" })).toBeNull()
      expect(screen.queryByRole("heading", { name: "Fixture" })).toBeNull()
    })

    it("Debería no permitir abandonar la liga una vez iniciada", async () => {
      await abrirLigaEnCurso()

      expect(screen.queryByRole("button", { name: "Abandonar liga" })).toBeNull()
    })
  })

  describe("Liga en curso", () => {
    it("Debería volver a pedir la liga cuando empieza un partido de su fixture", async () => {
      await abrirLigaEnCurso()

      await emitirEvento("MATCH_STARTED", { match_id: 21 })

      expect(httpService.get).toHaveBeenCalledTimes(2)
      expect(httpService.get).toHaveBeenLastCalledWith("/leagues/3")
    })

    it("Debería ignorar MATCH_STARTED de partidos que no están en el fixture, como un amistoso", async () => {
      await abrirLigaEnCurso()

      await emitirEvento("MATCH_STARTED", { match_id: 999 })

      expect(httpService.get).toHaveBeenCalledTimes(1)
    })

    it("Debería buscar el partido en el último fixture que se cargó", async () => {
      httpService.get
        .mockResolvedValueOnce(armarLigaEnCurso())
        .mockResolvedValueOnce(armarLigaEnCurso({ fixture: [armarPartido(21), armarPartido(23)] }))
      await abrirLigaEnCurso()

      await emitirEvento("LEAGUE_MATCH_FINISHED", { league_id: 3 })
      await emitirEvento("MATCH_STARTED", { match_id: 23 })

      expect(httpService.get).toHaveBeenCalledTimes(3)
    })

    it("Debería volver a pedir la liga cuando termina uno de sus partidos", async () => {
      await abrirLigaEnCurso()

      await emitirEvento("LEAGUE_MATCH_FINISHED", { league_id: 3 })

      expect(httpService.get).toHaveBeenCalledTimes(2)
    })

    it("Debería mostrar la liga como finalizada cuando termina", async () => {
      httpService.get
        .mockResolvedValueOnce(armarLigaEnCurso())
        .mockResolvedValueOnce(armarLigaEnCurso({ status: "FINISHED" }))
      await abrirLigaEnCurso()

      await emitirEvento("LEAGUE_FINISHED", { league_id: 3 })

      expect(screen.getByText("Finalizada")).toBeTruthy()
      expect(screen.queryByText("En curso")).toBeNull()
    })

    it("Debería ignorar los eventos de otras ligas", async () => {
      await abrirLigaEnCurso()

      await emitirEvento("LEAGUE_MATCH_FINISHED", { league_id: 999 })
      await emitirEvento("LEAGUE_FINISHED", { league_id: 999 })

      expect(httpService.get).toHaveBeenCalledTimes(1)
    })

    it("Debería conservar lo que estaba en pantalla, sin mostrar error, si falla el refetch", async () => {
      httpService.get
        .mockResolvedValueOnce(armarLigaEnCurso())
        .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      await abrirLigaEnCurso()

      await emitirEvento("LEAGUE_FINISHED", { league_id: 3 })

      expect(httpService.get).toHaveBeenCalledTimes(2)
      expect(screen.getByText("En curso")).toBeTruthy()
      expect(screen.queryByRole("alert")).toBeNull()
    })
  })

  describe("Abandonar liga", () => {
    it("Debería no llamar al servidor si el usuario cancela la confirmación", async () => {
      window.confirm.mockReturnValue(false)
      await abrirLobby()

      fireEvent.click(screen.getByRole("button", { name: "Abandonar liga" }))

      expect(httpService.delete).not.toHaveBeenCalled()
      expect(screen.getByRole("button", { name: "Abandonar liga" })).toBeTruthy()
    })

    it("Debería llamar al DELETE con el team_id del usuario y volver a la pantalla principal al confirmar", async () => {
      httpService.delete.mockResolvedValue(null)
      await abrirLobby()

      fireEvent.click(screen.getByRole("button", { name: "Abandonar liga" }))

      expect(await screen.findByText("Pantalla principal")).toBeTruthy()
      expect(httpService.delete).toHaveBeenCalledWith("/leagues/3/teams/8")
    })

    it("Debería mostrar el mensaje recibido y seguir en el lobby si falla el abandono", async () => {
      await abrirLobby()
      httpService.delete.mockRejectedValue(
        new ApiError(400, "LEAGUE_STARTED", "No se puede abandonar una liga que ya ha comenzado.")
      )

      fireEvent.click(screen.getByRole("button", { name: "Abandonar liga" }))

      const alerta = await screen.findByRole("alert")
      expect(alerta.textContent).toBe("No se puede abandonar una liga que ya ha comenzado.")
      expect(screen.getByText("Liga FAMAF Apertura")).toBeTruthy()
      expect(screen.queryByText("Pantalla principal")).toBeNull()
    })

    it("Debería deshabilitar el botón mientras el abandono está pendiente", async () => {
      await abrirLobby()
      httpService.delete.mockReturnValue(new Promise(() => {}))

      fireEvent.click(screen.getByRole("button", { name: "Abandonar liga" }))

      const boton = await screen.findByRole("button", { name: "Saliendo..." })
      expect(boton.disabled).toBe(true)
    })

    it("Debería mostrar la liga sin botón de abandonar a quien no participa si la liga es pública", async () => {
      mockUser = { team_id: 99 }
      await abrirLobby()

      expect(screen.queryByRole("button", { name: "Abandonar liga" })).toBeNull()
      expect(screen.queryByText("Pantalla principal")).toBeNull()
    })
  })
})