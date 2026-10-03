// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, act } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"

let mockUser = { user_id: 1, team_id: 5 }

vi.mock("../../hooks/useSession", () => ({
  useSession: () => ({ user: mockUser }),
}))

vi.mock("../../services/friendlies", async () => {
  const actual = await vi.importActual("../../services/friendlies")
  return { ...actual, fetchFriendlyMatches: vi.fn() }
})

// Simula el canal global para poder emitir eventos desde los tests
const mockListeners = new Map()

vi.mock("../../services/globalSocket", () => ({
  subscribe: vi.fn((eventName, listener) => {
    if (!mockListeners.has(eventName)) mockListeners.set(eventName, new Set())
    mockListeners.get(eventName).add(listener)
    return () => mockListeners.get(eventName)?.delete(listener)
  }),
}))

function emit(eventName, data) {
  act(() => {
    mockListeners.get(eventName)?.forEach((listener) => listener(data))
  })
}

import { fetchFriendlyMatches } from "../../services/friendlies"
import FriendlyListPage from "./FriendlyListPage"

const AMISTOSO_AJENO = { matchId: 1, teamHostId: 7, teamAwayId: null, status: "PENDING", matchDuration: 5 }
const AMISTOSO_PROPIO = { matchId: 2, teamHostId: 5, teamAwayId: null, status: "PENDING", matchDuration: 2 }

function respuestaCon(matches) {
  return { matches, page: 1, limit: 20, total: matches.length }
}

async function renderPage(matches) {
  fetchFriendlyMatches.mockResolvedValue(respuestaCon(matches))
  render(
    <MemoryRouter>
      <FriendlyListPage />
    </MemoryRouter>
  )
  await screen.findAllByText(/Equipo #|no hay amistosos/i)
}

describe("FriendlyListPage en tiempo real", () => {
  beforeEach(() => {
    fetchFriendlyMatches.mockReset()
    mockListeners.clear()
    mockUser = { user_id: 1, team_id: 5 }
  })

  afterEach(() => {
    cleanup()
  })

  it("Debería mostrar un amistoso creado por otro usuario sin recargar", async () => {
    await renderPage([AMISTOSO_AJENO])

    emit("FRIENDLY_CREATED", { match_id: 12, team_host_id: 9, match_duration: 2, status: "PENDING" })

    expect(screen.getByText(/Equipo #9/)).toBeTruthy()
    expect(fetchFriendlyMatches).toHaveBeenCalledTimes(1)
  })

  it("Debería quitar un amistoso cancelado y mostrar el estado vacío", async () => {
    await renderPage([AMISTOSO_AJENO])

    emit("FRIENDLY_CANCELLED", { match_id: 1 })

    expect(screen.queryByText(/Equipo #7/)).toBeNull()
    expect(screen.getByText(/no hay amistosos disponibles/i)).toBeTruthy()
  })

  it("Debería marcar el amistoso propio y no permitir elegirlo", async () => {
    await renderPage([AMISTOSO_AJENO, AMISTOSO_PROPIO])

    const tarjetaPropia = screen.getByText("Tu amistoso").closest("button")
    expect(tarjetaPropia.disabled).toBe(true)

    const tarjetaAjena = screen.getByText(/Equipo #7/).closest("button")
    expect(tarjetaAjena.disabled).toBe(false)
  })

  it("Debería deshabilitar Unirme si el amistoso seleccionado deja de estar disponible", async () => {
    await renderPage([AMISTOSO_AJENO])

    act(() => {
      screen.getByText(/Equipo #7/).closest("button").click()
    })
    const unirme = screen.getByRole("button", { name: /Unirme al Amistoso/i })
    expect(unirme.disabled).toBe(false)

    emit("GUEST_JOINED_FRIENDLY", { match_id: 1, team_host_id: 7, team_away_id: 8 })

    expect(screen.getByRole("button", { name: /Unirme al Amistoso/i }).disabled).toBe(true)
  })
})
