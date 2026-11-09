// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"

// ---------- Mocks ----------
// MatchScreenPage casi no tiene lógica: el hook consigue los datos y los componentes los dibujan.
// Se mockean el hook y los hijos, y se testea qué muestra la pantalla y qué props les pasa.

const { mockMatchHeader, mockMatchField, mockPauseMenu } = vi.hoisted(() => ({
  mockMatchHeader: vi.fn(),
  mockMatchField: vi.fn(),
  mockPauseMenu: vi.fn(),
}))

vi.mock("../../hooks/useMatchLive", () => ({ useMatchLive: vi.fn() }))

vi.mock("../../hooks/useSession", () => ({ useSession: () => ({ user: { team_id: 1 } }) }))

vi.mock("../../components/MatchHeader/MatchHeader", () => ({
  default: (props) => {
    mockMatchHeader(props)
    return <header data-testid="match-header" />
  },
}))

vi.mock("../../components/Pitch/Pitch", () => ({
  default: ({ children }) => <div data-testid="pitch">{children}</div>,
}))

// Un botón por jugador para simular que el usuario lo selecciona en la cancha
vi.mock("../../components/MatchField/MatchField", () => ({
  default: (props) => {
    mockMatchField(props)
    return (
      <div data-testid="match-field">
        {props.players.map((player) => (
          <button key={player.player_id} onClick={() => props.onSelectPlayer(player.player_id)}>
            {`Elegir ${player.name}`}
          </button>
        ))}
      </div>
    )
  },
}))

vi.mock("../../components/PlayerPanel/PlayerPanel", () => ({
  default: ({ player, onClose, canChangeBehavior, canSubstitute }) => (
    <aside data-testid="player-panel">
      <p>{`Panel de ${player.name}`}</p>
      {canChangeBehavior && <p>Puede cambiar el comportamiento</p>}
      {canSubstitute && <p>Puede planificar un cambio</p>}
      <p data-testid="panel-x">{player.position.x}</p>
      <button onClick={onClose}>Cerrar panel</button>
    </aside>
  ),
}))

vi.mock("../../components/PauseMenu/PauseMenu", () => ({
  default: (props) => {
    mockPauseMenu(props)
    return <section data-testid="pause-menu" />
  },
}))

import { useMatchLive } from "../../hooks/useMatchLive"
import MatchScreenPage from "./MatchScreenPage.jsx"

// ---------- Datos de prueba ----------

const TEAMS = {
  home: { id: 1, name: "alfajoresFC", logo: "logo-home" },
  away: { id: 2, name: "BocaJuniors", logo: "logo-away" },
}

const MESSI = { player_id: 101, team_id: 1, name: "Messi", number: 10, position: { x: 50, y: 28.5 } }
const RONALDO = { player_id: 205, team_id: 2, name: "Ronaldo", number: 7, position: { x: 70, y: 30 } }

const MATCH = {
  currentTick: 450,
  totalTicks: 1200,
  score: { home: 1, away: 0 },
  ball: { x: 52.4, y: 30.1 },
  players: [MESSI, RONALDO],
}

// ---------- Helpers ----------

function mockHook(overrides = {}) {
  useMatchLive.mockReturnValue({
    status: "ready",
    match: MATCH,
    teams: TEAMS,
    reconnecting: false,
    retry: vi.fn(),
    ...overrides,
  })
}

function pagina(matchId = "12") {
  return (
    <MemoryRouter initialEntries={[`/matches/${matchId}`]}>
      <Routes>
        <Route path="/matches/:matchId" element={<MatchScreenPage />} />
      </Routes>
    </MemoryRouter>
  )
}

// Simula que el hook devuelve datos nuevos (un tick, un corte...) y la pantalla se redibuja
function actualizarHook(resultado, overrides) {
  mockHook(overrides)
  resultado.rerender(pagina())
}

function elegirJugador(nombre) {
  fireEvent.click(screen.getByRole("button", { name: `Elegir ${nombre}` }))
}

const ultimasProps = (mock) => mock.mock.lastCall[0]

// ---------- Tests ----------

