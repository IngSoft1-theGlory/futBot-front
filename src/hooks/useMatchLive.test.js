// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act, cleanup, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
/*
// ---------- Mocks ----------
Se reemplazan los pedidos HTTP y el canal global, la conexion en vivo usa el matchSockets.js real, pero con un WebSocket falso que el test maneja para simular los mensajes del servidor
*/
vi.mock("../services/matches", () => ({
  fetchMatchState: vi.fn(),
  fetchMatchTeams: vi.fn(),
  requestMatchWebsocketUrl: vi.fn(),
}))

vi.mock("./useGlobalEvent", () => ({ useGlobalEvent: vi.fn() }))

import { ApiError } from "../services/createhttpService"
import { fetchMatchState, fetchMatchTeams, requestMatchWebsocketUrl } from "../services/matches"
import { useMatchLive } from "./useMatchLive"

class FakeWebSocket {
  static lastInstance = null

  constructor(url) {
    this.url = url
    FakeWebSocket.lastInstance = this
  }

  close() {}

  // simula que el servidor manda un mensaje por el canal del partido
  receive(message) {
    this.onmessage?.({ data: JSON.stringify(message) })
  }
}

// ---------- Datos de Prueba ----------

const TEAMS = {
  home: { id: 1, name: "Instituto", logo: null },
  away: { id: 2, name: "InterdeMilan", logo: null },
}

const MATCH_IN_PROGRESS = {
  currentTick: 600,
  totalTicks: 1200,
  score: { home: 1, away: 0 },
  ball: { x: 52.5, y: 34 },
  players: [{ player_id: 101, team_id: 1, name: "Giuliano Cerato", position: { x: 50, y: 30 }, current_action: "IDLE" }],
  pause: null,
}

const PAUSE_STARTED = { event: "PAUSE_STARTED", type: "HT", duration_seconds: 30, current_tick: 600 }
const PAUSE_FINISHED = { event: "PAUSE_FINISHED", type: "HT" }

// Un tick que, si se aplicara, cambiaría el marcador, el reloj y la cancha
const NEXT_TICK = {
  event: "TICK_UPDATE",
  current_tick: 601,
  total_ticks: 1200,
  score: { home: 2, away: 0 },
  ball: { x: 80, y: 20 },
  players: [{ player_id: 101, team_id: 1, position: { x: 70, y: 25 }, current_action: "RUN" }],
}

// ---------- Helpers ----------

// Deja que terminen los pedidos pendientes (carga inicial y token del websocket)
async function flush() {
  await act(() => vi.advanceTimersByTimeAsync(0))
}

// Avanza el reloj falso la cantidad de segundos indicada
async function waitSeconds(seconds) {
  await act(() => vi.advanceTimersByTimeAsync(seconds * 1000))
}

function serverSends(message) {
  act(() => FakeWebSocket.lastInstance.receive(message))
}

async function renderMatchLive(initialState) {
  fetchMatchState.mockResolvedValue(initialState)
  const { result } = renderHook(() => useMatchLive("12"), { wrapper: MemoryRouter })
  await flush()
  return result
}

// ---------- Tests ----------

