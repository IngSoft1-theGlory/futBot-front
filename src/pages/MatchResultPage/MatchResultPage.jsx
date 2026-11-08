import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import Button from "../../components/Button/Button"
import { useSession } from "../../hooks/useSession"
import { ApiError } from "../../services/createhttpService"
import { fetchMatchResult, getOutcome, hasPenalties } from "../../services/matchResult"
import "./MatchResultPage.css"

const OUTCOME_TEXT = {
  won: "¡Ganaste!",
  lost: "Perdiste",
  draw: "Empataste",
}
/*
 pantalla del resultado final (/matches/:matchId/result).

 status: "loading" | "ready" | "not-found" | "network-error"
*/
function MatchResultPage() {
  const { matchId } = useParams()
  const navigate = useNavigate()
  const { user } = useSession()

  const [status, setStatus] = useState("loading")
  const [result, setResult] = useState(null)
  // Cada vez que sube este número, el efecto vuelve a correr (es el "reintentar")
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    // pasa a false al salir de la pantalla, una respuesta que llega tarde no debe cambiar nada
    let isActive = true

    setStatus("loading")

    fetchMatchResult(matchId)
      .then((data) => {
        if (!isActive) return
        setResult(data)
        setStatus("ready")
      })
      .catch((error) => {
        if (!isActive) return

        if (error instanceof ApiError) {
          if (error.status === 401) return // la gestion de sesion se encarga
          if (error.error === "MATCH_NOT_FINISHED") {
            navigate(`/matches/${matchId}`, { replace: true }) // sigue en curso a la pantalla del partido
            return
          }
          if (error.error === "MATCH_NOT_FOUND") {
            setStatus("not-found")
            return
          }
        }
        // cualquier otra cosa (sin internet, error 500...)da mensaje generico con "Reintentar"
        setStatus("network-error")
      })

    return () => {
      isActive = false
    }
  }, [matchId, attempt, navigate])

  if (status === "loading") {
    return (
      <main className="match-result-page">
        <p>Cargando Resultado...</p>
      </main>
    )
  }

  if (status === "not-found") {
    return (
      <main className="match-result-page">
        <p role="alert">El partido no existe</p>
        <Link to="/">Volver al Inicio</Link>
      </main>
    )
  }

  if (status === "network-error") {
    return (
      <main className="match-result-page">
        <p role="alert">No se pudo cargar el resultado, revisa tu conexion e intenta de nuevo</p>
        <Button onClick={() => setAttempt((current) => current + 1)}>Reintentar</Button>
      </main>
    )
  }

  const outcome = getOutcome(result, user?.team_id)
  const showPenalties = hasPenalties(result)

  return (
    <main className="match-result-page">
      <h1 className="match-result-page__title">Resultado Final</h1>

      {outcome && (
        <p className={`match-result-page__outcome match-result-page__outcome--${outcome}`}>
          {OUTCOME_TEXT[outcome]}
        </p>
      )}

      <div className="match-result-page__teams">
        {[result.home, result.away].map((team) => {
          const isHome = team === result.home
          // los penales van del lado de afuera de los goles: (2) 0 en el local y 0 (1) en el visitante
          const penaltiesText = showPenalties && (
            <span className="result-team__penalties" aria-label={`Penales de ${team.name}`}>
              ({team.penaltyGoals})
            </span>
          )

          return (
            <section
              key={team.id}
              className={`result-team${team.id === user?.team_id ? " result-team--own" : ""}`}
            >
              <h2 className="result-team__name">{team.name}</h2>
              <div className="result-team__score">
                {isHome && penaltiesText}
                <p className="result-team__goals" aria-label={`Goles de ${team.name}`}>
                  {team.goals}
                </p>
                {!isHome && penaltiesText}
              </div>
              {team.id === user?.team_id && <span className="result-team__badge">Tu Equipo</span>}
            </section>
          )
        })}
      </div>

      <div className="match-result-page__actions">
        <Button onClick={() => navigate("/")}>Volver al Inicio</Button>
        <Button variant="secondary" onClick={() => navigate("/friendlies")}>
          Ver Amistosos
        </Button>
      </div>
    </main>
  )
}

export default MatchResultPage
