import { useEffect, useState } from "react"
import { useParams, useNavigate, Link, Navigate } from "react-router-dom"
import { httpService, ApiError } from "../../services/createhttpService"
import { useSession } from "../../hooks/useSession"
import { useGlobalEvent } from "../../hooks/useGlobalEvent"
import { useLeagueInProgressEvents } from "../../hooks/useLeagueInProgressEvents"
import LeagueInProgressView from "./LeagueInProgressView"
import ConfirmButton from "../../components/ConfirmButton/ConfirmButton"
import Button from "../../components/Button/Button"
import "./LeagueLobbyPage.css"

const NETWORK_ERROR_MESSAGE =
  "No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo."

const LEAGUE_CANCELLED_MESSAGE = "La liga fue cancelada por el anfitrión."

const STATUS_LABELS = {
  PENDING: "Esperando equipos",
  IN_PROGRESS: "En curso",
  FINISHED: "Finalizada",
}

function getErrorsMessages(err) {
  if (err instanceof ApiError) {
    return err.message
  }
  return NETWORK_ERROR_MESSAGE
}

// status: "loading" | "ready" | "forbidden" | "error"
function useLeagueLobby(leagueId) {
  const [league, setLeague] = useState(null)
  const [status, setStatus] = useState("loading")
  const [error, setError] = useState(null)

  useEffect(() => {
    let isActive = true
    setStatus("loading")

    httpService
      .get(`/leagues/${leagueId}`)
      .then((data) => {
        if (!isActive) return
        setLeague(data)
        setStatus("ready")
      })
      .catch((err) => {
        if (!isActive) return

        if (err instanceof ApiError) {
          if (err.status === 401) return // la gestión de sesión se encarga
          if (err.status === 403) {
            setStatus("forbidden") // no pertenece a la liga privada
            return
          }
          if (err.status === 404) {
            setError("La liga no existe.")
            setStatus("error")
            return
          }
        }

        setError(getErrorsMessages(err))
        setStatus("error")
      })

    return () => {
      isActive = false
    }
  }, [leagueId])

  function refetchLeague() {
    return httpService
      .get(`/leagues/${leagueId}`)
      .then((data) => setLeague(data))
      .catch(() => {
        // El catch vacio ignora el error y no muestra nada al usuario
        // Esto por si algo falla que se mantenga la info de la liga como estaba
      })
  }

  // Eventos del WS
  function handleLobbyEvent(data) {
    if (data?.league_id !== Number(leagueId)) return
    refetchLeague()  // Vuelve a pedir la liga y la actualiza si hubo un evento
  }
  useGlobalEvent("TEAM_JOINED_LEAGUE", handleLobbyEvent)
  useGlobalEvent("LEAVE_LOBBY_LEAGUE", handleLobbyEvent)
  useGlobalEvent("LEAGUE_INITIATED", handleLobbyEvent)
  useLeagueInProgressEvents(leagueId, league?.fixture, refetchLeague)

  return { league, status, error, refetchLeague }
}

