import { useEffect, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import Button from "../../components/Button/Button"
import { useLeagues } from "../../hooks/useLeagues"
import { isLeagueFull } from "../../services/leagues"
// se reutilizan los estilos del listado de amistosos
import "../FriendlyListPage/FriendlyListPage.css"
import "./LeagueListPage.css"

// El aviso que llega de otra pantalla (ej: la liga fue cancelada) se ve unos segundos y desaparece
const NOTICE_DURATION_MS = 5000

function LeagueListPage() {
  const { leagues, isLoading, error, page, hasNextPage, goToPreviousPage, goToNextPage } = useLeagues()
  const navigate = useNavigate()
  const { state } = useLocation()
  // aviso al volver de otra pantalla (ej: la liga ya no existe o fue cancelada)
  const [notice, setNotice] = useState(state?.message ?? "")

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(""), NOTICE_DURATION_MS)
    return () => clearTimeout(timer)
  }, [notice])

  // privada: primero se verifica la contraseña, publica: directo a la inscripcion
  function onSelectLeague(league) {
    const state = { leagueName: league.leagueName }
    if (league.isPrivate) {
      navigate(`/leagues/${league.leagueId}/verify-password`, { state })
    } else {
      navigate(`/leagues/${league.leagueId}/join`, { state })
    }
  }

  const isEmpty = !isLoading && !error && leagues.length === 0

  return (
    <main className="friendly-list-page">
      <header className="friendly-list-page__header">
        <h1 className="friendly-list-page__title">Ligas Disponibles</h1>
      </header>

      {notice && (
        <p className="friendly-list-page__error" role="alert">
          {notice}
        </p>
      )}

      {error && (
        <p className="friendly-list-page__error" role="alert">
          {error}
        </p>
      )}

      {isLoading && <p className="friendly-list-page__message">Cargando ligas...</p>}

      {isEmpty && (
        <>
          <p className="friendly-list-page__message">No hay ligas disponibles</p>
          <Button onClick={() => navigate("/leagues/new")}>Crear liga</Button>
        </>
      )}

      {!isLoading && leagues.length > 0 && (
        <ul className="friendly-list">
          {leagues.map((league) => {
            const isFull = isLeagueFull(league)

            return (
              <li key={league.leagueId}>
                <button
                  type="button"
                  className="friendly-card"
                  disabled={isFull}
                  onClick={() => onSelectLeague(league)}
                >
                  <span className="friendly-card__teams">{league.leagueName}</span>
                  <span className="friendly-card__meta">
                    {league.isPrivate ? "Privada" : "Pública"}
                    <span>
                      {league.teamsCurrent} / {league.maxTeams}
                    </span>
                    {isFull && <span className="friendly-card__action">Llena</span>}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <nav className="league-pagination">
        <Button variant="secondary" disabled={page === 1 || isLoading} onClick={goToPreviousPage}>
          Anterior
        </Button>
        <span>Página {page}</span>
        <Button variant="secondary" disabled={!hasNextPage || isLoading} onClick={goToNextPage}>
          Siguiente
        </Button>
      </nav>

      <Link to="/" className="friendly-list-page__back">
        Volver al Inicio
      </Link>
    </main>
  )
}

export default LeagueListPage
