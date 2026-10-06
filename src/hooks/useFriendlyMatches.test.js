// para correr el test = npx vitest run
// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, waitFor, act } from "@testing-library/react"

vi.mock("../services/friendlies", async () => {
  const actual = await vi.importActual("../services/friendlies")
  return {
    ...actual,
    fetchFriendlyMatches: vi.fn(),
  }
})

// Simula el canal global: guarda los listeners para poder emitir eventos desde los tests
const mockListeners = new Map()

vi.mock("../services/globalSocket", () => ({
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

function countListeners() {
  return [...mockListeners.values()].reduce((total, set) => total + set.size, 0)
}

import { fetchFriendlyMatches } from "../services/friendlies"
import { useFriendlyMatches } from "./useFriendlyMatches"

const AMISTOSO_BACKEND = { matchId: 1, teamHostId: 5, teamAwayId: null, status: "PENDING", matchDuration: 5 }

function respuestaCon(matches) {
  return { matches, page: 1, limit: 20, total: matches.length }
}

describe("useFriendlyMatches", () => {
  beforeEach(() => {
    fetchFriendlyMatches.mockReset()
    mockListeners.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("debería arrancar en loading y después cargar los amistosos", async () => {
    fetchFriendlyMatches.mockResolvedValue({
      matches: [{ matchId: 1, teamHostId: 1, teamAwayId: 2, status: "PENDING", matchDuration: 90 }],
      page: 1,
      limit: 20,
      total: 1,
    })

    const { result } = renderHook(() => useFriendlyMatches())

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.matches).toHaveLength(1)
    expect(result.current.error).toBe("")
    expect(result.current.isEmpty).toBe(false)
    expect(fetchFriendlyMatches).toHaveBeenCalledWith({ page: 1, limit: 20, status: "PENDING" })
  })

  it("debería marcar isEmpty cuando el backend devuelve matches: []", async () => {
    fetchFriendlyMatches.mockResolvedValue({ matches: [], page: 1, limit: 20, total: 0 })

    const { result } = renderHook(() => useFriendlyMatches())

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.isEmpty).toBe(true)
  })

  it("debería exponer un error sin romper la lista cuando falla la petición", async () => {
    fetchFriendlyMatches.mockRejectedValue(new Error("network down"))

    const { result } = renderHook(() => useFriendlyMatches())

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.error).not.toBe("")
    expect(result.current.matches).toEqual([])
    expect(result.current.isEmpty).toBe(false)
  })

  it("debería volver a pedir la lista cuando cambia page", async () => {
    fetchFriendlyMatches.mockResolvedValue({ matches: [], page: 1, limit: 20, total: 0 })

    const { result } = renderHook(() => useFriendlyMatches())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => {
      result.current.setPage(2)
    })

    await waitFor(() =>
      expect(fetchFriendlyMatches).toHaveBeenLastCalledWith({ page: 2, limit: 20, status: "PENDING" })
    )
  })

  it("debería volver a pedir la lista cuando cambia limit", async () => {
    fetchFriendlyMatches.mockResolvedValue({ matches: [], page: 1, limit: 20, total: 0 })

    const { result } = renderHook(() => useFriendlyMatches())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => {
      result.current.setLimit(5)
    })

    await waitFor(() =>
      expect(fetchFriendlyMatches).toHaveBeenLastCalledWith({ page: 1, limit: 5, status: "PENDING" })
    )
  })

  describe("actualización en tiempo real", () => {
    async function renderCargado(matches = [AMISTOSO_BACKEND]) {
      fetchFriendlyMatches.mockResolvedValue(respuestaCon(matches))
      const hook = renderHook(() => useFriendlyMatches())
      await waitFor(() => expect(hook.result.current.isLoading).toBe(false))
      return hook
    }

    it("debería agregar el amistoso cuando llega FRIENDLY_CREATED", async () => {
      const { result } = await renderCargado()

      emit("FRIENDLY_CREATED", { match_id: 12, team_host_id: 9, match_duration: 2, status: "PENDING" })

      expect(result.current.matches.map((m) => m.matchId)).toEqual([1, 12])
      expect(result.current.total).toBe(2)
    })

    it("debería no duplicar un amistoso que ya está en la lista", async () => {
      const { result } = await renderCargado()

      emit("FRIENDLY_CREATED", { match_id: 1, team_host_id: 5, match_duration: 5, status: "PENDING" })

      expect(result.current.matches).toHaveLength(1)
      expect(result.current.total).toBe(1)
    })

    it.each(["FRIENDLY_CANCELLED", "GUEST_JOINED_FRIENDLY", "MATCH_STARTED"])(
      "debería quitar el amistoso cuando llega %s",
      async (eventName) => {
        const { result } = await renderCargado()

        emit(eventName, { match_id: 1 })

        expect(result.current.matches).toEqual([])
      }
    )

    it("debería marcar isEmpty cuando la lista queda vacía por los eventos", async () => {
      const { result } = await renderCargado()

      emit("FRIENDLY_CANCELLED", { match_id: 1 })

      expect(result.current.isEmpty).toBe(true)
    })

    it("debería no perder un amistoso creado mientras se hace la carga inicial", async () => {
      let resolverCarga
      fetchFriendlyMatches.mockReturnValue(new Promise((resolve) => { resolverCarga = resolve }))

      const { result } = renderHook(() => useFriendlyMatches())
      expect(result.current.isLoading).toBe(true)

      emit("FRIENDLY_CREATED", { match_id: 12, team_host_id: 9, match_duration: 2, status: "PENDING" })

      await act(async () => {
        resolverCarga(respuestaCon([AMISTOSO_BACKEND]))
      })

      expect(result.current.matches.map((m) => m.matchId)).toEqual([1, 12])
    })

    it("debería no duplicar si el amistoso creado durante la carga ya viene en la respuesta", async () => {
      let resolverCarga
      fetchFriendlyMatches.mockReturnValue(new Promise((resolve) => { resolverCarga = resolve }))

      const { result } = renderHook(() => useFriendlyMatches())

      emit("FRIENDLY_CREATED", { match_id: 1, team_host_id: 5, match_duration: 5, status: "PENDING" })

      await act(async () => {
        resolverCarga(respuestaCon([AMISTOSO_BACKEND]))
      })

      expect(result.current.matches).toHaveLength(1)
    })

    it("debería quitar un amistoso cancelado mientras se hace la carga inicial", async () => {
      let resolverCarga
      fetchFriendlyMatches.mockReturnValue(new Promise((resolve) => { resolverCarga = resolve }))

      const { result } = renderHook(() => useFriendlyMatches())

      emit("FRIENDLY_CANCELLED", { match_id: 1 })

      await act(async () => {
        resolverCarga(respuestaCon([AMISTOSO_BACKEND]))
      })

      expect(result.current.matches).toEqual([])
    })

    it("debería dejar de procesar eventos al desmontarse", async () => {
      const { unmount } = await renderCargado()
      expect(countListeners()).toBe(4)

      unmount()

      expect(countListeners()).toBe(0)
    })
  })
})
