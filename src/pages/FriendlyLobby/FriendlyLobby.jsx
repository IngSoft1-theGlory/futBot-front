import { useEffect, useState } from "react"
import { useParams, Link, useNavigate, Navigate } from "react-router-dom"
import { httpService, ApiError } from "../../services/createhttpService"
import { useSession } from "../../hooks/useSession"
import { useGlobalEvent } from "../../hooks/useGlobalEvent"
import "./FriendlyLobby.css"

const NETWORK_ERROR_MESSAGE =
  "No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo."
const SOCKET_TIMEOUT_MS = 5000

const STATUS_LABELS = {
  PENDING: "Esperando rival",
  IN_PROGRESS: "En curso",
}

function useFriendlyLobby(matchId, onMatchStarted) {
  const [match, setMatch] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useGlobalEvent("MATCH_STARTED", (data) => {
    if (data?.match_id === Number(matchId)) onMatchStarted()
  })

  useEffect(() => {
    let isActive = true
    httpService.get(`/friendly/${matchId}`)
      .then((data) => {
        if (!isActive) return
        if (data.status === "IN_PROGRESS") onMatchStarted()
        else setMatch(data)
      })
      .catch((err) => {
        if (isActive) setError(err instanceof ApiError ? err.message : NETWORK_ERROR_MESSAGE)
      })
      .finally(() => { if (isActive) setLoading(false) })
    return () => { isActive = false }
  }, [matchId])

  return { match, loading, error }
}

function FriendlyLobby() {
  const { matchId } = useParams()
  const navigate = useNavigate()
  const { user } = useSession()

  const { match, loading, error, connectionError } = useFriendlyLobby(matchId, () =>
    navigate(`/matches/${matchId}`, { replace: true })
  )

  if (loading) {
    return (
      <main className="friendly-lobby">
        <p>Cargando partido...</p>
      </main>
    )
  }

  if (error) {
    return (
      <main className="friendly-lobby">
        <p role="alert">{error}</p>
        <Link to="/">Volver al inicio</Link>
      </main>
    )
  }

  if (!match) return null

  if (match.team_host.team_id !== user?.team_id) {
    return <Navigate to="/" replace />
  }
  
  const hasRival = match.team_away != null

  return (
    <main className="friendly-lobby">
      <header className="friendly-lobby__header">
        <h1>Sala de espera del amistoso #{match.match_id}</h1>
        <span className="friendly-lobby__status">
          {STATUS_LABELS[match.status] ?? match.status}
        </span>
      </header>

      {connectionError && (
        <p className="friendly-lobby__connection-error" role="alert">
          Sin conexión en vivo. Recargá la página para ver si se unió un rival.
        </p>
      )}

      <section className="friendly-lobby__teams">
        <div className="friendly-lobby__team">
          <p>{match.team_host.team_name}</p>
          <span className="friendly-lobby__role">Anfitrión</span>
        </div>

        <div className="friendly-lobby__team">
          {hasRival ? (
            <>
              <p>{match.team_away.team_name}</p>
              <span className="friendly-lobby__role">Visitante</span>
            </>
          ) : (
            <p>Esperando a que se una un rival...</p>
          )}
        </div>
      </section>
    </main>
  )
}

export default FriendlyLobby