import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom/vitest"
import BehaviorCard from "./BehaviorCard"

const mockBehavior = {
  behavior_id: 7,
  name: "Atacar arco",
  description: "El jugador corre hacia adelante y patea la pelota",
  code: "def on_tick(api): pass",
  is_default: true,
}

describe("BehaviorCard", () => {
  const mockOnSelect = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  describe("Render", () => {
    it("Debería mostrar nombre y descripción, sin mostrar el código", () => {
      render(<BehaviorCard behavior={mockBehavior} onSelect={mockOnSelect} />)

      expect(screen.getByText("Atacar arco")).toBeInTheDocument()
      expect(screen.getByText(mockBehavior.description)).toBeInTheDocument()
      expect(screen.getByTitle(mockBehavior.description)).toBeInTheDocument()
      expect(screen.queryByText(/def on_tick/)).not.toBeInTheDocument()
    })

    it("Debería mostrar la etiqueta 'Por default' solo en los comportamientos por default", () => {
      const { rerender } = render(<BehaviorCard behavior={mockBehavior} onSelect={mockOnSelect} />)
      expect(screen.getByText("Por default")).toBeInTheDocument()

      // rerender del mismo componente con otras props
      rerender(<BehaviorCard behavior={{ ...mockBehavior, is_default: false }} onSelect={mockOnSelect} />)
      expect(screen.queryByText("Por default")).not.toBeInTheDocument()
    })
  })

  describe("Interacciones", () => {
    it("Debería llamar a onSelect con el behavior_id al hacer click", async () => {
      render(<BehaviorCard behavior={mockBehavior} onSelect={mockOnSelect} />)

      await userEvent.click(screen.getByRole("button"))

      expect(mockOnSelect).toHaveBeenCalledTimes(1)
      expect(mockOnSelect).toHaveBeenCalledWith(7)
    })
  })
})