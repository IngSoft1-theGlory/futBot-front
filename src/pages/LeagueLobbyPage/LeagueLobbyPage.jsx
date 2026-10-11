import { useEffect, useState } from "react"
import { useParams, useNavigate, Link, Navigate } from "react-router-dom"
import { httpService, ApiError } from "../../services/createhttpService"
import { useSession } from "../../hooks/useSession"
import { useGlobalEvent } from "../../hooks/useGlobalEvent"
import "./LeagueLobbyPage.css"

const NETWORK_ERROR_MESSAGE =
  "No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo."

const STATUS_LABELS = { PENDING: "Esperando equipos" }

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
    httpService
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

  return { league, status, error }
}

function LeagueLobbyPage() {
  const { leagueId } = useParams()
  const navigate = useNavigate()
  const { user } = useSession()
  const { league, status, error } = useLeagueLobby(leagueId)

  const [isLeaving, setIsLeaving] = useState(false)
  const [leaveError, setLeaveError] = useState(null)

  async function handleLeave() {
    if (!window.confirm("¿Seguro que querés abandonar la liga?")) return

    setIsLeaving(true)
    setLeaveError(null)

    try {
      await httpService.delete(`/leagues/${leagueId}/teams/${user.team_id}`)
      navigate("/", { replace: true })
    } catch (err) {
      setLeaveError(getErrorsMessages(err))
      setIsLeaving(false)
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
  if (status === "forbidden") return <Navigate to="/" replace />

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

  if (!isMember && league.is_private) return <Navigate to="/" replace />

  return (
    <main className="league-lobby">
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

      {isMember && !isHost && (
        <button
          type="button"
          className="league-lobby__leave"
          onClick={handleLeave}
          disabled={isLeaving}
        >
          {isLeaving ? "Saliendo..." : "Abandonar liga"}
        </button>
      )}
    </main>
  )
}

export default LeagueLobbyPage