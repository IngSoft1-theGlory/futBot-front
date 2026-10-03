import { useEffect, useRef, useState } from "react"
import { useParams, Link, useNavigate, Navigate } from "react-router-dom"
import { httpService, ApiError } from "../../services/createhttpService"
import { useSession } from "../../hooks/useSession"
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
  const [connectionError, setConnectionError] = useState(false)

  const onMatchStartedRef = useRef(onMatchStarted)
  useEffect(() => {
    onMatchStartedRef.current = onMatchStarted
  })

  useEffect(() => {
    let isActive = true
    let socket = null
    let hasLeft = false
    let hasLoaded = false
    let timeoutId = null

    function leave() {
      if (!isActive || hasLeft) return
      hasLeft = true
      onMatchStartedRef.current()
    }

    async function loadMatch() {
      if (hasLoaded) return
      hasLoaded = true
      clearTimeout(timeoutId)

      try {
        const data = await httpService.get(`/friendly/${matchId}`)
        if (!isActive) return

        if (data.status === "IN_PROGRESS") {
          leave()
          return
        }
        setMatch(data)
      } catch (err) {
        if (!isActive) return
        setError(err instanceof ApiError ? err.message : NETWORK_ERROR_MESSAGE)
      } finally {
        if (isActive) setLoading(false)
      }
    }

    function handleSocketFailure() {
      if (!isActive) return
      setConnectionError(true)
      loadMatch()
    }

    async function start() {
      try {
        const { websocket_url } = await httpService.post("/live-token/global")
        if (!isActive) return

        socket = new WebSocket(websocket_url)
        timeoutId = setTimeout(handleSocketFailure, SOCKET_TIMEOUT_MS)

        socket.onopen = () => {
          if (!isActive) return
          loadMatch()
        }

        socket.onmessage = (message) => {
          let parsed
          try {
            parsed = JSON.parse(message.data)
          } catch {
            return
          }
          const { event, data } = parsed
          if (event === "MATCH_STARTED" && data?.match_id === Number(matchId)) {
            leave()
          }
        }

        socket.onerror = handleSocketFailure
        socket.onclose = handleSocketFailure
      } catch {
        handleSocketFailure()
      }
    }

    start()

    return () => {
      isActive = false
      clearTimeout(timeoutId)
      socket?.close()
    }
  }, [matchId])

  return { match, loading, error, connectionError }
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