function LeagueLobbyPage() {
  const { leagueId } = useParams()
  const navigate = useNavigate()
  const { user } = useSession()
  const { league, status, error, refetchLeague } = useLeagueLobby(leagueId)

  // Si cancelan esta liga, todos los que están en el lobby (también el anfitrión) vuelven
  // al listado con el aviso. Las cancelaciones de otras ligas se ignoran
  useGlobalEvent("LEAGUE_CANCELLED", (data) => {
    if (data?.league_id !== Number(leagueId)) return
    navigate("/leagues", { replace: true, state: { message: LEAGUE_CANCELLED_MESSAGE } })
  })

  const [isLeaving, setIsLeaving] = useState(false)
  const [leaveError, setLeaveError] = useState(null)
  const [startError, setStartError] = useState(null)
  const [isInitiating, setIsInitiating] = useState(false)

  async function handleLeave() {
    setIsLeaving(true)
    setLeaveError(null)

    try {
      await httpService.delete(`/leagues/${leagueId}/teams/${user.team_id}`)
      navigate("/leagues", { replace: true })
    } catch (err) {
      setLeaveError(getErrorsMessages(err))
      setIsLeaving(false)
    }
  }

  async function handleStart() {
    setIsInitiating(true)
    setStartError(null)

    try {
      await httpService.put(`/leagues/${leagueId}`, {
        status: "IN_PROGRESS"
      })
      await refetchLeague()
    } catch (err) {
      setStartError(getErrorsMessages(err))
      if (err instanceof ApiError && err.error === "LEAGUE_ALREADY_STARTED") {
        await refetchLeague()
      }
    } finally {
      setIsInitiating(false)
    }
  }

  if (status === "loading") {
    return (
      <main className="league-lobby">
        <p>Cargando liga...</p>
      </main>
    )
  }
  // El usuario no puede ver esta liga
  if (status === "forbidden") return <Navigate to="/leagues" replace />

  if (status === "error") {
    return (
      <main className="league-lobby">
        <p role="alert">{error}</p>
        <Link to="/">Volver al inicio</Link>
      </main>
    )
  }

  const isHost = league.host_team_id === user?.team_id
  const isMember = league.teams.some((team) => team.team_id === user?.team_id)
  const canShowStart = isHost && league.status === "PENDING"
  const canStart = league.current_teams_count >= 4 && league.current_teams_count % 2 === 0

  if (!isMember && league.is_private) return <Navigate to="/leagues" replace />

  // PENDING: sala de espera. IN_PROGRESS o FINISHED: tabla, fixture y alineación
  const isWaitingRoom = league.status === "PENDING"

  return (
    <main className={`league-lobby${isWaitingRoom ? "" : " league-lobby--in-progress"}`}>
      <header className="league-lobby__header">
        <h1>{league.league_name}</h1>
        <span className="league-lobby__status">
          {STATUS_LABELS[league.status] ?? league.status}
        </span>
      </header>

      <section className="league-lobby__info">
        <p>Duración: <strong>{league.match_duration} min</strong></p>
        <p>
          Equipos:{" "}
          <strong>
            {league.current_teams_count} / {league.max_teams}
          </strong>
        </p>
      </section>

      {startError && (
        <p className="league-lobby__error" role="alert">
          {startError}
        </p>
      )}

      {isWaitingRoom ? (
        <>
          <ul className="league-lobby__teams">
            {league.teams.map((team) => {
              const isOwn = team.team_id === user?.team_id
              const isTeamHost = team.team_id === league.host_team_id

              return (
                <li
                  key={team.team_id}
                  className={`league-lobby__team${isOwn ? " league-lobby__team--own" : ""}`}
                >
                  <span className="league-lobby__team-name">{team.team_name}</span>
                  <span className="league-lobby__badges">
                    {isTeamHost && <span className="league-lobby__badge">Anfitrión</span>}
                    {isOwn && <span className="league-lobby__badge">Tu equipo</span>}
                  </span>
                </li>
              )
            })}
          </ul>

          {leaveError && (
            <p className="league-lobby__error" role="alert">
              {leaveError}
            </p>
          )}

          {canShowStart && (
            <Button
              onClick={handleStart}
              isLoading={isInitiating}
              disabled={!canStart}
            >
              {isInitiating ? "Iniciando..." : "Iniciar liga"}
            </Button>
          )}

          {isMember && !isHost && (
            <ConfirmButton
              label={isLeaving ? "Saliendo..." : "Abandonar liga"}
              confirmMessage="¿Seguro que querés abandonar la liga?"
              onConfirm={handleLeave}
              isLoading={isLeaving}
              variant="danger"
            />
          )}
        </>
      ) : (
        <LeagueInProgressView league={league} teamId={user?.team_id} isMember={isMember} />
      )}
    </main>
  )
}

export default LeagueLobbyPage