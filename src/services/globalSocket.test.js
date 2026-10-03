import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("./createhttpService", async (importOriginal) => {
  const original = await importOriginal()
  return { ...original, httpService: { post: vi.fn() } }
})

import { httpService, ApiError } from "./createhttpService"
import { connect, disconnect, subscribe } from "./globalSocket"

// WS Falso

class FakeWebSocket {
  static instances = []

  constructor(url) {
    this.url = url
    this.closed = false
    FakeWebSocket.instances.push(this)
  }

  close() {
    this.closed = true
  }

  // Helpers para simular lo que haría el servidor
  open() {
    this.onopen?.()
  }

  receive(message) {
    this.onmessage?.({ data: typeof message === "string" ? message : JSON.stringify(message) })
  }

  drop() {
    this.onclose?.({ code: 1006 })
  }
}

function lastSocket() {
  return FakeWebSocket.instances.at(-1)
}

function tokenResponse(n = 1) {
  return { websocket_url: `ws://localhost:8000/ws/v1/global?token=t${n}`, expires_in_seconds: 60 }
}

// Deja que se resuelvan las promesas pendientes (pedido del token)
async function flush() {
  await vi.advanceTimersByTimeAsync(0)
}

// Tests

describe("globalSocket", () => {
  let unsubscribers

  beforeEach(() => {
    vi.useFakeTimers()
    FakeWebSocket.instances = []
    vi.stubGlobal("WebSocket", FakeWebSocket)
    httpService.post.mockReset()
    httpService.post.mockResolvedValue(tokenResponse())
    unsubscribers = []
  })

  afterEach(() => {
    disconnect()
    unsubscribers.forEach((unsubscribe) => unsubscribe())
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  function listen(eventName) {
    const listener = vi.fn()
    unsubscribers.push(subscribe(eventName, listener))
    return listener
  }

  describe("Conexión", () => {
    it("Debería pedir el token de acceso y conectarse a la websocket_url recibida", async () => {
      connect()
      await flush()

      expect(httpService.post).toHaveBeenCalledWith("/live-token/global")
      expect(FakeWebSocket.instances).toHaveLength(1)
      expect(lastSocket().url).toBe(tokenResponse().websocket_url)
    })

    it("No debería abrir una segunda conexión si ya hay una activa", async () => {
      connect()
      connect()
      await flush()

      expect(httpService.post).toHaveBeenCalledTimes(1)
      expect(FakeWebSocket.instances).toHaveLength(1)
    })

    it("Debería cerrar la conexión al desconectarse", async () => {
      connect()
      await flush()

      disconnect()

      expect(lastSocket().closed).toBe(true)
    })

    it("No debería abrir la conexión si se desconectó mientras se pedía el token", async () => {
      let resolveToken
      httpService.post.mockReturnValue(new Promise((resolve) => (resolveToken = resolve)))

      connect()
      disconnect()
      resolveToken(tokenResponse())
      await flush()

      expect(FakeWebSocket.instances).toHaveLength(0)
    })
  })

  describe("Distribución de eventos", () => {
    it("Debería entregar la data a los suscriptores de ese evento y solo a ellos", async () => {
      const onCreated = listen("FRIENDLY_CREATED")
      const onCancelled = listen("FRIENDLY_CANCELLED")
      connect()
      await flush()

      lastSocket().receive({ event: "FRIENDLY_CREATED", data: { match_id: 12 } })

      expect(onCreated).toHaveBeenCalledWith({ match_id: 12 })
      expect(onCancelled).not.toHaveBeenCalled()
    })

    it("Debería entregar el evento a todos los suscriptores del mismo evento", async () => {
      const first = listen("LEAGUE_CREATED")
      const second = listen("LEAGUE_CREATED")
      connect()
      await flush()

      lastSocket().receive({ event: "LEAGUE_CREATED", data: { league_id: 3 } })

      expect(first).toHaveBeenCalledWith({ league_id: 3 })
      expect(second).toHaveBeenCalledWith({ league_id: 3 })
    })

    it("No debería entregar eventos después de desuscribirse", async () => {
      const listener = vi.fn()
      const unsubscribe = subscribe("FRIENDLY_CREATED", listener)
      connect()
      await flush()

      unsubscribe()
      lastSocket().receive({ event: "FRIENDLY_CREATED", data: { match_id: 12 } })

      expect(listener).not.toHaveBeenCalled()
    })

    it("Debería ignorar mensajes inválidos y eventos desconocidos sin cerrar la conexión", async () => {
      const listener = listen("FRIENDLY_CREATED")
      connect()
      await flush()

      lastSocket().receive("esto no es json")
      lastSocket().receive({ sin_evento: true })
      lastSocket().receive({ event: "EVENTO_QUE_NO_EXISTE", data: {} })
      lastSocket().receive({ event: "FRIENDLY_CREATED", data: { match_id: 1 } })

      expect(listener).toHaveBeenCalledTimes(1)
      expect(lastSocket().closed).toBe(false)
    })

    it("Debería seguir entregando el evento aunque un suscriptor falle", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {})
      listen("FRIENDLY_CREATED").mockImplementation(() => {
        throw new Error("falla")
      })
      const other = listen("FRIENDLY_CREATED")
      connect()
      await flush()

      lastSocket().receive({ event: "FRIENDLY_CREATED", data: { match_id: 1 } })

      expect(other).toHaveBeenCalledWith({ match_id: 1 })
    })
  })

  describe("Reconexión", () => {
    it("Debería reconectarse con un token nuevo ante un corte inesperado", async () => {
      connect()
      await flush()
      lastSocket().open()
      httpService.post.mockResolvedValue(tokenResponse(2))

      lastSocket().drop()
      await vi.advanceTimersByTimeAsync(1000)

      expect(httpService.post).toHaveBeenCalledTimes(2)
      expect(FakeWebSocket.instances).toHaveLength(2)
      expect(lastSocket().url).toBe(tokenResponse(2).websocket_url)
    })

    it("Debería esperar cada vez más entre intentos de reconexión", async () => {
      connect()
      await flush()

      lastSocket().drop() // 1° intento: espera 1s
      await vi.advanceTimersByTimeAsync(999)
      expect(FakeWebSocket.instances).toHaveLength(1)
      await vi.advanceTimersByTimeAsync(1)
      expect(FakeWebSocket.instances).toHaveLength(2)

      lastSocket().drop() // 2° intento: espera 2s
      await vi.advanceTimersByTimeAsync(1999)
      expect(FakeWebSocket.instances).toHaveLength(2)
      await vi.advanceTimersByTimeAsync(1)
      expect(FakeWebSocket.instances).toHaveLength(3)
    })

    it("Debería reiniciar la espera después de conectarse con éxito", async () => {
      connect()
      await flush()
      lastSocket().drop()
      await vi.advanceTimersByTimeAsync(1000)

      lastSocket().open() // se conectó bien
      lastSocket().drop()
      await vi.advanceTimersByTimeAsync(1000)

      expect(FakeWebSocket.instances).toHaveLength(3)
    })

    it("Debería reintentar si falla el pedido del token por un error que no es 401", async () => {
      httpService.post.mockRejectedValueOnce(new ApiError(500, "UNKNOWN_ERROR", "Error del servidor"))

      connect()
      await flush()
      expect(FakeWebSocket.instances).toHaveLength(0)

      await vi.advanceTimersByTimeAsync(1000)
      expect(FakeWebSocket.instances).toHaveLength(1)
    })

    it("No debería reconectarse después de desconectarse", async () => {
      connect()
      await flush()

      disconnect()
      await vi.advanceTimersByTimeAsync(60000)

      expect(httpService.post).toHaveBeenCalledTimes(1)
      expect(FakeWebSocket.instances).toHaveLength(1)
    })

    it("No debería reconectarse si el pedido del token devuelve 401", async () => {
      httpService.post.mockRejectedValue(new ApiError(401, "UNAUTHORIZED", "Token inválido o vencido"))

      connect()
      await flush()
      await vi.advanceTimersByTimeAsync(60000)

      expect(httpService.post).toHaveBeenCalledTimes(1)
      expect(FakeWebSocket.instances).toHaveLength(0)
    })
  })
})