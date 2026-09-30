// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Routes, Route } from "react-router-dom"

const mockLogout = vi.fn()
let mockUser = null

vi.mock("../../hooks/useSession", () => ({
  useSession: () => ({ user: mockUser, logout: mockLogout }),
}))

import HomePage from "./HomePage"

// Rutas a las que redirige cada botón de la home
const DESTINOS = [
  { boton: "Crear liga", ruta: "/leagues/new" },
  { boton: "Unirse a una liga", ruta: "/leagues" },
  { boton: "Crear amistoso", ruta: "/friendlies/new" },
  { boton: "Unirse a un amistoso", ruta: "/friendlies" },
  { boton: "Jugadores", ruta: "/players" },
  { boton: "Ver comportamientos", ruta: "/behaviors" },
]

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        {DESTINOS.map(({ ruta }) => (
          <Route key={ruta} path={ruta} element={<h1>Pantalla {ruta}</h1>} />
        ))}
      </Routes>
    </MemoryRouter>
  )
}

function boton(nombre) {
  return screen.getByRole("button", { name: nombre })
}

describe("HomePage", () => {
  beforeEach(() => {
    mockUser = { user_id: 1, team_id: 1, username: "Maradona10", email: "diego@famaf.unc.edu.ar" }
    mockLogout.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  describe("Interfaz", () => {
    it("Muestra el nombre del usuario en la barra superior y en el saludo", () => {
      renderPage()

      expect(screen.getAllByText("Maradona10")).toHaveLength(2)
      expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Hola, Maradona10")
    })

    it("El avatar muestra la inicial del usuario en mayúscula", () => {
      mockUser = { ...mockUser, username: "diego" }
      renderPage()

      expect(document.querySelector(".home-topbar__avatar").textContent).toBe("D")
    })

    it("Si no hay datos del usuario, muestra un nombre por defecto", () => {
      mockUser = null
      renderPage()

      expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Hola, jugador")
      expect(document.querySelector(".home-topbar__avatar").textContent).toBe("?")
    })

    it("Muestra las secciones Jugar y Mi equipo con sus tarjetas", () => {
      renderPage()

      expect(screen.getByRole("heading", { name: "Jugar" })).toBeTruthy()
      expect(screen.getByRole("heading", { name: "Mi equipo" })).toBeTruthy()
      for (const titulo of ["Ligas", "Amistosos", "Jugadores", "Comportamientos"]) {
        expect(screen.getByRole("heading", { name: titulo })).toBeTruthy()
      }
    })

    it("No lista comportamientos, solo muestra el acceso a su pantalla", () => {
      renderPage()

      expect(document.querySelector(".behavior-grid")).toBeNull()
      expect(boton("Ver comportamientos")).toBeTruthy()
    })
  })

  describe("Navegación", () => {
    it.each(DESTINOS)('El botón "$boton" redirige a $ruta', async ({ boton: nombre, ruta }) => {
      const user = userEvent.setup()
      renderPage()

      await user.click(boton(nombre))

      expect(screen.getByText(`Pantalla ${ruta}`)).toBeTruthy()
    })
  })

  describe("Cerrar sesión", () => {
    it("Al presionar Cerrar sesión llama a logout", async () => {
      mockLogout.mockResolvedValue()
      const user = userEvent.setup()
      renderPage()

      await user.click(boton("Cerrar sesión"))

      expect(mockLogout).toHaveBeenCalledTimes(1)
    })

    it("Mientras se cierra la sesión, el botón queda en carga y no permite un segundo clic", async () => {
      mockLogout.mockReturnValue(new Promise(() => {}))
      const user = userEvent.setup()
      renderPage()

      await user.click(boton("Cerrar sesión"))
      await user.click(boton("Cerrar sesión"))

      expect(boton("Cerrar sesión").disabled).toBe(true)
      expect(mockLogout).toHaveBeenCalledTimes(1)
    })
  })
})
