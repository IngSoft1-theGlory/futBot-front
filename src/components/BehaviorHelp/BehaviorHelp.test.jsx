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

// Primitivas del DT junto con una parte de su descripción corta
const PRIMITIVAS_DT = [
  ["api.change_behavior(player_id, behavior_id)", /predeterminados o propios/],
  ["api.substitute(player_out_id, player_in_id)", /solo durante una pausa/],
  ["api.get_current_tick()", /tick/],
  ["api.get_pause_type()", /"HALF_TIME".*"COOLING_BREAK".*None/],
  ["api.get_starters()", /titulares, en orden de alineación/],
  ["api.get_substitutes()", /suplentes, en orden de alineación/],
]

describe("BehaviorHelp", () => {
  afterEach(() => {
    cleanup()
  })

  it("Debería mostrarse cerrada al principio, con un resumen para abrirla", () => {
    render(<BehaviorHelp behaviorType="PLAYER" />)

    const ayuda = screen.getByText("Ayuda: ¿qué puedo usar en el código?").closest("details")

    expect(ayuda).toBeInTheDocument()
    expect(ayuda).not.toHaveAttribute("open")
  })

  describe("Comportamiento de jugador", () => {
    it.each([
      ["las secciones", SECCIONES],
      ["los métodos de api", METODOS_API],
      ["los campos del estado del juego", ESTADO_DEL_JUEGO],
      ["los puntos y vectores", PUNTOS_Y_VECTORES],
      ["las funciones disponibles", FUNCIONES],
    ])("Debería documentar %s", (_grupo, textos) => {
      render(<BehaviorHelp behaviorType="PLAYER" />)

      textos.forEach((texto) => {
        expect(screen.getByText(texto)).toBeInTheDocument()
      })
    })

    it("No debería mostrar las primitivas del DT", () => {
      render(<BehaviorHelp behaviorType="PLAYER" />)

      PRIMITIVAS_DT.forEach(([primitiva]) => {
        expect(screen.queryByText(primitiva)).not.toBeInTheDocument()
      })
    })

    // Si el back no mandó el tipo, se muestra la ayuda de siempre (la del jugador)
    it("Debería mostrar la ayuda del jugador si no se indica el tipo", () => {
      render(<BehaviorHelp />)

      expect(screen.getByText("api.kick_ball(direccion, potencia)")).toBeInTheDocument()
      expect(screen.queryByText("api.substitute(player_out_id, player_in_id)")).not.toBeInTheDocument()
    })
  })

  describe("Comportamiento de DT", () => {
    // Cada primitiva está en un <li> que también tiene su descripción corta
    it.each(PRIMITIVAS_DT)("Debería listar %s con su descripción", (primitiva, descripcion) => {
      render(<BehaviorHelp behaviorType="COACH" />)

      const item = screen.getByText(primitiva).closest("li")

      expect(item).toHaveTextContent(descripcion)
    })

    it("No debería mostrar las secciones ni los métodos del jugador", () => {
      render(<BehaviorHelp behaviorType="COACH" />)

      const textosDelJugador = [...SECCIONES, ...METODOS_API]
      textosDelJugador.forEach((texto) => {
        expect(screen.queryByText(texto)).not.toBeInTheDocument()
      })
    })

    it("Debería avisar que un fallo no se avisa y que los cambios rigen desde el próximo partido", () => {
      render(<BehaviorHelp behaviorType="COACH" />)

      expect(screen.getByText(/on_tick\(api\)/).closest("li")).toHaveTextContent(/sin bucles ni imports/)
      expect(screen.getByText(/si el código falla o no carga, el partido se juega igual y no se avisa/i)).toBeInTheDocument()
      expect(screen.getByText(/los cambios rigen desde el próximo partido/i)).toBeInTheDocument()
    })
  })
})