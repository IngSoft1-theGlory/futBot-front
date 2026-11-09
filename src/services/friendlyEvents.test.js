import { describe, it, expect } from "vitest"
import {
  applyFriendlyEvent,
  FRIENDLY_CANCELLED,
  FRIENDLY_CREATED,
  GUEST_JOINED_FRIENDLY,
  MATCH_STARTED,
} from "./friendlyEvents"

const AMISTOSO_1 = { matchId: 1, teamHostId: 5, teamAwayId: null, status: "PENDING", matchDuration: 5 }
const AMISTOSO_2 = { matchId: 2, teamHostId: 7, teamAwayId: null, status: "PENDING", matchDuration: 2 }

describe("applyFriendlyEvent", () => {
  it("Debería agregar el amistoso al final con FRIENDLY_CREATED", () => {
    const result = applyFriendlyEvent([AMISTOSO_1], FRIENDLY_CREATED, {
      match_id: 12,
      team_host_id: 9,
      team_host_name: "Los Pibes",
      match_duration: 2,
      status: "PENDING",
    })

    expect(result).toEqual([
      AMISTOSO_1,
      { matchId: 12, teamHostId: 9, teamHostName: "Los Pibes", teamAwayId: null, teamAwayName: null, status: "PENDING", matchDuration: 2 },
    ])
  })

  it("Debería no duplicar un amistoso que ya está en la lista", () => {
    const lista = [AMISTOSO_1]
    const result = applyFriendlyEvent(lista, FRIENDLY_CREATED, {
      match_id: 1,
      team_host_id: 5,
      match_duration: 5,
      status: "PENDING",
    })

    expect(result).toBe(lista)
  })

  it("Debería no agregar un amistoso creado que no esté en PENDING", () => {
    const lista = [AMISTOSO_1]
    const result = applyFriendlyEvent(lista, FRIENDLY_CREATED, {
      match_id: 12,
      team_host_id: 9,
      match_duration: 2,
      status: "IN_PROGRESS",
    })

    expect(result).toBe(lista)
  })

  it.each([FRIENDLY_CANCELLED, GUEST_JOINED_FRIENDLY, MATCH_STARTED])(
    "Debería quitar el amistoso con %s",
    (eventName) => {
      const result = applyFriendlyEvent([AMISTOSO_1, AMISTOSO_2], eventName, { match_id: 1 })

      expect(result).toEqual([AMISTOSO_2])
    }
  )

  it("Debería devolver la misma lista si el amistoso a quitar no está", () => {
    const lista = [AMISTOSO_1]

    expect(applyFriendlyEvent(lista, FRIENDLY_CANCELLED, { match_id: 99 })).toBe(lista)
  })

  it("Debería ignorar eventos sin match_id", () => {
    const lista = [AMISTOSO_1]

    expect(applyFriendlyEvent(lista, FRIENDLY_CREATED, {})).toBe(lista)
    expect(applyFriendlyEvent(lista, FRIENDLY_CANCELLED, undefined)).toBe(lista)
  })

  it("Debería no modificar la lista original", () => {
    const lista = [AMISTOSO_1, AMISTOSO_2]
    applyFriendlyEvent(lista, FRIENDLY_CANCELLED, { match_id: 1 })

    expect(lista).toEqual([AMISTOSO_1, AMISTOSO_2])
  })
})
