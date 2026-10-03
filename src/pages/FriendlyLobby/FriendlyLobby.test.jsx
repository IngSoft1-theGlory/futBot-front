// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, waitFor, act } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"

vi.mock("../../services/createhttpService", async (importOriginal) => {
  const original = await importOriginal()
  return { ...original, httpService: { get: vi.fn(), post: vi.fn() } }
})

let mockUser = null
vi.mock("../../hooks/useSession", () => ({
  useSession: () => ({ user: mockUser }),
}))

import { httpService, ApiError } from "../../services/createhttpService.js"
import FriendlyLobby from "./FriendlyLobby.jsx"

// WebSocket falso: jsdom no trae uno real. Con autoOpen = true simula un
// servidor que acepta la conexión enseguida (en un microtask, porque el
// componente asigna onopen justo después del new WebSocket()).
class FakeWebSocket {
  static instances = []
  static autoOpen = true

  constructor(url) {
    this.url = url
    this.onopen = null
    this.onmessage = null
    this.onerror = null
    this.onclose = null
    this.close = vi.fn()
    FakeWebSocket.instances.push(this)

    if (FakeWebSocket.autoOpen) {
      queueMicrotask(() => this.onopen?.())
    }
  }
}

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
    <MemoryRouter initialEntries={[`/friendly/${matchId}`]}>
      <Routes>
        <Route path="/friendly/:matchId" element={<FriendlyLobby />} />
        <Route path="/matches/:matchId" element={<h1>Pantalla del partido</h1>} />
        <Route path="/" element={<h1>Pantalla principal</h1>} />
      </Routes>
    </MemoryRouter>
  )
}

async function esperarConexionWS() {
  await waitFor(() => {
    expect(FakeWebSocket.instances.length).toBe(1)
  })
  return FakeWebSocket.instances[0]
}

function emitirEvento(socket, event, data) {
  act(() => socket.onmessage({ data: JSON.stringify({ event, data }) }))
}

// Renderiza el lobby ya cargado y devuelve el socket
async function abrirLobby() {
  httpService.get.mockResolvedValue(MATCH_SIN_RIVAL)
  renderPage("5")
  await screen.findByText("alfajoresFC")
  return esperarConexionWS()
}

// ---------- Tests ----------

describe("FriendlyLobby", () => {
  beforeEach(() => {
    httpService.get.mockReset()
    httpService.post.mockReset()
    httpService.post.mockResolvedValue({ websocket_url: "ws://test/global", expires_in_seconds: 60 })
    mockUser = { user_id: 1, team_id: 1, username: "Maradona10", email: "diego@famaf.unc.edu.ar" }
    FakeWebSocket.instances = []
    FakeWebSocket.autoOpen = true
    vi.stubGlobal("WebSocket", FakeWebSocket)
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  describe("Carga y conexión", () => {
    it("Debería mostrar un estado de carga mientras se obtiene el partido", () => {
      httpService.get.mockReturnValue(new Promise(() => {}))
      renderPage()

      expect(screen.getByText("Cargando partido...")).toBeTruthy()
    })

    it("Debería esperar a que el WebSocket abra antes de pedir el detalle con el matchId de la URL", async () => {
      FakeWebSocket.autoOpen = false
      httpService.get.mockResolvedValue(MATCH_SIN_RIVAL)
      renderPage("42")

      const socket = await esperarConexionWS()
      expect(httpService.post).toHaveBeenCalledWith("/live-token/global")
      expect(socket.url).toBe("ws://test/global")
      expect(httpService.get).not.toHaveBeenCalled()

      act(() => socket.onopen())

      await waitFor(() => {
        expect(httpService.get).toHaveBeenCalledWith("/friendly/42")
      })
    })

    it("Debería pedir el detalle igual si el WebSocket no abre en 5 segundos", async () => {
      vi.useFakeTimers()
      FakeWebSocket.autoOpen = false
      httpService.get.mockResolvedValue(MATCH_SIN_RIVAL)
      renderPage()

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(httpService.get).not.toHaveBeenCalled()

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000)
      })

      expect(httpService.get).toHaveBeenCalledWith("/friendly/5")
      expect(screen.getByText("alfajoresFC")).toBeTruthy()
      expect(screen.getByRole("alert").textContent).toMatch(/Sin conexión en vivo/)
    })

    it("Debería cerrar el WebSocket al salir de la pantalla", async () => {
      httpService.get.mockResolvedValue(MATCH_SIN_RIVAL)
      const { unmount } = renderPage()

      const socket = await esperarConexionWS()
      await screen.findByText("alfajoresFC")
      unmount()

      expect(socket.close).toHaveBeenCalled()
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
      httpService.get.mockResolvedValue(MATCH_SIN_RIVAL)
      renderPage()

      expect(await screen.findByText("alfajoresFC")).toBeTruthy()
      expect(screen.getByText("Anfitrión")).toBeTruthy()
      expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
        "Sala de espera del amistoso #5"
      )
    })

    it("Debería mostrar el estado del partido traducido", async () => {
      httpService.get.mockResolvedValue(MATCH_SIN_RIVAL)
      renderPage()

      await screen.findByText("alfajoresFC")
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
      httpService.get.mockResolvedValue(MATCH_SIN_RIVAL)
      renderPage()

      await screen.findByText("alfajoresFC")
      expect(screen.queryAllByRole("button")).toHaveLength(0)
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
      const socket = await abrirLobby()

      emitirEvento(socket, "MATCH_STARTED", { match_id: 5, status: "IN_PROGRESS" })

      expect(await screen.findByText("Pantalla del partido")).toBeTruthy()
    })

    it("Debería ignorar eventos de otros partidos, otros tipos de evento y mensajes que no son JSON", async () => {
      const socket = await abrirLobby()

      emitirEvento(socket, "MATCH_STARTED", { match_id: 999 })
      emitirEvento(socket, "GUEST_JOINED_FRIENDLY", { match_id: 5 })
      act(() => socket.onmessage({ data: "esto no es json" }))

      expect(screen.getByText("alfajoresFC")).toBeTruthy()
      expect(screen.queryByText("Pantalla del partido")).toBeNull()
    })
  })

  describe("Fallas de la conexión en vivo", () => {
    it("Debería mostrar la sala con un aviso si falla la obtención del token del WebSocket", async () => {
      httpService.get.mockResolvedValue(MATCH_SIN_RIVAL)
      httpService.post.mockRejectedValue(new Error("network down"))
      renderPage()

      expect(await screen.findByText("alfajoresFC")).toBeTruthy()
      expect(screen.getByRole("alert").textContent).toMatch(/Sin conexión en vivo/)
      expect(FakeWebSocket.instances).toHaveLength(0)
    })

    it.each(["onerror", "onclose"])(
      "Debería mostrar un aviso si el WebSocket dispara %s con la sala abierta",
      async (handler) => {
        const socket = await abrirLobby()
        expect(screen.queryByRole("alert")).toBeNull()

        act(() => socket[handler]())

        expect(screen.getByRole("alert").textContent).toMatch(/Sin conexión en vivo/)
      }
    )
  })
})