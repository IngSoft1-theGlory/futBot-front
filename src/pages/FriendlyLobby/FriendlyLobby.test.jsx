// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
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

// WebSocket falso: jsdom no trae uno real. Guarda cada instancia creada
// para que el test pueda disparar mensajes a mano, como si vinieran del servidor.
class FakeWebSocket {
  static instances = []

  constructor(url) {
    this.url = url
    this.onmessage = null
    FakeWebSocket.instances.push(this)
  }

  close() {}
}

const MATCH_SIN_RIVAL = {
  match_id: 5,
  status: "PENDING",
  match_duration: 10,
  team_host: { team_id: 1, team_name: "alfajoresFC", team_logo: "logo-host" },
  team_away: null,
}

const MATCH_CON_RIVAL = {
  ...MATCH_SIN_RIVAL,
  status: "IN_PROGRESS",
  team_away: { team_id: 2, team_name: "BocaJuniors", team_logo: "logo-away" },
}

function renderPage(matchId = "5") {
  render(
    <MemoryRouter initialEntries={[`/friendlies/${matchId}`]}>
      <Routes>
        <Route path="/friendlies/:matchId" element={<FriendlyLobby />} />
        <Route path="/matches/:matchId" element={<h1>Pantalla del partido</h1>} />
        <Route path="/friendlies" element={<h1>Pantalla de amistosos</h1>} />
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
  socket.onmessage({ data: JSON.stringify({ event, data }) })
}

describe("FriendlyLobby", () => {
  beforeEach(() => {
    httpService.get.mockReset()
    httpService.post.mockReset()
    httpService.post.mockResolvedValue({ websocket_url: "ws://test/global", expires_in_seconds: 60 })
    mockUser = { user_id: 1, team_id: 1, username: "Maradona10", email: "diego@famaf.unc.edu.ar" }
    FakeWebSocket.instances = []
    vi.stubGlobal("WebSocket", FakeWebSocket)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  describe("Carga", () => {
    it("Debiera mostrar un estado de carga mientras se obtiene el partido", () => {
      httpService.get.mockReturnValue(new Promise(() => {}))
      renderPage()

      expect(screen.getByText("Cargando partido...")).toBeTruthy()
    })

    it("Debiera pedir el detalle del partido usando el matchId de la URL", () => {
      httpService.get.mockReturnValue(new Promise(() => {}))
      renderPage("42")

      expect(httpService.get).toHaveBeenCalledWith("/friendlies/42")
    })
  })

  describe("Error", () => {
    it("Debiera mostrar el mensaje del backend cuando falla con un ApiError", async () => {
      httpService.get.mockRejectedValue(
        new ApiError(404, "MATCH_NOT_FOUND", "El partido solicitado no existe.")
      )
      renderPage()

      const alerta = await screen.findByRole("alert")
      expect(alerta.textContent).toBe("El partido solicitado no existe.")
    })

    it("Debiera mostrar un mensaje genérico cuando falla por un problema de conexión", async () => {
      httpService.get.mockRejectedValue(new TypeError("Failed to fetch"))
      renderPage()

      const alerta = await screen.findByRole("alert")
      expect(alerta.textContent).toBe(
        "No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo."
      )
    })

    it("Debiera ofrecer un link para volver al inicio cuando hay error", async () => {
      httpService.get.mockRejectedValue(new ApiError(404, "MATCH_NOT_FOUND", "No existe."))
      renderPage()

      await screen.findByRole("alert")
      expect(screen.getByRole("link", { name: "Volver al inicio" })).toBeTruthy()
    })
  })

  describe("Éxito", () => {
    it("Debiera mostrar el equipo anfitrión y marcarlo como propio cuando el usuario es el anfitrión", async () => {
      httpService.get.mockResolvedValue(MATCH_SIN_RIVAL)
      renderPage()

      expect(await screen.findByText("alfajoresFC")).toBeTruthy()
      expect(screen.getByText("(vos)")).toBeTruthy()
    })

    it("Debiera mostrar que se espera un rival cuando todavía no se unió nadie", async () => {
      httpService.get.mockResolvedValue(MATCH_SIN_RIVAL)
      renderPage()

      expect(await screen.findByText("Esperando a que se una un rival...")).toBeTruthy()
    })

    it("Debiera mostrar al equipo visitante cuando ya se unió", async () => {
      httpService.get.mockResolvedValue(MATCH_CON_RIVAL)
      renderPage()

      expect(await screen.findByText("BocaJuniors")).toBeTruthy()
    })

    it("Debiera marcar como propio al visitante cuando el usuario es el equipo visitante, no el anfitrión", async () => {
      mockUser = { ...mockUser, team_id: 2 }
      httpService.get.mockResolvedValue(MATCH_CON_RIVAL)
      renderPage()

      await screen.findByText("BocaJuniors")
      expect(screen.getAllByText("(vos)")).toHaveLength(1)
      expect(screen.getByText("BocaJuniors").parentElement.textContent).toContain("(vos)")
    })

    it("Debiera mostrar el estado real del partido", async () => {
      httpService.get.mockResolvedValue(MATCH_CON_RIVAL)
      renderPage()

      expect(await screen.findByText("IN_PROGRESS")).toBeTruthy()
    })

    it("Debiera no mostrar ninguna acción de cancelar o abandonar el partido", async () => {
      httpService.get.mockResolvedValue(MATCH_SIN_RIVAL)
      renderPage()

      await screen.findByText("alfajoresFC")
      expect(screen.queryByRole("button", { name: /cancelar/i })).toBeNull()
      expect(screen.queryByRole("button", { name: /abandonar/i })).toBeNull()
    })

    it("Debiera no romper si todavía no hay datos de usuario en la sesión", async () => {
      mockUser = null
      httpService.get.mockResolvedValue(MATCH_SIN_RIVAL)
      renderPage()

      expect(await screen.findByText("alfajoresFC")).toBeTruthy()
      expect(screen.queryByText("(vos)")).toBeNull()
    })

    it("Debiera navegar a la lista de amistosos al presionar Cerrar", async () => {
      httpService.get.mockResolvedValue(MATCH_SIN_RIVAL)
      const user = userEvent.setup()
      renderPage()

      await screen.findByText("alfajoresFC")
      await user.click(screen.getByRole("button", { name: "Cerrar" }))

      expect(await screen.findByText("Pantalla de amistosos")).toBeTruthy()
    })
  })

  describe("WebSocket", () => {
    it("Debiera redirigir al partido cuando llega MATCH_STARTED para este amistoso", async () => {
      httpService.get.mockResolvedValue(MATCH_SIN_RIVAL)
      renderPage("5")

      await screen.findByText("alfajoresFC")
      const socket = await esperarConexionWS()

      emitirEvento(socket, "MATCH_STARTED", {
        match_id: 5,
        team_host_id: 1,
        team_away_id: 2,
        status: "IN_PROGRESS",
      })

      expect(await screen.findByText("Pantalla del partido")).toBeTruthy()
    })

    it("Debiera ignorar un MATCH_STARTED que corresponde a otro partido", async () => {
      httpService.get.mockResolvedValue(MATCH_SIN_RIVAL)
      renderPage("5")

      await screen.findByText("alfajoresFC")
      const socket = await esperarConexionWS()

      emitirEvento(socket, "MATCH_STARTED", {
        match_id: 999,
        team_host_id: 1,
        team_away_id: 2,
        status: "IN_PROGRESS",
      })

      expect(screen.getByText("alfajoresFC")).toBeTruthy()
      expect(screen.queryByText("Pantalla del partido")).toBeNull()
    })

    it("Debiera volver a la lista de amistosos cuando llega FRIENDLY_CANCELLED", async () => {
      httpService.get.mockResolvedValue(MATCH_SIN_RIVAL)
      renderPage("5")

      await screen.findByText("alfajoresFC")
      const socket = await esperarConexionWS()

      emitirEvento(socket, "FRIENDLY_CANCELLED", { match_id: 5 })

      expect(await screen.findByText("Pantalla de amistosos")).toBeTruthy()
    })

    it("Debiera no romper la pantalla si falla la obtención del token de WebSocket", async () => {
      httpService.get.mockResolvedValue(MATCH_SIN_RIVAL)
      httpService.post.mockRejectedValue(new Error("network down"))
      renderPage("5")

      expect(await screen.findByText("alfajoresFC")).toBeTruthy()
      expect(FakeWebSocket.instances).toHaveLength(0)
    })
  })
})