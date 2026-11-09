// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, waitFor, act, fireEvent } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"

vi.mock("../../services/createhttpService", async (importOriginal) => {
  const original = await importOriginal()
  return { ...original, httpService: { get: vi.fn(), post: vi.fn() } }
})

let mockUser = null
vi.mock("../../hooks/useSession", () => ({
  useSession: () => ({ user: mockUser }),
}))

// Canal global falso: guarda los listeners para poder emitir eventos desde los tests
const mockListeners = new Map()

vi.mock("../../services/globalSocket", () => ({
  subscribe: vi.fn((eventName, listener) => {
    if (!mockListeners.has(eventName)) mockListeners.set(eventName, new Set())
    mockListeners.get(eventName).add(listener)
    return () => mockListeners.get(eventName)?.delete(listener)
  }),
}))

import { httpService, ApiError } from "../../services/createhttpService.js"
import { subscribe } from "../../services/globalSocket"
import FriendlyLobby from "./FriendlyLobby.jsx"

const MATCH_SIN_RIVAL = {
  match_id: 5,
  status: "PENDING",
  match_duration: 5,
  team_host: { team_id: 1, team_name: "alfajoresFC", team_logo: "logo-host" },
  team_away: null,
}

const MATCH_CON_RIVAL = {
  ...MATCH_SIN_RIVAL,
  status: "IN_PROGRESS",
  team_away: { team_id: 2, team_name: "BocaJuniors", team_logo: "logo-away" },
}

// ---------- Helpers ----------

function renderPage(matchId = "5") {
  return render(
    <MemoryRouter initialEntries={[`/friendlies/${matchId}`]}>
      <Routes>
        <Route path="/friendlies/:matchId" element={<FriendlyLobby />} />
        <Route path="/matches/:matchId" element={<h1>Pantalla del partido</h1>} />
        <Route path="/" element={<h1>Pantalla principal</h1>} />
      </Routes>
    </MemoryRouter>
  )
}

function emitirEvento(event, data) {
  act(() => {
    mockListeners.get(event)?.forEach((listener) => listener(data))
  })
}

function cantidadDeListeners() {
  return [...mockListeners.values()].reduce((total, listeners) => total + listeners.size, 0)
}

// Renderiza el lobby ya cargado
async function abrirLobby() {
  httpService.get.mockResolvedValue(MATCH_SIN_RIVAL)
  const resultado = renderPage("5")
  await screen.findByText("alfajoresFC")
  return resultado
}

// ---------- Tests ----------

