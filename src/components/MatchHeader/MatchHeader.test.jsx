// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import "@testing-library/jest-dom/vitest"
import MatchHeader, { formatClock } from "./MatchHeader"

const homeTeam = { name: "Boca", logo: "data:image/png;base64,AAAA" }
const awayTeam = { name: "River", logo: "data:image/png;base64,BBBB" }
const score = { home: 2, away: 1 }

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("formatClock", () => {
  it.each([
    [0, 240, "00:00"],
    [1, 240, "00:00"],
    [2, 240, "00:01"],
    [125, 240, "01:02"],
    [240, 240, "02:00"],
    [999, 240, "02:00"],
    [-5, 240, "00:00"],
    [undefined, 240, "00:00"],
    [300, 600, "02:30"],
    [600, 600, "05:00"],
  ])("Debería mostrar el tick %s de %s como %s", (tick, total, esperado) => {
    expect(formatClock(tick, total)).toBe(esperado)
  })
})

describe("MatchHeader", () => {
  const renderHeader = (props = {}) =>
    render(
      <MatchHeader
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        score={score}
        currentTick={125}
        totalTicks={240}
        {...props}
      />
    )

  it("Debería mostrar los nombres de ambos equipos", () => {
    renderHeader()
    expect(screen.getByText("Boca")).toBeInTheDocument()
    expect(screen.getByText("River")).toBeInTheDocument()
  })

  it("Debería mostrar los logos de ambos equipos", () => {
    renderHeader()
    expect(screen.getByAltText("Logo de Boca")).toHaveAttribute("src", homeTeam.logo)
    expect(screen.getByAltText("Logo de River")).toHaveAttribute("src", awayTeam.logo)
  })

  it("Debería mostrar el marcador con score.home y score.away", () => {
    renderHeader()
    expect(screen.getByText("2 - 1")).toBeInTheDocument()
  })

  it("Debería mostrar los goles de penales a los costados del marcador", () => {
    const { container } = renderHeader({ score: { home: 0, away: 0 }, penalties: { home: 1, away: 0 } })
    expect(container.querySelector(".match-header__score").textContent).toBe("(1) 0 - 0 (0)")
  })

  it("Debería mostrar 'En Penales' en lugar del reloj durante la tanda", () => {
    renderHeader({ isPenalties: true })
    expect(screen.getByText("En Penales")).toBeInTheDocument()
    expect(screen.queryByText("01:02")).not.toBeInTheDocument()
  })

  it("Debería mostrar el reloj calculado a partir de current_tick", () => {
    renderHeader()
    expect(screen.getByText("01:02")).toBeInTheDocument()
  })

  it("Debería actualizar marcador y reloj al cambiar las props, sin recargar", () => {
    const { rerender } = renderHeader()
    expect(screen.getByText("01:02")).toBeInTheDocument()

    rerender(
      <MatchHeader
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        score={{ home: 3, away: 1 }}
        currentTick={240}
        totalTicks={240}
      />
    )

    expect(screen.getByText("3 - 1")).toBeInTheDocument()
    expect(screen.getByText("02:00")).toBeInTheDocument()
  })

  it("Debería no dibujar el logo si el equipo no tiene logo", () => {
    renderHeader({ homeTeam: { name: "Boca", logo: null } })
    expect(screen.queryByAltText("Logo de Boca")).not.toBeInTheDocument()
    expect(screen.getByText("Boca")).toBeInTheDocument()
  })

  it.each([
    ["homeTeam", { homeTeam: undefined }],
    ["awayTeam", { awayTeam: undefined }],
    ["score", { score: undefined }],
  ])("Debería no dibujar nada si falta %s", (_nombre, props) => {
    const { container } = renderHeader(props)
    expect(container).toBeEmptyDOMElement()
  })

  it("Debería no hacer pedidos al backend", () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    renderHeader()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})