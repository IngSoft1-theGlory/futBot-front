import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup, within } from "@testing-library/react"
import "@testing-library/jest-dom/vitest"
import DataTable from "./DataTable"

const columns = [
  { key: "teamName", label: "Equipo" },
  { key: "points", label: "Puntos", align: "right" },
]

const rows = [
  { teamId: 1, teamName: "Boca", points: 10 },
  { teamId: 2, teamName: "River", points: 7 },
  { teamId: 3, teamName: "Racing", points: 4 },
]

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("DataTable", () => {
  describe("Render", () => {
    it("Debería mostrar los títulos de las columnas", () => {
      render(<DataTable columns={columns} rows={rows} rowKey="teamId" />)

      expect(screen.getByRole("columnheader", { name: "Equipo" })).toBeInTheDocument()
      expect(screen.getByRole("columnheader", { name: "Puntos" })).toBeInTheDocument()
    })

    it("Debería mostrar una fila por cada elemento de rows, con sus valores", () => {
      render(<DataTable columns={columns} rows={rows} rowKey="teamId" />)

      const bodyRows = within(screen.getAllByRole("rowgroup")[1]).getAllByRole("row")
      expect(bodyRows).toHaveLength(3)
      expect(within(bodyRows[0]).getByText("Boca")).toBeInTheDocument()
      expect(within(bodyRows[0]).getByText("10")).toBeInTheDocument()
      expect(within(bodyRows[2]).getByText("Racing")).toBeInTheDocument()
    })

    it("Debería usar una tabla HTML de verdad", () => {
      const { container } = render(<DataTable columns={columns} rows={rows} rowKey="teamId" />)

      expect(container.querySelector("table")).toBeInTheDocument()
      expect(container.querySelector("thead")).toBeInTheDocument()
      expect(container.querySelector("tbody")).toBeInTheDocument()
    })

    it("Debería alinear las celdas según align, y a la izquierda si no tiene", () => {
      render(<DataTable columns={columns} rows={rows} rowKey="teamId" />)

      expect(screen.getByRole("columnheader", { name: "Puntos" })).toHaveClass("data-table__cell--right")
      expect(screen.getByText("10")).toHaveClass("data-table__cell--right")
      expect(screen.getByText("Boca")).toHaveClass("data-table__cell--left")
    })
  })

  describe("render de columna", () => {
    it("Debería usar render cuando la columna lo tiene", () => {
      const columnsWithRender = [
        {
          key: "teamName",
          label: "Equipo",
          render: (row) => <strong>Club {row.teamName}</strong>,
        },
      ]
      render(<DataTable columns={columnsWithRender} rows={rows} rowKey="teamId" />)

      expect(screen.getByText("Club Boca").tagName).toBe("STRONG")
      expect(screen.queryByText("Boca")).not.toBeInTheDocument()
    })

    it("Debería pasarle a render la posición de la fila (empezando en 0)", () => {
      const columnsWithPosition = [
        { key: "position", label: "#", render: (_row, index) => index + 1 },
        { key: "teamName", label: "Equipo" },
      ]
      render(<DataTable columns={columnsWithPosition} rows={rows} rowKey="teamId" />)

      const bodyRows = within(screen.getAllByRole("rowgroup")[1]).getAllByRole("row")
      expect(within(bodyRows[0]).getByText("1")).toBeInTheDocument()
      expect(within(bodyRows[2]).getByText("3")).toBeInTheDocument()
    })
  })

  describe("Fila resaltada", () => {
    it("Debería resaltar solo la fila indicada en highlightedRowKey", () => {
      render(<DataTable columns={columns} rows={rows} rowKey="teamId" highlightedRowKey={2} />)

      expect(screen.getByText("River").closest("tr")).toHaveClass("data-table__row--highlighted")
      expect(screen.getByText("Boca").closest("tr")).not.toHaveClass("data-table__row--highlighted")
      expect(screen.getByText("Racing").closest("tr")).not.toHaveClass("data-table__row--highlighted")
    })

    it("Debería no resaltar ninguna fila si no se pasa highlightedRowKey", () => {
      const { container } = render(<DataTable columns={columns} rows={rows} rowKey="teamId" />)

      expect(container.querySelector(".data-table__row--highlighted")).not.toBeInTheDocument()
    })
  })

  describe("Sin filas", () => {
    it("Debería mostrar el mensaje por defecto cuando rows está vacío", () => {
      render(<DataTable columns={columns} rows={[]} rowKey="teamId" />)

      expect(screen.getByText("No hay datos para mostrar")).toBeInTheDocument()
      expect(screen.getByRole("columnheader", { name: "Equipo" })).toBeInTheDocument()
    })

    it("Debería mostrar emptyMessage cuando se lo pasan", () => {
      render(
        <DataTable columns={columns} rows={[]} rowKey="teamId" emptyMessage="Todavía no hay equipos" />
      )

      expect(screen.getByText("Todavía no hay equipos")).toBeInTheDocument()
      expect(screen.queryByText("No hay datos para mostrar")).not.toBeInTheDocument()
    })

    it("Debería ocupar todo el ancho de la tabla con el mensaje vacío", () => {
      render(<DataTable columns={columns} rows={[]} rowKey="teamId" />)

      expect(screen.getByText("No hay datos para mostrar")).toHaveAttribute("colspan", "2")
    })

    it("Debería no mostrar el mensaje vacío cuando hay filas", () => {
      render(<DataTable columns={columns} rows={rows} rowKey="teamId" />)

      expect(screen.queryByText("No hay datos para mostrar")).not.toBeInTheDocument()
    })
  })

  it("Debería no hacer pedidos al backend", () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    render(<DataTable columns={columns} rows={rows} rowKey="teamId" />)

    expect(fetchMock).not.toHaveBeenCalled()
  })
})