describe("useMatchLive - pausas", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal("WebSocket", FakeWebSocket)
    FakeWebSocket.lastInstance = null
    fetchMatchTeams.mockResolvedValue(TEAMS)
    requestMatchWebsocketUrl.mockResolvedValue("ws://localhost:8000/ws/v1/matches/12?token=t1")
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it("Debería registrar el tipo y los segundos con PAUSE_STARTED, y volver a 'sin pausa' con PAUSE_FINISHED", async () => {
    const result = await renderMatchLive(MATCH_IN_PROGRESS)
    expect(result.current.match.pause).toBeNull()

    serverSends(PAUSE_STARTED)
    expect(result.current.match.pause).toEqual({ type: "HT", remainingSeconds: 30 })

    serverSends(PAUSE_FINISHED)
    expect(result.current.match.pause).toBeNull()
  })

  it("Debería descontar un segundo por segundo y quedarse en 0 hasta que llegue PAUSE_FINISHED", async () => {
    const result = await renderMatchLive(MATCH_IN_PROGRESS)
    serverSends({ ...PAUSE_STARTED, duration_seconds: 3 })

    await waitSeconds(1)
    expect(result.current.match.pause.remainingSeconds).toBe(2)

    await waitSeconds(5)
    expect(result.current.match.pause).toEqual({ type: "HT", remainingSeconds: 0 })
  })

  it("Debería mantener congelados marcador, reloj y cancha durante la pausa, y actualizarlos al terminar", async () => {
    const result = await renderMatchLive(MATCH_IN_PROGRESS)
    serverSends(PAUSE_STARTED)

    serverSends({ ...NEXT_TICK, current_tick: 600 })
    expect(result.current.match.currentTick).toBe(600)
    expect(result.current.match.score).toEqual({ home: 1, away: 0 })
    expect(result.current.match.ball).toEqual({ x: 52.5, y: 34 })
    expect(result.current.match.players[0].position).toEqual({ x: 50, y: 30 })

    serverSends(PAUSE_FINISHED)
    serverSends(NEXT_TICK)
    expect(result.current.match.currentTick).toBe(601)
    expect(result.current.match.score).toEqual({ home: 2, away: 0 })
  })

  it("Debería reflejar una pausa ya empezada al entrar, con el tiempo restante de /state", async () => {
    const result = await renderMatchLive({ ...MATCH_IN_PROGRESS, pause: { type: "HT", remainingSeconds: 42 } })

    expect(result.current.status).toBe("ready")
    expect(result.current.match.pause).toEqual({ type: "HT", remainingSeconds: 42 })

    await waitSeconds(2)
    expect(result.current.match.pause.remainingSeconds).toBe(40)
  })

  it("Debería mostrar la posicion de la pelota y jugadores en una pausa ya empezada", async () => {
    const result = await renderMatchLive({ ...MATCH_IN_PROGRESS, pause: {type: "CB", remainingSeconds: 7 } })

    expect(result.current.match.ball).toEqual({ x: 52.5, y: 34 })
    expect(result.current.match.players[0].position).toEqual({ x: 50, y: 30 })
  })

  it("Debería ignorar un PAUSE_STARTED repetido y seguir con la cuenta regresiva", async () => {
    const result = await renderMatchLive(MATCH_IN_PROGRESS)
    serverSends({ ...PAUSE_STARTED, duration_seconds: 20 })
    await waitSeconds(5)

    expect(result.current.match.pause.remainingSeconds).toBe(15)

    serverSends({ ...PAUSE_STARTED, duration_seconds: 20 })
    
    await waitSeconds(2)
    expect(result.current.match.pause.remainingSeconds).toBe(13)
  })

  it("Debería ignorar un PAUSE_FINISHED repetido y seguir el partido con normalidad", async () => {
    const result = await renderMatchLive(MATCH_IN_PROGRESS)
    serverSends(PAUSE_STARTED)
    serverSends(PAUSE_FINISHED)
    
    const afterFirst = result.current.match
    serverSends(PAUSE_FINISHED)   // duplicado

    expect(result.current.match).toBe(afterFirst)
  })

  it("Debería cerrar el socket y detener la cuenta regresiva al salir de la pantalla", async () => {
    const closeSpy = vi.spyOn(FakeWebSocket.prototype, "close")
    fetchMatchState.mockResolvedValue(MATCH_IN_PROGRESS)
    const { unmount } = renderHook(() => useMatchLive("12"), { wrapper: MemoryRouter })
    await flush()
    serverSends(PAUSE_STARTED)  // La pausa activa una cuenta regresiva.

    expect(vi.getTimerCount()).toBeGreaterThan(0)

    unmount()

    expect(closeSpy).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
    
    closeSpy.mockRestore()
  })

  it("Debería pedir /state al abrir la conexión por primera vez y mostrar la pausa que empezó", async () => {
    const result = await renderMatchLive(MATCH_IN_PROGRESS)
    // La pausa empezó entre la carga inicial y la apertura del socket: PAUSE_STARTED no llegó
    fetchMatchState.mockResolvedValue({ ...MATCH_IN_PROGRESS, pause: { type: "HT", remainingSeconds: 19 } })

    act(() => FakeWebSocket.lastInstance.onopen())
    await flush()

    expect(fetchMatchState).toHaveBeenNthCalledWith(2, "12")
    expect(result.current.match.pause).toEqual({ type: "HT", remainingSeconds: 19 })
  })

  it("Debería pedir /state al reconectar y reflejar la pausa que empezó mientras estaba desconectado", async () => {
    const result = await renderMatchLive(MATCH_IN_PROGRESS)
    act(() => FakeWebSocket.lastInstance.onopen())    // primera conexión
    act(() => FakeWebSocket.lastInstance.onclose())   // se corta

    fetchMatchState.mockResolvedValue({ 
      ...MATCH_IN_PROGRESS,
      currentTick: 610,
      pause: { type: "HT", remainingSeconds: 12 } 
    })
    await waitSeconds(1)                              // el reintento espera 1 s
    act(() => FakeWebSocket.lastInstance.onopen())    // reconecta
    await flush()

    expect(fetchMatchState).toHaveBeenCalledTimes(3)
    expect(fetchMatchState).toHaveBeenNthCalledWith(3, "12")
    expect(result.current.match.pause).toEqual({ type: "HT", remainingSeconds: 12 })
    expect(result.current.match.currentTick).toBe(610)
  })
})

