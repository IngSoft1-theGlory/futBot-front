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

import { fetchFriendlyMatches } from "../services/friendlies"
import { useFriendlyMatches } from "./useFriendlyMatches"

describe("useFriendlyMatches", () => {
  beforeEach(() => {
    fetchFriendlyMatches.mockReset()
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
})
