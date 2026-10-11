import { describe, it, expect, afterEach } from "vitest"
import { render, screen, cleanup, act } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import SessionProvider from "./SessionProvider"
import { useSession } from "../hooks/useSession"
import { setSession, clearSession, expireSession } from "../services/session"

// Componente de prueba: muestra el estado de la sesión y permite iniciarla
function SessionStatus() {
  const { isAuthenticated, sessionExpired, startSession } = useSession()

  return (
    <div>
      <p>{isAuthenticated ? "Con sesión" : "Sin sesión"}</p>
      <p>{sessionExpired ? "Sesión vencida" : "Sesión no vencida"}</p>
      <button onClick={() => startSession({ token: "nuevo", tokenType: "Bearer", user: { user_id: 1 } })}>
        Iniciar sesión
      </button>
    </div>
  )
}

function renderWithSession() {
  setSession({ token: "viejo", tokenType: "Bearer", user: { user_id: 1 } })   // Arranca con sesión iniciada
  render(
    <SessionProvider>
      <SessionStatus />
    </SessionProvider>
  )
}

describe("SessionProvider", () => {
  afterEach(() => {
    cleanup()
    clearSession()
  })

  it("Cuando la sesión vence (401), la cierra y marca sessionExpired", () => {
    renderWithSession()
    expect(screen.getByText("Con sesión")).toBeTruthy()
    expect(screen.getByText("Sesión no vencida")).toBeTruthy()

    act(() => expireSession())   // Es lo que llama createHttpService ante un 401 de sesión

    expect(screen.getByText("Sin sesión")).toBeTruthy()
    expect(screen.getByText("Sesión vencida")).toBeTruthy()
  })

  it("Al volver a iniciar sesión, sessionExpired vuelve a false", async () => {
    renderWithSession()
    act(() => expireSession())

    await userEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }))

    expect(screen.getByText("Con sesión")).toBeTruthy()
    expect(screen.getByText("Sesión no vencida")).toBeTruthy()
  })
})
