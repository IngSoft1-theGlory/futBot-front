import { describe, it, expect, vi } from "vitest"

vi.mock("./createhttpService", () => ({ httpService: { get: vi.fn() } }))

import { filterPlayerBehaviors } from "./behaviors"

// Lista como la que devuelve GET /behaviors, mezcla comportamientos de jugador y de DT
const DEFENSIVO = { behavior_id: 1, name: "Defensivo", is_default: true, behavior_type: "PLAYER" }
const DT_OFENSIVO = { behavior_id: 2, name: "DT ofensivo", is_default: true, behavior_type: "COACH" }
const MI_DELANTERO = { behavior_id: 3, name: "Mi delantero", is_default: false, behavior_type: "PLAYER" }
const MI_DT = { behavior_id: 4, name: "Mi DT", is_default: false, behavior_type: "COACH" }

describe("filterPlayerBehaviors", () => {
  it("Debería dejar solo los comportamientos PLAYER de una lista que mezcla los dos tipos, en el mismo orden", () => {
    const result = filterPlayerBehaviors([DEFENSIVO, DT_OFENSIVO, MI_DELANTERO, MI_DT])

    expect(result).toEqual([DEFENSIVO, MI_DELANTERO])
  })

  it("Debería devolver una lista vacía si todos los comportamientos son COACH", () => {
    expect(filterPlayerBehaviors([DT_OFENSIVO, MI_DT])).toEqual([])
  })

  it("Debería devolver una lista vacía si no hay comportamientos", () => {
    expect(filterPlayerBehaviors([])).toEqual([])
  })
})
