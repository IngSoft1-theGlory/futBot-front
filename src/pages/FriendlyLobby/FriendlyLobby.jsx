import { useEffect, useRef, useState } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import Button from "../../components/Button/Button"
import { httpService, ApiError } from "../../services/createhttpService"
import { useSession } from "../../hooks/useSession"
import "./FriendlyLobby.css"

// Hook para obtener los detalles del partido desde el backend
function useMatchDetail(matchId) {
  const [match, setMatch] = useState(null)
  const [loading, setLoading] = useState(true)
  const [errors, setErrors] = useState(null)
  // useEffect para obtener los detalles del partido cuando se monta el componente o cambia el matchId
  useEffect(() => {
    let isActive = true    // Bandera para evitar actualizar el estado si el componente se desmonta antes de que la promesa se resuelva
    const fetchMatchDetail = async () => {
      setLoading(true)
      setErrors(null)

      try {
        const data = await httpService.get(`/friendly/${matchId}`)  
        if (!isActive) return
        setMatch(data)
      } catch (error) {
        if (!isActive) return
        if (error instanceof ApiError) {
          setErrors(error.message)
        } else {
          setErrors("No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo.")
        }
      } finally {
        if (isActive) {
          setLoading(false)
        }
      }
    }

    fetchMatchDetail()

    return () => {
      isActive = false
    }
  }, [matchId])

  return { match, loading, errors }
}


// Escucha el canal global de WS y reacciona solo a los eventos de este
// amistoso puntual. El canal es global: recibe eventos de todos los
// partidos y ligas del sistema, no solo del que estamos mirando.
function useFriendlyLobbySocket(matchId, handlers) {
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    if (!matchId) return

    let socket = null
    let isActive = true

    const connect = async () => {
      try {
        const { websocket_url } = await httpService.post("/live-token/global")
        if (!isActive) return

        socket = new WebSocket(websocket_url)

        socket.onmessage = (message) => {
          const { event, data } = JSON.parse(message.data)
          if (data?.match_id !== Number(matchId)) return

          if (event === "MATCH_STARTED") {
            handlersRef.current.onMatchStarted(data)
          } else if (event === "FRIENDLY_CANCELLED") {
            handlersRef.current.onCancelled(data)
          }
        }
      } catch {
        // Sin conexión en vivo: el usuario puede recargar para ver el estado actual.
      }
    }

    connect()

    return () => {
      isActive = false
      socket?.close()
    }
  }, [matchId])
}


function FriendlyLobby() {
  const { matchId } = useParams()
  const { match, loading, errors } = useMatchDetail(matchId)
  const { user } = useSession()
  const navigate = useNavigate()

  useFriendlyLobbySocket(matchId, {
    onMatchStarted: () => {
      navigate(`/matches/${matchId}`, { replace: true })
    },
    onCancelled: () => {
      navigate("/friendlies", { replace: true })
    },
  })

  if (loading) {
    return (
      <main className="friendly-lobby">
        <p>Cargando partido...</p>
      </main>
    )
  }

  if (errors) {
    return (
      <main className="friendly-lobby">
        <p role="alert">{errors}</p>
        <Link to="/">Volver al inicio</Link>
      </main>
    )
  }

  const isHost = match.team_host.team_id === user?.team_id
  const isAway = match.team_away?.team_id === user?.team_id
  const hasRival = match.team_away !== null

  return (
    <main className="friendly-lobby">
      <header className="friendly-lobby__header">
        <h1>Sala de espera del amistoso #{match.match_id}</h1>
        <span className="friendly-lobby__status">{match.status}</span>
      </header>

      <section className="friendly-lobby__teams">
        <div className="friendly-lobby__team">
          <p>{match.team_host.team_name}</p>
          {isHost && <span>(vos)</span>}
          <span className="friendly-lobby__role">Anfitrión</span>
        </div>

        <div className="friendly-lobby__team">
          {hasRival ? (
            <>
              <p>{match.team_away.team_name}</p>
              {isAway && <span>(vos)</span>}
              <span className="friendly-lobby__role">Visitante</span>
            </>
          ) : (
            <p>Esperando a que se una un rival...</p>
          )}
        </div>
      </section>

      <Button onClick={() => navigate("/friendlies")}>
        Cerrar
      </Button>
    </main>
  )
}

export default FriendlyLobby