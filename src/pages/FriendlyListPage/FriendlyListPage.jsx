import { useState } from "react"
import { Link } from "react-router-dom"
import Button from "../../components/Button/Button"
import { useFriendlyMatches } from "../../hooks/useFriendlyMatches"
import { useSession } from "../../hooks/useSession"
import "./FriendlyListPage.css"

function FriendlyListPage() {
  const { matches, isLoading, error, isEmpty, refetch } = useFriendlyMatches()
  const { user } = useSession()
  const [selectedId, setSelectedId] = useState(null)

  // Si el seleccionado desaparece por un evento (cancelado u ocupado), queda en null
  // y el botón de unirse se deshabilita solo.

  const selectedMatch = matches.find((match) => match.matchId === selectedId) ?? null

  function handleSelect(matchId) {
    // Volver a tocar el partido seleccionado lo deselecciona
    setSelectedId((current) => (current === matchId ? null : matchId))
  }

  function handleJoin() {
    // TODO: todavía no existe el endpoint/servicio para unirse a un amistoso.
    // Cuando exista, llamarlo acá con selectedMatch.matchId.
    console.info("Unirse al amistoso", selectedMatch?.matchId)
  }

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
            const isSelected = match.matchId === selectedId
            // El amistoso propio se muestra, pero no se puede elegir para unirse
            const isOwn = user?.team_id != null && match.teamHostId === user.team_id
            const cardClasses = [
              "friendly-card",
              isSelected && "friendly-card--selected",
              isOwn && "friendly-card--own",
            ]
              .filter(Boolean)
              .join(" ")
            return (
              <li key={match.matchId}>
                <button
                  type="button"
                  className={cardClasses}
                  aria-pressed={isSelected}
                  disabled={isOwn}
                  onClick={() => handleSelect(match.matchId)}
                >
                  <span className="friendly-card__teams">
                    {isOwn && <span className="friendly-card__badge">Tu amistoso</span>}
                    Equipo #{match.teamHostId}
                    <span className="friendly-card__vs">vs</span>
                    {match.teamAwayId ? `Equipo #${match.teamAwayId}` : "Esperando rival"}
                  </span>
                  <span className="friendly-card__meta">
                    {match.matchDuration} min
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <div className="friendly-list-page__actions">
        <Button variant="alternative" disabled={!selectedMatch} onClick={handleJoin}>
          Unirme al Amistoso
        </Button>
      </div>

      <Link to="/" className="friendly-list-page__back">
        Volver al Inicio
      </Link>
    </main>
  )
}

export default FriendlyListPage