describe("useMatchLive - sustituciones", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal("WebSocket", FakeWebSocket)
    FakeWebSocket.lastInstance = null
    fetchMatchTeams.mockResolvedValue(TEAMS)
    requestMatchWebsocketUrl.mockResolvedValue("ws://localhost:8000/ws/v1/matches/12?token=t1")
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it("Debería mostrar al que entró y no al que salió cuando el tick trae la sustitución", async () => {
    const result = await renderMatchLive(MATCH_IN_PROGRESS)
    fetchMatchState.mockResolvedValue({
      ...MATCH_IN_PROGRESS,
      players: [{ player_id: 105, team_id: 1, name: "Nico González", number: 11 }],
    })

    serverSends({ ...NEXT_TICK, players: [{ player_id: 105, team_id: 1, position: { x: 70, y: 25 }, current_action: "RUN" }] })
    await flush()

    expect(result.current.match.players).toHaveLength(1)
    expect(result.current.match.players[0]).toMatchObject({ player_id: 105, name: "Nico González", position: { x: 70, y: 25 } })
  })

  it("Debería aplicar en la cancha una sustitución confirmada, aunque el partido esté en pausa", async () => {
    const result = await renderMatchLive(MATCH_IN_PROGRESS)
    serverSends(PAUSE_STARTED)

    act(() => result.current.substitutePlayer(101, 105))

    expect(result.current.match.players.map((player) => player.player_id)).toEqual([105])
    expect(result.current.match.players[0].position).toEqual({ x: 50, y: 30 })
  })

  it("No debería volver a pedir /state si el que entra ya estaba en la lista de suplentes", async () => {
    const substitute = { player_id: 105, team_id: 1, name: "Nico González", number: 11 }
    const result = await renderMatchLive({ ...MATCH_IN_PROGRESS, substitutes: [substitute] })
    serverSends(PAUSE_STARTED)

    act(() => result.current.substitutePlayer(101, 105))
    await flush()

    expect(result.current.match.players[0]).toMatchObject({ name: "Nico González", position: { x: 50, y: 30 } })
    expect(result.current.match.substitutes.map((player) => player.player_id)).toEqual([101])
    expect(fetchMatchState).toHaveBeenCalledTimes(1)
  })
})

describe("useMatchLive - usuario que no participa", () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it("Debería quedar en not-participant y sin datos del partido si el back responde 403", async () => {
    fetchMatchTeams.mockResolvedValue(TEAMS)
    fetchMatchState.mockRejectedValue(new ApiError(403, "UNAUTHORIZED_ACTION", "No participás"))

    const { result } = renderHook(() => useMatchLive("12"), { wrapper: MemoryRouter })
    await waitFor(() => expect(result.current.status).toBe("not-participant"))

    expect(result.current.match).toBeNull()
  })
})
