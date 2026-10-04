// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import Pitch from "./Pitch"
import { FIELD_CONFIG } from "../../constants/fieldConfig"

const { length, width, goalWidth, goalDepth, centerCircleRadius, margin } = FIELD_CONFIG

const attr = (element, name) => Number(element.getAttribute(name))

afterEach(() => {
  cleanup()
})

describe("fieldConfig", () => {
  it("Debería coincidir con las dimensiones del motor del backend (pitch.py)", () => {
    expect(FIELD_CONFIG.length).toBe(105)
    expect(FIELD_CONFIG.width).toBe(60)
    expect(FIELD_CONFIG.goalWidth).toBe(7.32)
  })

  it("Debería ser inmutable", () => {
    expect(Object.isFrozen(FIELD_CONFIG)).toBe(true)
  })
})

describe("Pitch", () => {
  it("Debería renderizar la cancha como un SVG accesible", () => {
    render(<Pitch />)

    const svg = screen.getByRole("img", { name: "Cancha de fútbol" })
    expect(svg.tagName.toLowerCase()).toBe("svg")
  })

  it("Debería definir el viewBox en las unidades del juego, con margen alrededor", () => {
    render(<Pitch />)

    const svg = screen.getByRole("img", { name: "Cancha de fútbol" })
    expect(svg.getAttribute("viewBox")).toBe(
      `${-margin} ${-margin} ${length + 2 * margin} ${width + 2 * margin}`,
    )
  })

  it("Debería dibujar el césped cubriendo toda la cancha", () => {
    render(<Pitch />)

    const stripes = Array.from(screen.getByTestId("pitch-grass").querySelectorAll("rect"))
    const totalLength = stripes.reduce((sum, stripe) => sum + attr(stripe, "width"), 0)

    expect(stripes).toHaveLength(FIELD_CONFIG.grassStripes)
    expect(totalLength).toBeCloseTo(length)
    stripes.forEach((stripe) => expect(attr(stripe, "height")).toBe(width))
  })

  it("Debería dibujar el borde con las dimensiones de la cancha", () => {
    render(<Pitch />)

    const boundary = screen.getByTestId("pitch-boundary")
    expect(attr(boundary, "x")).toBe(0)
    expect(attr(boundary, "y")).toBe(0)
    expect(attr(boundary, "width")).toBe(length)
    expect(attr(boundary, "height")).toBe(width)
  })

  it("Debería dibujar la línea central en la mitad del largo, de lado a lado", () => {
    render(<Pitch />)

    const line = screen.getByTestId("pitch-halfway-line")
    expect(attr(line, "x1")).toBe(length / 2)
    expect(attr(line, "x2")).toBe(length / 2)
    expect(attr(line, "y1")).toBe(0)
    expect(attr(line, "y2")).toBe(width)
  })

  it("Debería dibujar el círculo central en el centro de la cancha", () => {
    render(<Pitch />)

    const circle = screen.getByTestId("pitch-center-circle")
    expect(attr(circle, "cx")).toBe(length / 2)
    expect(attr(circle, "cy")).toBe(width / 2)
    expect(attr(circle, "r")).toBe(centerCircleRadius)
  })

  it("Debería dibujar los dos arcos sobre las líneas de fondo, centrados y con el ancho configurado", () => {
    render(<Pitch />)

    const home = screen.getByTestId("pitch-goal-home")
    const away = screen.getByTestId("pitch-goal-away")
    const expectedTop = width / 2 - goalWidth / 2

    // Arco de HOME: detrás de la línea x = 0
    expect(attr(home, "x") + attr(home, "width")).toBe(0)
    expect(attr(home, "width")).toBe(goalDepth)
    // Arco de AWAY: detrás de la línea x = length
    expect(attr(away, "x")).toBe(length)
    expect(attr(away, "width")).toBe(goalDepth)

    for (const goal of [home, away]) {
      expect(attr(goal, "y")).toBeCloseTo(expectedTop)
      expect(attr(goal, "height")).toBe(goalWidth)
    }
  })

  it("No debería dibujar áreas ni marca de penal", () => {
    const { container } = render(<Pitch />)

    // Solo hay dos círculos (círculo central y punto central) y ningún arco de área
    expect(container.querySelectorAll("circle")).toHaveLength(2)
    expect(container.querySelectorAll("path")).toHaveLength(0)
    // Rects: fondo + franjas + borde + 2 arcos
    expect(container.querySelectorAll("rect")).toHaveLength(1 + FIELD_CONFIG.grassStripes + 1 + 2)
  })

  it("Debería renderizar los children dentro de la cancha con las coordenadas del juego, sin transformarlas", () => {
    render(
      <Pitch>
        <circle data-testid="ball" cx={52.5} cy={30} r={0.5} />
        <circle data-testid="player" cx={10} cy={45} r={1} />
      </Pitch>,
    )

    const content = screen.getByTestId("pitch-content")
    const ball = screen.getByTestId("ball")
    const player = screen.getByTestId("player")

    expect(content.contains(ball)).toBe(true)
    expect(content.contains(player)).toBe(true)
    expect(content.getAttribute("transform")).toBeNull()
    expect(attr(ball, "cx")).toBe(52.5)
    expect(attr(ball, "cy")).toBe(30)
    expect(attr(player, "cx")).toBe(10)
    expect(attr(player, "cy")).toBe(45)
  })

  it("Debería dibujar los children por encima de las líneas y los arcos", () => {
    render(
      <Pitch>
        <circle data-testid="ball" cx={0} cy={30} r={0.5} />
      </Pitch>,
    )

    const svg = screen.getByRole("img", { name: "Cancha de fútbol" })
    expect(svg.lastElementChild).toBe(screen.getByTestId("pitch-content"))
  })
})
