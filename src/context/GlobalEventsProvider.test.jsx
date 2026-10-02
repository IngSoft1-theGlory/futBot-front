// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, cleanup } from "@testing-library/react"

let mockIsAuthenticated = false

vi.mock("../hooks/useSession", () => ({
  useSession: () => ({ isAuthenticated: mockIsAuthenticated }),
}))

vi.mock("../services/globalSocket", () => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  subscribe: vi.fn(() => vi.fn()),
}))

import { connect, disconnect, subscribe } from "../services/globalSocket"
import GlobalEventsProvider from "./GlobalEventsProvider"
import { useGlobalEvent } from "../hooks/useGlobalEvent"

function renderProvider() {
  return render(
    <GlobalEventsProvider>
      <p>App</p>
    </GlobalEventsProvider>
  )
}

describe("GlobalEventsProvider", () => {
  beforeEach(() => {
    connect.mockClear()
    disconnect.mockClear()
    subscribe.mockClear()
  })

  afterEach(() => {
    cleanup()
  })

  it("Debería conectarse al canal global cuando hay sesión activa", () => {
    mockIsAuthenticated = true
    renderProvider()

    expect(connect).toHaveBeenCalledTimes(1)
  })

  it("No debería conectarse si no hay sesión", () => {
    mockIsAuthenticated = false
    renderProvider()

    expect(connect).not.toHaveBeenCalled()
  })

  it("Debería desconectarse al cerrar sesión", () => {
    mockIsAuthenticated = true
    const { rerender } = renderProvider()

    mockIsAuthenticated = false
    rerender(
      <GlobalEventsProvider>
        <p>App</p>
      </GlobalEventsProvider>
    )

    expect(disconnect).toHaveBeenCalledTimes(1)
  })

  it("No debería reconectarse al volver a renderizar con la misma sesión", () => {
    mockIsAuthenticated = true
    const { rerender } = renderProvider()

    rerender(
      <GlobalEventsProvider>
        <p>Otra pantalla</p>
      </GlobalEventsProvider>
    )

    expect(connect).toHaveBeenCalledTimes(1)
    expect(disconnect).not.toHaveBeenCalled()
  })
})

describe("useGlobalEvent", () => {
  function Listener({ eventName, onEvent }) {
    useGlobalEvent(eventName, onEvent)
    return null
  }

  beforeEach(() => {
    subscribe.mockClear()
  })

  afterEach(() => {
    cleanup()
  })

  it("Debería suscribirse al evento y entregar la data al handler", () => {
    const onEvent = vi.fn()
    render(<Listener eventName="FRIENDLY_CREATED" onEvent={onEvent} />)

    expect(subscribe).toHaveBeenCalledWith("FRIENDLY_CREATED", expect.any(Function))
    const listener = subscribe.mock.calls[0][1]
    listener({ match_id: 12 })

    expect(onEvent).toHaveBeenCalledWith({ match_id: 12 })
  })

  it("Debería desuscribirse al desmontarse", () => {
    const unsubscribe = vi.fn()
    subscribe.mockReturnValueOnce(unsubscribe)
    const { unmount } = render(<Listener eventName="FRIENDLY_CREATED" onEvent={vi.fn()} />)

    unmount()

    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })

  it("Debería usar el handler más reciente sin volver a suscribirse", () => {
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = render(<Listener eventName="FRIENDLY_CREATED" onEvent={first} />)

    rerender(<Listener eventName="FRIENDLY_CREATED" onEvent={second} />)
    subscribe.mock.calls[0][1]({ match_id: 1 })

    expect(subscribe).toHaveBeenCalledTimes(1)
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledWith({ match_id: 1 })
  })
})