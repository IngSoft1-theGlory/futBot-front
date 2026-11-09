// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import "@testing-library/jest-dom/vitest"
import Fixture from "./Fixture"

const MI_EQUIPO = 5
const BOTON_ACCEDER = "Acceder al partido"

// Arma un partido del fixture tal como lo manda el backend.
// cambios: campos a reemplazar, por ejemplo { status: "FINISHED" }
// phome y paway (penales del local y del visitante) quedan en null: así llegan si no hubo penales
function armarPartido({
  match_id = 21,
  round = 1,
  status = "PENDING",
  team_host_id = MI_EQUIPO,
  team_host_name = "Los Pibes",
  team_away_id = 7,
  team_away_name = "Rival FC",
  home_goals = 0,
  away_goals = 0,
  phome = null,
  paway = null,
} = {}) {
  return {
    match_id,
    round_number: round,
    status,
    team_host: { team_id: team_host_id, team_name: team_host_name },
    team_away: { team_id: team_away_id, team_name: team_away_name },
    score: { home: home_goals, away: away_goals, phome, paway },
  }
}

// Pantalla de prueba: el fixture en "/" y una página falsa en la ruta del partido
function armarPantalla(fixture, teamId) {
  return (
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<Fixture fixture={fixture} teamId={teamId} />} />
        <Route path="/matches/21" element={<h1>Pantalla del partido 21</h1>} />
      </Routes>
    </MemoryRouter>
  )
}

function renderFixture(fixture, teamId = MI_EQUIPO) {
  // Prepara la simulación de interacciones de un usuario con la pantalla
  const user = userEvent.setup()
  const { rerender } = render(armarPantalla(fixture, teamId))

  // Simula que la página le pasa un fixture nuevo (por ejemplo, después de un evento del WS)
  function actualizarFixture(nuevoFixture) {
    rerender(armarPantalla(nuevoFixture, teamId))
  }

  return { user, actualizarFixture }
}

// Devuelve el bloque de una fecha, para buscar solo dentro de él
function bloqueDeFecha(numero) {
  return screen.getByRole("heading", { name: `Fecha ${numero}` }).parentElement
}