describe("MatchScreenPage", () => {
  beforeEach(() => {
    useMatchLive.mockReset()
    mockMatchHeader.mockClear()
    mockMatchField.mockClear()
    mockPauseMenu.mockClear()
    mockHook()
  })

  afterEach(() => {
    cleanup()
  })

  describe("Caso normal", () => {
    it("Debería mostrar el marcador, la cancha con jugadores y pelota, sin panel ni aviso de reconexión", () => {
      render(pagina("42"))

      expect(useMatchLive).toHaveBeenCalledWith("42")
      expect(ultimasProps(mockMatchHeader)).toEqual({
        homeTeam: TEAMS.home,
        awayTeam: TEAMS.away,
        score: MATCH.score,
        currentTick: 450,
        totalTicks: 1200,
        penalties: null,
        isPenalties: false,
      })
      expect(within(screen.getByTestId("pitch")).getByTestId("match-field")).toBeTruthy()
      expect(ultimasProps(mockMatchField)).toMatchObject({
        players: MATCH.players,
        ball: MATCH.ball,
        homeTeamId: 1,
        selectedPlayerId: null,
      })
      expect(screen.queryByTestId("player-panel")).toBeNull()
      expect(screen.queryByRole("status")).toBeNull()
    })

    it("Debería abrir el panel con el jugador seleccionado, cambiarlo al elegir otro y cerrarlo", () => {
      render(pagina())

      elegirJugador("Messi")
      expect(screen.getByText("Panel de Messi")).toBeTruthy()
      expect(ultimasProps(mockMatchField).selectedPlayerId).toBe(101)

      elegirJugador("Ronaldo")
      expect(screen.getByText("Panel de Ronaldo")).toBeTruthy()
      expect(screen.queryByText("Panel de Messi")).toBeNull()

      fireEvent.click(screen.getByRole("button", { name: "Cerrar panel" }))
      expect(screen.queryByTestId("player-panel")).toBeNull()
      expect(ultimasProps(mockMatchField).selectedPlayerId).toBeNull()
    })

    it("Debería permitir cambiar el comportamiento solo de los jugadores del propio equipo", () => {
      render(pagina())

      elegirJugador("Messi")
      expect(screen.getByText("Puede cambiar el comportamiento")).toBeTruthy()

      elegirJugador("Ronaldo")
      expect(screen.queryByText("Puede cambiar el comportamiento")).toBeNull()
    })
  })

  describe("Planificar un cambio", () => {
    it("Debería permitir planificar un cambio solo de los jugadores del propio equipo", () => {
      render(pagina())

      elegirJugador("Messi")
      expect(screen.getByText("Puede planificar un cambio")).toBeTruthy()

      elegirJugador("Ronaldo")
      expect(screen.queryByText("Puede planificar un cambio")).toBeNull()
    })

    it.each([
      ["en una pausa", { pause: { type: "HALF_TIME", remainingSeconds: 25 } }],
      ["en los penales", { isPenalties: true }],
    ])("Debería no permitir planificar un cambio %s", (_caso, cambios) => {
      mockHook({ match: { ...MATCH, ...cambios } })
      render(pagina())

      elegirJugador("Messi")

      expect(screen.queryByText("Puede planificar un cambio")).toBeNull()
    })
  })

  describe("Casos borde", () => {
    it.each([
      { status: "loading", mensaje: "Cargando partido...", reintentar: false, volver: false },
      {
        status: "connection-error",
        mensaje: "Error al no poder iniciar el partido por falla en la conexión",
        reintentar: true,
        volver: false,
      },
      { status: "not-participant", mensaje: "No participás en este partido.", reintentar: false, volver: true },
      { status: "not-found", mensaje: "El partido no existe.", reintentar: false, volver: true },
    ])(
      "Debería mostrar solo el mensaje y las opciones que corresponden cuando el estado es $status",
      ({ status, mensaje, reintentar, volver }) => {
        mockHook({ status, match: null, teams: null })
        render(pagina())

        expect(screen.getByText(mensaje)).toBeTruthy()
        expect(screen.queryByTestId("match-header")).toBeNull()
        expect(screen.queryByTestId("match-field")).toBeNull()
        expect(!!screen.queryByRole("button", { name: "Reintentar" })).toBe(reintentar)
        expect(!!screen.queryByRole("link", { name: "Volver al inicio" })).toBe(volver)
      }
    )

    it("Debería llamar a retry y ofrecer volver al inicio con la ruta correcta", () => {
      const retry = vi.fn()
      mockHook({ status: "connection-error", match: null, teams: null, retry })
      const { unmount } = render(pagina())

      fireEvent.click(screen.getByRole("button", { name: "Reintentar" }))
      expect(retry).toHaveBeenCalledTimes(1)
      unmount()

      mockHook({ status: "not-found", match: null, teams: null })
      render(pagina())
      expect(screen.getByRole("link", { name: "Volver al inicio" }).getAttribute("href")).toBe("/")
    })

    it.each([
      { caso: "no hay datos del partido", overrides: { match: null } },
      { caso: "no hay datos de los equipos", overrides: { teams: null } },
    ])("Debería no dibujar nada cuando el estado es ready pero $caso", ({ overrides }) => {
      mockHook(overrides)
      const { container } = render(pagina())

      expect(container.innerHTML).toBe("")
    })

    it("Debería mostrar Reconectando… arriba del marcador sin borrar el estado, y sacarlo al reconectar", () => {
      mockHook({ reconnecting: true })
      const resultado = render(pagina())

      const aviso = screen.getByRole("status")
      expect(aviso.textContent).toBe("Reconectando…")
      expect(aviso.compareDocumentPosition(screen.getByTestId("match-header")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(ultimasProps(mockMatchHeader).score).toEqual(MATCH.score)
      expect(screen.getByTestId("match-field")).toBeTruthy()

      actualizarHook(resultado, { reconnecting: false })
      expect(screen.queryByRole("status")).toBeNull()
      expect(screen.getByTestId("match-header")).toBeTruthy()
    })

    it("Debería mantener el panel abierto con los datos más recientes del jugador tras un tick y un corte", () => {
      const resultado = render(pagina())
      elegirJugador("Messi")
      expect(screen.getByTestId("panel-x").textContent).toBe("50")

      actualizarHook(resultado, {
        reconnecting: true,
        match: { ...MATCH, players: [{ ...MESSI, position: { x: 60, y: 31 } }, RONALDO] },
      })

      expect(screen.getByText("Panel de Messi")).toBeTruthy()
      expect(screen.getByTestId("panel-x").textContent).toBe("60")
    })

    it("Debería cerrar el panel si el jugador seleccionado ya no está en la cancha", () => {
      const resultado = render(pagina())
      elegirJugador("Messi")

      actualizarHook(resultado, { match: { ...MATCH, players: [RONALDO] } })

      expect(screen.queryByTestId("player-panel")).toBeNull()
    })
  })

  describe("Pausas", () => {
    it("Debería no mostrar el menú de pausa cuando el partido está en juego", () => {
      mockHook({ match: { ...MATCH, pause: null } })
      render(pagina())

      expect(screen.queryByTestId("pause-menu")).toBeNull()
    })

    it("Debería mostrar el menú con los datos de la pausa, sin dejar de mostrar el marcador ni la cancha", () => {
      const substitutePlayer = vi.fn()
      const updatePlayerBehavior = vi.fn()
      const pause = { type: "HALF_TIME", remainingSeconds: 25 }
      const substitutes = [{ player_id: 105, team_id: 1, name: "Nico González", number: 15 }]
      mockHook({ match: { ...MATCH, pause, substitutes }, substitutePlayer, updatePlayerBehavior })
      render(pagina("42"))

      expect(ultimasProps(mockPauseMenu)).toEqual({
        matchId: 42,
        teamId: 1,
        pause,
        players: MATCH.players,
        substitutes,
        onSubstituted: substitutePlayer,
        onBehaviorChanged: updatePlayerBehavior,
      })
      expect(ultimasProps(mockMatchHeader).score).toEqual(MATCH.score)
      expect(screen.getByTestId("match-field")).toBeTruthy()
    })

    it("Debería actualizar la cuenta regresiva y ocultar el menú cuando se reanuda el partido", () => {
      mockHook({ match: { ...MATCH, pause: { type: "HALF_TIME", remainingSeconds: 25 } } })
      const resultado = render(pagina())

      actualizarHook(resultado, { match: { ...MATCH, pause: { type: "HALF_TIME", remainingSeconds: 24 } } })
      expect(ultimasProps(mockPauseMenu).pause.remainingSeconds).toBe(24)

      actualizarHook(resultado, { match: { ...MATCH, pause: null } })
      expect(screen.queryByTestId("pause-menu")).toBeNull()
    })

    it("Debería mostrar el error y no el menú si el usuario no participa en el partido", () => {
      mockHook({ status: "not-participant", match: null, teams: null })
      render(pagina())

      expect(screen.getByRole("alert").textContent).toBe("No participás en este partido.")
      expect(screen.queryByTestId("pause-menu")).toBeNull()
    })
  })
})