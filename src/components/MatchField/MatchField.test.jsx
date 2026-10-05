// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest"
import { render, screen, cleanup, fireEvent } from "@testing-library/react"
import Pitch from "../Pitch/Pitch"
import MatchField from "./MatchField"
import { FIELD_CONFIG } from "../../constants/fieldConfig"

afterEach(() => {
  cleanup()
})

const HOME = 1
const AWAY = 2

const players = [
  { player_id: 1, team_id: HOME, number: 1, position: { x: 10, y: 20 } },
  { player_id: 2, team_id: HOME, number: 2, position: { x: 30, y: 30 } },
  { player_id: 3, team_id: HOME, number: 3, position: { x: 40, y: 40 } },
  { player_id: 4, team_id: AWAY, number: 1, position: { x: 90, y: 20 } },
  { player_id: 5, team_id: AWAY, number: 2, position: { x: 70, y: 30 } },
  { player_id: 6, team_id: AWAY, number: 3, position: { x: 60, y: 40 } },
]
const ball = { x: 52.5, y: 30 }

const renderPieces = (props = {}) =>
  render(
    <Pitch>
      <MatchField players={players} ball={ball} homeTeamId={HOME} {...props} />
    </Pitch>,
  )

describe("MatchField", () => {
  it("Debería renderizar los 6 jugadores y la pelota dentro de la cancha", () => {
    renderPieces()

    const content = screen.getByTestId("pitch-content")
    expect(content.contains(screen.getByTestId("match-field"))).toBe(true)
    expect(screen.getAllByRole("button")).toHaveLength(6)
    expect(screen.getByTestId("pitch-ball")).toBeTruthy()
  })

  it("Debería ubicar jugadores y pelota con las coordenadas del juego, sin convertir", () => {
    renderPieces()

    expect(screen.getByTestId("pitch-player-1").style.transform).toBe("translate(10px, 20px)")
    expect(screen.getByTestId("pitch-ball").style.transform).toBe("translate(52.5px, 30px)")
  })

  it("Debería mostrar el número de cada jugador", () => {
    renderPieces()

    expect(screen.getByTestId("pitch-player-3").textContent).toBe("3")
  })

  it("Debería distinguir visualmente al equipo local del visitante", () => {
    renderPieces()

    expect(screen.getByTestId("pitch-player-1").classList.contains("pitch-player--home")).toBe(true)
    expect(screen.getByTestId("pitch-player-4").classList.contains("pitch-player--away")).toBe(true)
  })

  it("Debería mantener dentro de la cancha lo que viene con coordenadas fuera de rango", () => {
    renderPieces({
      players: [{ player_id: 1, team_id: HOME, number: 1, position: { x: -5, y: 999 } }],
      ball: { x: 500, y: -3 },
    })

    expect(screen.getByTestId("pitch-player-1").style.transform).toBe(
      `translate(0px, ${FIELD_CONFIG.width}px)`,
    )
    expect(screen.getByTestId("pitch-ball").style.transform).toBe(
      `translate(${FIELD_CONFIG.length}px, 0px)`,
    )
  })

  it("Debería ignorar posiciones inválidas sin romper el resto", () => {
    renderPieces({
      players: [
        { player_id: 1, team_id: HOME, number: 1, position: { x: NaN, y: 5 } },
        { player_id: 2, team_id: HOME, number: 2 },
        { player_id: 3, team_id: HOME, number: 3, position: { x: 1, y: 1 } },
      ],
      ball: null,
    })

    expect(screen.getAllByRole("button")).toHaveLength(1)
    expect(screen.queryByTestId("pitch-ball")).toBeNull()
  })

  it("Debería mover al mismo elemento cuando cambian las posiciones (para que se anime)", () => {
    const { rerender } = renderPieces()
    const before = screen.getByTestId("pitch-player-1")

    rerender(
      <Pitch>
        <MatchField
          players={[{ ...players[0], position: { x: 15, y: 25 } }]}
          ball={{ x: 60, y: 31 }}
          homeTeamId={HOME}
        />
      </Pitch>,
    )

    const after = screen.getByTestId("pitch-player-1")
    expect(after).toBe(before)
    expect(after.style.transform).toBe("translate(15px, 25px)")
    expect(screen.getByTestId("pitch-ball").style.transform).toBe("translate(60px, 31px)")
  })

  it("Debería avisar el player_id al hacer clic en un jugador", () => {
    const onSelectPlayer = vi.fn()
    renderPieces({ onSelectPlayer })

    fireEvent.click(screen.getByTestId("pitch-player-4"))

    expect(onSelectPlayer).toHaveBeenCalledWith(4)
  })

  it("Debería permitir seleccionar con el teclado (Enter)", () => {
    const onSelectPlayer = vi.fn()
    renderPieces({ onSelectPlayer })

    fireEvent.keyDown(screen.getByTestId("pitch-player-2"), { key: "Enter" })

    expect(onSelectPlayer).toHaveBeenCalledWith(2)
  })

  it("Debería marcar visualmente solo al jugador seleccionado", () => {
    renderPieces({ selectedPlayerId: 5 })

    expect(screen.getByTestId("pitch-player-5").classList.contains("pitch-player--selected")).toBe(true)
    expect(screen.getByTestId("pitch-player-1").classList.contains("pitch-player--selected")).toBe(false)
  })

  it("No debería fallar al hacer clic si no se pasa onSelectPlayer", () => {
    renderPieces()

    expect(() => fireEvent.click(screen.getByTestId("pitch-player-1"))).not.toThrow()
  })
})
