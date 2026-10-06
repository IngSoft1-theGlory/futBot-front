import { Link, useNavigate } from "react-router-dom"
import Button from "../../components/Button/Button"
import { useFriendlyMatches } from "../../hooks/useFriendlyMatches"
import { useSession } from "../../hooks/useSession"
import "./FriendlyListPage.css"

// Sala de espera de un amistoso propio (GLORY-111)
export function friendlyLobbyPath(matchId) {
  return `/friendlies/${matchId}`
}

// Formulario para unirse a un amistoso de otro equipo (GLORY-109)
export function joinFriendlyPath(matchId) {
  return `/friendlies/${matchId}/join`
}

function FriendlyListPage() {
  const { matches, isLoading, error, isEmpty, refetch } = useFriendlyMatches()
  const { user } = useSession()
  const navigate = useNavigate()

  return (
    <main className="friendly-list-page">
      <header className="friendly-list-page__header">
        <h1 className="friendly-list-page__title">Amistosos Disponibles</h1>
        <Button variant="secondary" onClick={refetch} isLoading={isLoading}>
          Actualizar
        </Button>
      </header>

      {error && (
        <p className="friendly-list-page__error" role="alert">
          {error}
        </p>
      )}

      {isLoading && matches.length === 0 && (
        <p className="friendly-list-page__message">Cargando Amistosos...</p>
      )}

      {isEmpty && (
        <p className="friendly-list-page__message">
          no hay amistosos disponibles por ahora
        </p>
      )}

      {matches.length > 0 && (
        <ul className="friendly-list">
          {matches.map((match) => {
            // El amistoso propio lleva a su sala de espera; el de otro equipo, a unirse
            const isOwn = user?.team_id != null && match.teamHostId === user.team_id
            const destination = isOwn
              ? friendlyLobbyPath(match.matchId)
              : joinFriendlyPath(match.matchId)
            const actionLabel = isOwn ? "Ir a la sala" : "Unirme"

            return (
              <li key={match.matchId}>
                <button
                  type="button"
                  className={`friendly-card${isOwn ? " friendly-card--own" : ""}`}
                  onClick={() => navigate(destination)}
                >
                  <span className="friendly-card__teams">
                    {isOwn && <span className="friendly-card__badge">Tu amistoso</span>}
                    Equipo #{match.teamHostId}
                    <span className="friendly-card__vs">vs</span>
                    {match.teamAwayId ? `Equipo #${match.teamAwayId}` : "Esperando rival"}
                  </span>
                  <span className="friendly-card__meta">
                    {match.matchDuration} min
                    <span className="friendly-card__action">{actionLabel}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <Link to="/" className="friendly-list-page__back">
        Volver al Inicio
      </Link>
    </main>
  )
}

export default FriendlyListPage