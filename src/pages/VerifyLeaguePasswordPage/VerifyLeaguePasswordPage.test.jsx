// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom"

vi.mock("../../services/createhttpService", async (importOriginal) => {
  const original = await importOriginal()
  return { ...original, httpService: { post: vi.fn() } }
})

import { httpService, ApiError } from "../../services/createhttpService"
import VerifyLeaguePasswordPage from "./VerifyLeaguePasswordPage"

// Muestra el state que recibió la inscripción para poder comprobarlo
function JoinStub() {
  const { state } = useLocation()
  return <p>Inscripción token: {String(state?.joinToken)}</p>
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/leagues/5/verify-password"]}>
      <Routes>
        <Route path="/leagues" element={<h1>Listado</h1>} />
        <Route path="/leagues/:leagueId/join" element={<JoinStub />} />
        <Route path="/leagues/:leagueId/verify-password" element={<VerifyLeaguePasswordPage />} />
      </Routes>
    </MemoryRouter>
  )
}

async function confirmWith(password) {
  const user = userEvent.setup()
  if (password) await user.type(screen.getByLabelText("Contraseña"), password)
  await user.click(screen.getByRole("button", { name: "Confirmar" }))
}

describe("VerifyLeaguePasswordPage", () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(cleanup)

  it("no llama al endpoint si el campo está vacío", async () => {
    renderPage()
    await confirmWith("")
    expect(httpService.post).not.toHaveBeenCalled()
    expect(screen.getByText("La contraseña es obligatoria")).toBeTruthy()
  })

  it("con contraseña correcta va a la inscripción con el join_token", async () => {
    httpService.post.mockResolvedValue({ join_token: "abc" })
    renderPage()
    await confirmWith("secreta")
    expect(httpService.post).toHaveBeenCalledWith("/leagues/5/verify-password", { password: "secreta" })
    expect(await screen.findByText("Inscripción token: abc")).toBeTruthy()
  })

  it("con PASSWORD_INCORRECT muestra el error y limpia el campo", async () => {
    httpService.post.mockRejectedValue(new ApiError(401, "PASSWORD_INCORRECT", "mal"))
    renderPage()
    await confirmWith("mala")
    expect(await screen.findByText("La contraseña es incorrecta. Intentá de nuevo.")).toBeTruthy()
    expect(screen.getByLabelText("Contraseña").value).toBe("")
  })

  it("con LEAGUE_NOT_PRIVATE va a la inscripción sin token", async () => {
    httpService.post.mockRejectedValue(new ApiError(400, "LEAGUE_NOT_PRIVATE", "publica"))
    renderPage()
    await confirmWith("x")
    expect(await screen.findByText("Inscripción token: undefined")).toBeTruthy()
  })

  it("con NOT_FOUND vuelve al listado", async () => {
    httpService.post.mockRejectedValue(new ApiError(404, "NOT_FOUND", "no existe"))
    renderPage()
    await confirmWith("x")
    expect(await screen.findByText("Listado")).toBeTruthy()
  })

  it("con error de red muestra el mensaje y 'Reintentar'", async () => {
    httpService.post.mockRejectedValue(new TypeError("fail"))
    renderPage()
    await confirmWith("x")
    expect(await screen.findByRole("button", { name: "Reintentar" })).toBeTruthy()
  })

  it("Cancelar vuelve al listado sin llamar al endpoint", async () => {
    renderPage()
    await userEvent.setup().click(screen.getByRole("button", { name: "Cancelar" }))
    expect(screen.getByText("Listado")).toBeTruthy()
    expect(httpService.post).not.toHaveBeenCalled()
  })
})
