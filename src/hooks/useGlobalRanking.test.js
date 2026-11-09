// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, waitFor, act } from "@testing-library/react"

vi.mock("../services/rankings", async () => {
  const actual = await vi.importActual("../services/rankings")
  return { ...actual, fetchGlobalRanking: vi.fn() }
})

// canal global simulado
const mockListeners = new Map()
vi.mock("../services/globalSocket", () => ({
  subscribe: vi.fn((eventName, listener) => {
    if (!mockListeners.has(eventName)) mockListeners.set(eventName, new Set())
    mockListeners.get(eventName).add(listener)
    return () => mockListeners.get(eventName)?.delete(listener)
  }),
}))

// simula que el servidor publica un evento
function emit(eventName, data) {
  act(() => { mockListeners.get(eventName)?.forEach((l) => l(data)) })
}
function countListeners() {
  return [...mockListeners.values()].reduce((total, set) => total + set.size, 0)
}

// promesa que controla manualmente cuando llega una respuesta si falla o no
function deferred() {
  let resolve, reject
  const promise = new Promise((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

import { fetchGlobalRanking } from "../services/rankings"
import { useGlobalRanking } from "./useGlobalRanking"

const club = (position, teamId, teamName, points) => ({ position, teamId, teamName, points })
const RANKING_A = [club(1, 5, "alfajoresFC", 9)]
const RANKING_B = [club(1, 8, "BocaJuniors", 12)]
const RANKING_C = [club(1, 2, "Los Pibes", 15)]

// forma de lo que devuelve fetchGlobalRanking
const ok = (ranking, hasNextPage = false) => ({ ranking, hasNextPage })

// monta el hook y espera a que termine la primera carga
async function renderCargado() {
  const rendered = renderHook(() => useGlobalRanking())
  await waitFor(() => expect(rendered.result.current.isLoading).toBe(false))
  return rendered
}

describe("useGlobalRanking: RANKING_UPDATED", () => {
  beforeEach(() => {
    fetchGlobalRanking.mockReset()
    mockListeners.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("Debería volver a pedir la página actual y mostrar los datos nuevos al recibir RANKING_UPDATED", async () => {
    fetchGlobalRanking
      .mockResolvedValueOnce(ok(RANKING_A, true))  // carga de la página 1
      .mockResolvedValueOnce(ok(RANKING_B))        // carga de la página 2
      .mockResolvedValueOnce(ok(RANKING_C, true))  // refresco (debe ser de la página 2)

    const { result } = await renderCargado()
    act(() => { result.current.goToNextPage() })
    await waitFor(() => expect(result.current.ranking).toEqual(RANKING_B))

    emit("RANKING_UPDATED")

    await waitFor(() => expect(result.current.ranking).toEqual(RANKING_C))
    expect(result.current.page).toBe(2)
    expect(result.current.hasNextPage).toBe(true)
    expect(fetchGlobalRanking).toHaveBeenLastCalledWith({ page: 2, limit: 20 })
  })

  it("Debería conservar los datos anteriores y no mostrar la carga si falla el refresco silencioso", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const refresco = deferred()
    fetchGlobalRanking.mockResolvedValueOnce(ok(RANKING_A)).mockReturnValueOnce(refresco.promise)

    const { result } = await renderCargado()
    emit("RANKING_UPDATED")

    // mientras el refresco está en curso, la tabla no se actualiza
    expect(fetchGlobalRanking).toHaveBeenCalledTimes(2)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.ranking).toEqual(RANKING_A)

    await act(async () => { refresco.reject(new Error("falló")) })

    expect(consoleSpy).toHaveBeenCalled()
    expect(result.current.ranking).toEqual(RANKING_A)
    expect(result.current.error).toBe("")
  })

  it("Debería mostrar los datos nuevos y limpiar el error si el refresco tiene éxito", async () => {
    fetchGlobalRanking.mockRejectedValueOnce(new Error("falló")).mockResolvedValueOnce(ok(RANKING_B))

    const { result } = await renderCargado()
    expect(result.current.error).not.toBe("")

    emit("RANKING_UPDATED")

    await waitFor(() => expect(result.current.ranking).toEqual(RANKING_B))
    expect(result.current.error).toBe("")
  })

  it.each([
    ["con datos viejos", (carga) => carga.resolve(ok(RANKING_A))],
    ["con error", (carga) => carga.reject(new Error("falló"))],
  ])("Debería conservar los datos del refresco si la carga inicial termina tarde %s", async (_caso, llegaTarde) => {
    const cargaLenta = deferred()
    fetchGlobalRanking.mockReturnValueOnce(cargaLenta.promise).mockResolvedValueOnce(ok(RANKING_B))

    const { result } = renderHook(() => useGlobalRanking())
    emit("RANKING_UPDATED") // el refresco responde antes que la carga
    await waitFor(() => expect(result.current.ranking).toEqual(RANKING_B))

    await act(async () => { llegaTarde(cargaLenta) })

    expect(result.current.ranking).toEqual(RANKING_B)
    expect(result.current.error).toBe("")
    expect(result.current.isLoading).toBe(false)
  })

  it("Debería ignorar un refresco pendiente si el usuario cambia de página", async () => {
    const refrescoViejo = deferred()
    const cargaPagina2 = deferred()
    fetchGlobalRanking
      .mockResolvedValueOnce(ok(RANKING_A, true)) // carga de la página 1
      .mockReturnValueOnce(refrescoViejo.promise) // refresco de la página 1 (en vuelo)
      .mockReturnValueOnce(cargaPagina2.promise)  // carga de la página 2 (en vuelo)

    const { result } = await renderCargado()
    emit("RANKING_UPDATED")
    act(() => { result.current.goToNextPage() })
    await waitFor(() => expect(fetchGlobalRanking).toHaveBeenCalledTimes(3))

    // el refresco de la página 1 responde ANTES que la carga de la página 2
    await act(async () => { refrescoViejo.resolve(ok(RANKING_C)) })
    expect(result.current.ranking).toEqual(RANKING_A) // no se muestra RANKING_C

    await act(async () => { cargaPagina2.resolve(ok(RANKING_B)) })
    expect(result.current.ranking).toEqual(RANKING_B)
  })

  it("Debería ignorar la respuesta de un refresco viejo si uno más nuevo llegó", async () => {
    const primero = deferred()
    const segundo = deferred()
    fetchGlobalRanking
      .mockResolvedValueOnce(ok(RANKING_A))
      .mockReturnValueOnce(primero.promise)
      .mockReturnValueOnce(segundo.promise)

    const { result } = await renderCargado()
    emit("RANKING_UPDATED")
    emit("RANKING_UPDATED")

    await act(async () => { segundo.resolve(ok(RANKING_B)) }) // el nuevo responde primero
    await act(async () => { primero.resolve(ok(RANKING_C)) }) // el viejo llega tarde

    expect(result.current.ranking).toEqual(RANKING_B)
  })

  it("Debería dejar de escuchar RANKING_UPDATED cuando se desmonta el hook", async () => {
    fetchGlobalRanking.mockResolvedValue(ok(RANKING_A))

    const { unmount } = await renderCargado()
    expect(countListeners()).toBe(1)

    unmount()

    expect(countListeners()).toBe(0)
    emit("RANKING_UPDATED")
    expect(fetchGlobalRanking).toHaveBeenCalledTimes(1) // el evento ya no dispara pedidos
  })
})