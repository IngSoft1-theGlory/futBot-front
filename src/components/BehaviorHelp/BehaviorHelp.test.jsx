import { describe, it, expect, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import "@testing-library/jest-dom/vitest"
import BehaviorHelp from "./BehaviorHelp"

const SECCIONES = [
  "Métodos de api",
  "Estado del juego (gs = api.get_game_state())",
  "Puntos y vectores",
  "Funciones disponibles",
  "La cancha",
]
const METODOS_API = [
  "api.get_game_state()",
  "api.get_reach_distance()",
  "api.idle()",
  "api.run_to(punto, velocidad)",
  "api.kick_ball(direccion, potencia)",
]
const ESTADO_DEL_JUEGO = [
  "gs.ball_position",
  "gs.ball_velocity",
  "gs.my_position",
  "gs.teammates",
  "gs.opponents",
  "gs.team_goal",
  "gs.opponent_goal",
]
const PUNTOS_Y_VECTORES = [
  "Point2D(x, y)",
  "punto.distance_to(otro)",
  "punto.direction_to(otro)",
  "Vector2D(x, y)",
  "vector.magnitude()",
  "vector.normalize()",
]
const FUNCIONES = [
  "abs", "min", "max", "len", "round", "float", "int", "sum",
  "bool", "str", "list", "tuple", "dict", "any", "all", "sorted", "math",
]

describe("BehaviorHelp", () => {
  afterEach(() => {
    cleanup()
  })

  it("Debería mostrarse cerrada al principio, con un resumen para abrirla", () => {
    render(<BehaviorHelp />)

    const ayuda = screen.getByText("Ayuda: ¿qué puedo usar en el código?").closest("details")

    expect(ayuda).toBeInTheDocument()
    expect(ayuda).not.toHaveAttribute("open")
  })

  it.each([
    ["las secciones", SECCIONES],
    ["los métodos de api", METODOS_API],
    ["los campos del estado del juego", ESTADO_DEL_JUEGO],
    ["los puntos y vectores", PUNTOS_Y_VECTORES],
    ["las funciones disponibles", FUNCIONES],
  ])("Debería documentar %s", (_grupo, textos) => {
    render(<BehaviorHelp />)

    textos.forEach((texto) => {
      expect(screen.getByText(texto)).toBeInTheDocument()
    })
  })
})