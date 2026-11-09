import { describe, it, expect, vi, beforeEach } from "vitest"

// Se simula solo el cliente HTTP: acá se prueba qué pedido arma el servicio, no el back
vi.mock("./createhttpService", () => ({ httpService: { get: vi.fn(), put: vi.fn() } }))

import { httpService } from "./createhttpService"
import { chooseLeagueCoach } from "./leagues"

describe("chooseLeagueCoach", () => {
  beforeEach(() => {
    httpService.put.mockReset()
  })

  it("Debería enviar el comportamiento elegido al seleccionar un DT", async () => {
    httpService.put.mockResolvedValue({ league_id: 3, team_id: 8, behavior_id: 20 })

    const result = await chooseLeagueCoach(3, 8, 20)

    expect(httpService.put).toHaveBeenCalledWith("/leagues/3/teams/8/coach", { behavior_id: 20 })
    expect(result).toEqual({ league_id: 3, team_id: 8, behavior_id: 20 })
  })

  it("Debería enviar behavior_id null para quitar el DT", async () => {
    httpService.put.mockResolvedValue({ league_id: 3, team_id: 8, behavior_id: null })

    await chooseLeagueCoach(3, 8, null)

    expect(httpService.put).toHaveBeenCalledWith("/leagues/3/teams/8/coach", { behavior_id: null })
  })

  it("Debería permitir que CoachSelector maneje el error de la solicitud", async () => {
    const error = new Error("rechazado")
    httpService.put.mockRejectedValue(error)

    await expect(chooseLeagueCoach(3, 8, 20)).rejects.toBe(error)
  })
})