describe("Fixture", () => {
  afterEach(() => {
    cleanup()
  })

  describe("Partidos agrupados por fecha", () => {
    it("Debería mostrar cada partido dentro de su fecha", () => {
      renderFixture([
        armarPartido({ match_id: 1, round: 1, team_host_name: "Boca", team_away_name: "River" }),
        armarPartido({ match_id: 2, round: 2, team_host_name: "Racing", team_away_name: "Boca" }),
        armarPartido({ match_id: 3, round: 1, team_host_name: "Racing", team_away_name: "Huracán" }),
      ])

      const fecha1 = bloqueDeFecha(1)
      expect(within(fecha1).getByText("River")).toBeInTheDocument()
      expect(within(fecha1).getByText("Huracán")).toBeInTheDocument()

      const fecha2 = bloqueDeFecha(2)
      expect(within(fecha2).getByText("Racing")).toBeInTheDocument()
      expect(within(fecha2).queryByText("River")).not.toBeInTheDocument()
    })

    it("Debería ordenar las fechas de menor a mayor aunque lleguen desordenadas", () => {
      renderFixture([
        armarPartido({ match_id: 1, round: 3 }),
        armarPartido({ match_id: 2, round: 1 }),
        armarPartido({ match_id: 3, round: 2 }),
      ])

      const titulos = screen.getAllByRole("heading").map((titulo) => titulo.textContent)
      expect(titulos).toEqual(["Fecha 1", "Fecha 2", "Fecha 3"])
    })

    it("Debería mostrar los nombres del equipo local y visitante", () => {
      renderFixture([armarPartido()])

      expect(screen.getByText("Los Pibes")).toBeInTheDocument()
      expect(screen.getByText("Rival FC")).toBeInTheDocument()
    })

    it.each([
      ["PENDING", "Por jugar"],
      ["IN_PROGRESS", "En juego"],
      ["FINISHED", "Finalizado"],
    ])("Debería mostrar el estado %s como \"%s\"", (status, texto) => {
      renderFixture([armarPartido({ status })])

      expect(screen.getByText(texto)).toBeInTheDocument()
    })
  })

  describe("Resultado", () => {
    it("Debería mostrar el resultado final de un partido terminado", () => {
      renderFixture([armarPartido({ status: "FINISHED", home_goals: 2, away_goals: 1 })])

      expect(screen.getByText("2 - 1")).toBeInTheDocument()
    })

    it.each(["PENDING", "IN_PROGRESS"])(
      "Debería mostrar \"vs\" en vez de marcador si el partido está %s",
      (status) => {
        renderFixture([armarPartido({ status, home_goals: 1, away_goals: 0 })])

        expect(screen.getByText("vs")).toBeInTheDocument()
        expect(screen.queryByText("1 - 0")).not.toBeInTheDocument()
      }
    )
  })

  describe("Resultado con penales", () => {
    it("Debería mostrar los penales afuera del marcador, los del local a la izquierda", () => {
      renderFixture([
        armarPartido({ status: "FINISHED", home_goals: 0, away_goals: 0, phome: 2, paway: 1 }),
      ])

      expect(screen.getByText("(2) 0 - 0 (1)")).toBeInTheDocument()
    })

    it.each([
      ["el local", { phome: 0, paway: 3 }, "(0) 1 - 1 (3)"],
      ["el visitante", { phome: 4, paway: 0 }, "(4) 1 - 1 (0)"],
    ])("Debería mostrar los penales aunque %s no haya convertido ninguno", (_equipo, penales, texto) => {
      renderFixture([armarPartido({ status: "FINISHED", home_goals: 1, away_goals: 1, ...penales })])

      expect(screen.getByText(texto)).toBeInTheDocument()
    })

    it.each([
      ["vienen en null", { home: 1, away: 1, phome: null, paway: null }],
      ["no vienen", { home: 1, away: 1 }],
      ["vienen incompletos (solo los del local)", { home: 1, away: 1, phome: 2, paway: null }],
    ])("Debería mostrar solo los goles si los penales %s", (_descripcion, score) => {
      // se reemplaza el score entero para poder armar uno sin phome ni paway
      renderFixture([{ ...armarPartido({ status: "FINISHED" }), score }])

      expect(screen.getByText("1 - 1")).toBeInTheDocument()
    })

    it.each(["PENDING", "IN_PROGRESS"])(
      "Debería mostrar \"vs\" aunque vengan penales si el partido está %s",
      (status) => {
        renderFixture([armarPartido({ status, home_goals: 1, away_goals: 1, phome: 2, paway: 1 })])

        expect(screen.getByText("vs")).toBeInTheDocument()
        expect(screen.queryByText("(2) 1 - 1 (1)")).not.toBeInTheDocument()
      }
    )
  })

  describe("Botón para acceder al partido", () => {
    it("Debería mostrar el botón en el partido en juego del usuario y llevarlo a /matches/{matchId}", async () => {
      const { user } = renderFixture([armarPartido({ status: "IN_PROGRESS" })])

      await user.click(screen.getByRole("button", { name: BOTON_ACCEDER }))

      expect(screen.getByText("Pantalla del partido 21")).toBeInTheDocument()
    })

    it("Debería mostrar el botón también cuando el usuario juega de visitante", () => {
      renderFixture([
        armarPartido({ status: "IN_PROGRESS", team_host_id: 7, team_away_id: MI_EQUIPO }),
      ])

      expect(screen.getByRole("button", { name: BOTON_ACCEDER })).toBeInTheDocument()
    })

    it.each([
      ["el partido del usuario está por jugarse", { status: "PENDING" }],
      ["el partido del usuario ya terminó", { status: "FINISHED" }],
      ["el partido en juego es de otros equipos", { status: "IN_PROGRESS", team_host_id: 8, team_away_id: 9 }],
    ])("Debería no mostrar el botón si %s", (_descripcion, cambios) => {
      renderFixture([armarPartido(cambios)])

      expect(screen.queryByRole("button", { name: BOTON_ACCEDER })).not.toBeInTheDocument()
    })
  })

  describe("Fixture vacío", () => {
    it.each([
      ["una lista vacía", []],
      ["undefined", undefined],
      ["null", null],
    ])("Debería mostrar un mensaje si el fixture es %s", (_descripcion, fixture) => {
      renderFixture(fixture)

      expect(screen.getByText("Todavía no hay partidos en el fixture.")).toBeInTheDocument()
      expect(screen.queryByRole("listitem")).not.toBeInTheDocument()
    })
  })

  describe("Actualización", () => {
    it("Debería mostrar el botón cuando el partido del usuario empieza", () => {
      const { actualizarFixture } = renderFixture([armarPartido({ status: "PENDING" })])
      expect(screen.queryByRole("button", { name: BOTON_ACCEDER })).not.toBeInTheDocument()

      actualizarFixture([armarPartido({ status: "IN_PROGRESS" })])

      expect(screen.getByText("En juego")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: BOTON_ACCEDER })).toBeInTheDocument()
    })

    it("Debería mostrar el resultado y sacar el botón cuando el partido termina", () => {
      const { actualizarFixture } = renderFixture([armarPartido({ status: "IN_PROGRESS" })])

      actualizarFixture([armarPartido({ status: "FINISHED", home_goals: 3, away_goals: 2 })])

      expect(screen.getByText("Finalizado")).toBeInTheDocument()
      expect(screen.getByText("3 - 2")).toBeInTheDocument()
      expect(screen.queryByRole("button", { name: BOTON_ACCEDER })).not.toBeInTheDocument()
    })
  })
})