describe("FriendlyLobby", () => {
  beforeEach(() => {
    httpService.get.mockReset()
    httpService.post.mockReset()
    subscribe.mockClear()
    mockListeners.clear()
    mockUser = { user_id: 1, team_id: 1, username: "Maradona10", email: "diego@famaf.unc.edu.ar" }
  })

  afterEach(() => {
    cleanup()
  })

  describe("Carga y conexión", () => {
    it("Debería mostrar un estado de carga mientras se obtiene el partido", () => {
      httpService.get.mockReturnValue(new Promise(() => {}))
      renderPage()

      expect(screen.getByText("Cargando partido...")).toBeTruthy()
    })

    it("Debería pedir el detalle con el matchId de la URL", async () => {
      httpService.get.mockResolvedValue(MATCH_SIN_RIVAL)
      renderPage("42")

      await waitFor(() => {
        expect(httpService.get).toHaveBeenCalledWith("/friendly/42")
      })
    })

    it("Debería suscribirse a MATCH_STARTED en el canal global, sin abrir una conexión propia", async () => {
      await abrirLobby()

      expect(subscribe).toHaveBeenCalledWith("MATCH_STARTED", expect.any(Function))
      expect(httpService.post).not.toHaveBeenCalled()
    })

    it("Debería dejar de escuchar eventos al salir de la pantalla", async () => {
      const { unmount } = await abrirLobby()
      expect(cantidadDeListeners()).toBe(1)

      unmount()

      expect(cantidadDeListeners()).toBe(0)
    })
  })

  describe("Error", () => {
    it("Debería mostrar el mensaje del backend y un link para volver al inicio cuando falla con un ApiError", async () => {
      httpService.get.mockRejectedValue(
        new ApiError(404, "MATCH_NOT_FOUND", "El partido solicitado no existe.")
      )
      renderPage()

      const alerta = await screen.findByRole("alert")
      expect(alerta.textContent).toBe("El partido solicitado no existe.")
      expect(screen.getByRole("link", { name: "Volver al inicio" })).toBeTruthy()
    })

    it("Debería mostrar un mensaje genérico cuando falla por un problema de conexión", async () => {
      httpService.get.mockRejectedValue(new TypeError("Failed to fetch"))
      renderPage()

      const alerta = await screen.findByRole("alert")
      expect(alerta.textContent).toBe(
        "No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo."
      )
    })
  })

  describe("Sala de espera", () => {
    it("Debería mostrar el título con el número del amistoso y el equipo anfitrión", async () => {
      await abrirLobby()

      expect(screen.getByText("Anfitrión")).toBeTruthy()
      expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
        "Sala de espera del amistoso #5"
      )
    })

    it("Debería mostrar el estado del partido traducido", async () => {
      await abrirLobby()

      expect(screen.getByText("Esperando rival")).toBeTruthy()
      expect(screen.queryByText("PENDING")).toBeNull()
    })

    const { team_away, ...SIN_CAMPO_TEAM_AWAY } = MATCH_SIN_RIVAL
    it.each([
      { caso: "es null", match: MATCH_SIN_RIVAL },
      { caso: "no viene en la respuesta", match: SIN_CAMPO_TEAM_AWAY },
    ])("Debería mostrar que se espera un rival cuando team_away $caso", async ({ match }) => {
      httpService.get.mockResolvedValue(match)
      renderPage()

      expect(await screen.findByText("Esperando a que se una un rival...")).toBeTruthy()
    })

    it("Debería no mostrar ningún botón, porque el anfitrión solo espera", async () => {
      await abrirLobby()

      expect(screen.queryAllByRole("button")).toHaveLength(0)
    })
  })

  describe("Volver al inicio", () => {
    it("Debería volver a la pantalla principal al hacer clic en el link de la sala de espera", async () => {
      await abrirLobby()

      fireEvent.click(screen.getByRole("link", { name: "Volver al Inicio" }))

      expect(screen.getByText("Pantalla principal")).toBeTruthy()
    })

    it("Debería mostrar el link también cuando ya hay un rival esperando", async () => {
      httpService.get.mockResolvedValue({
        ...MATCH_SIN_RIVAL,
        team_away: MATCH_CON_RIVAL.team_away,
      })
      renderPage()

      await screen.findByText("BocaJuniors")

      expect(screen.getByRole("link", { name: "Volver al Inicio" })).toBeTruthy()
    })
  })

  describe("Acceso solo para el anfitrión", () => {
    it.each([
      { caso: "el usuario no es el anfitrión", user: { team_id: 2 } },
      { caso: "no hay datos de usuario en la sesión", user: null },
    ])("Debería redirigir a la pantalla principal si $caso", async ({ user }) => {
      mockUser = user
      httpService.get.mockResolvedValue(MATCH_SIN_RIVAL)
      renderPage()

      expect(await screen.findByText("Pantalla principal")).toBeTruthy()
      expect(screen.queryByText("alfajoresFC")).toBeNull()
    })
  })

  describe("Redirección al partido", () => {
    it("Debería redirigir al partido si el detalle ya viene en curso", async () => {
      httpService.get.mockResolvedValue(MATCH_CON_RIVAL)
      renderPage()

      expect(await screen.findByText("Pantalla del partido")).toBeTruthy()
    })

    it("Debería redirigir al partido cuando llega MATCH_STARTED para este amistoso", async () => {
      await abrirLobby()

      emitirEvento("MATCH_STARTED", { match_id: 5, status: "IN_PROGRESS" })

      expect(await screen.findByText("Pantalla del partido")).toBeTruthy()
    })

    it("Debería redirigir si MATCH_STARTED llega mientras todavía se está cargando el detalle", async () => {
      httpService.get.mockReturnValue(new Promise(() => {}))
      renderPage("5")

      emitirEvento("MATCH_STARTED", { match_id: 5, status: "IN_PROGRESS" })

      expect(await screen.findByText("Pantalla del partido")).toBeTruthy()
    })

    it("Debería ignorar MATCH_STARTED de otros partidos", async () => {
      await abrirLobby()

      emitirEvento("MATCH_STARTED", { match_id: 999, status: "IN_PROGRESS" })
      emitirEvento("MATCH_STARTED", undefined)

      expect(screen.getByText("alfajoresFC")).toBeTruthy()
      expect(screen.queryByText("Pantalla del partido")).toBeNull()
    })
  })
})