import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react"
import PlayerPanel from "./PlayerPanel"
import { httpService } from "../../services/createhttpService"

vi.mock("../../services/createhttpService", () => ({
  httpService: { get: vi.fn() },
}))

const attributes = { power: 80, agility: 70, control: 60, speed: 50, strength: 40 }
const ownPlayer = {
  player_id: 1, team_id: 1, name: "Messi", number: 10, attributes, behavior_id: 7,
}
const rivalPlayer = {
  player_id: 2, team_id: 2, name: "Ronaldo", number: 9, attributes, behavior_id: null,
}

beforeEach(() => {
  httpService.get.mockReset()
  httpService.get.mockResolvedValue({ name: "Defensivo" })
})

afterEach(() => {
  cleanup()
})

describe("PlayerPanel", () => {
  it("Debería mostrar nombre, número y atributos del jugador", () => {
    render(<PlayerPanel player={rivalPlayer} onClose={() => {}} />)
    expect(screen.getByText("#9 Ronaldo")).toBeTruthy()
    expect(screen.getByText("Potencia")).toBeTruthy()
    expect(screen.getByText("80")).toBeTruthy()
    expect(screen.getByText("Agilidad")).toBeTruthy()
    expect(screen.getByText("70")).toBeTruthy()
    expect(screen.getByText("Control")).toBeTruthy()
    expect(screen.getByText("60")).toBeTruthy()
    expect(screen.getByText("Velocidad")).toBeTruthy()
    expect(screen.getByText("50")).toBeTruthy()
    expect(screen.getByText("Fuerza")).toBeTruthy()
    expect(screen.getByText("40")).toBeTruthy()
  })

  it("Debería mostrar 'Sin información' y no consultar nada si es rival", () => {
    render(<PlayerPanel player={rivalPlayer} onClose={() => {}} />)
    expect(screen.getByText("Sin información")).toBeTruthy()
    expect(screen.queryByRole("alert")).toBeNull()
    expect(httpService.get).not.toHaveBeenCalled()
  })

  it("Debería mostrar 'Cargando...' y luego el nombre del comportamiento si es propio", async () => {
    httpService.get.mockResolvedValue({ name: "Defensivo" })
    render(<PlayerPanel player={ownPlayer} onClose={() => {}} />)

    expect(screen.getByText("Cargando...")).toBeTruthy()
    expect(await screen.findByText("Defensivo")).toBeTruthy()
    expect(screen.queryByText("Cargando...")).toBeNull()
    expect(httpService.get).toHaveBeenCalledWith("/behaviors/7")
  })

  it("Debería mostrar un aviso dentro del panel si falla la consulta, sin cerrarlo", async () => {
    httpService.get.mockRejectedValue(new Error("falló"))
    render(<PlayerPanel player={ownPlayer} onClose={() => {}} />)

    expect(await screen.findByRole("alert")).toBeTruthy()
    expect(screen.getByText("#10 Messi")).toBeTruthy()
    expect(screen.getByText("Potencia")).toBeTruthy()
  })

  it("Debería actualizar el panel al seleccionar otro jugador", async () => {
    httpService.get.mockResolvedValue({ name: "Defensivo" })
    const { rerender } = render(<PlayerPanel player={ownPlayer} onClose={() => {}} />)
    expect(await screen.findByText("Defensivo")).toBeTruthy()

    rerender(<PlayerPanel player={rivalPlayer} onClose={() => {}} />)

    await waitFor(() => expect(screen.getByText("#9 Ronaldo")).toBeTruthy())
    expect(screen.getByText("Sin información")).toBeTruthy()
    expect(screen.queryByText("Defensivo")).toBeNull()
  })

  it("Debería llamar a onClose al hacer clic en cerrar", () => {
    const onClose = vi.fn()
    render(<PlayerPanel player={rivalPlayer} onClose={onClose} />)
    fireEvent.click(screen.getByRole("button", { name: "Cerrar panel" }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("Debería avisar que no se pueden hacer cambios durante los penales, en lugar de ofrecer el cambio", async () => {
    render(<PlayerPanel player={ownPlayer} onClose={() => {}} matchId={12} canChangeBehavior isPenalties />)
    await screen.findByText("Defensivo")

    expect(screen.getByText("No se pueden hacer cambios durante los penales")).toBeTruthy()
    expect(screen.getAllByRole("button").length).toBe(1) // solo el de cerrar
  })

  it("Debería no ofrecer acciones de edición", async () => {
    httpService.get.mockResolvedValue({ name: "Defensivo" })
    const { container } = render(<PlayerPanel player={ownPlayer} onClose={() => {}} />)
    await screen.findByText("Defensivo")

    expect(container.querySelectorAll("input, textarea, select").length).toBe(0)
    expect(screen.getAllByRole("button").length).toBe(1)
  })

  it("Debería no consultar el estado del partido", async () => {
    httpService.get.mockResolvedValue({ name: "Defensivo" })
    render(<PlayerPanel player={ownPlayer} onClose={() => {}} />)
    await screen.findByText("Defensivo")

    const urls = httpService.get.mock.calls.map(([url]) => url)
    expect(urls.some((url) => url.includes("/state"))).toBe(false)
  })

  it("Debería ofrecer planificar un cambio solo si la pantalla lo permite", async () => {
    const { rerender } = render(<PlayerPanel player={ownPlayer} onClose={() => {}} matchId={12} canSubstitute />)
    await screen.findByText("Defensivo")
    expect(screen.getByRole("button", { name: "Planificar cambio" })).toBeTruthy()

    rerender(<PlayerPanel player={ownPlayer} onClose={() => {}} matchId={12} canSubstitute={false} />)
    expect(screen.queryByRole("button", { name: "Planificar cambio" })).toBeNull()
  })

  it("Debería no dibujar nada si no hay jugador seleccionado", () => {
    const { container } = render(<PlayerPanel player={null} onClose={() => {}} />)
    expect(container.innerHTML).toBe("")
  })
})