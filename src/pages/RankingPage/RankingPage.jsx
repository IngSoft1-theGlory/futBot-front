import { Link } from "react-router-dom"
import Button from "../../components/Button/Button"
import DataTable from "../../components/DataTable/DataTable"
import { useGlobalRanking } from "../../hooks/useGlobalRanking"
import { useSession } from "../../hooks/useSession"
import "./RankingPage.css"

// Los tres primeros llevan una medalla de color
const PODIUM_CLASSES = { 1: "ranking-position--gold", 2: "ranking-position--silver", 3: "ranking-position--bronze" }

function TrophyIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
    </svg>
  )
}

// Logo y nombre del club. Si no tiene logo, se muestra la inicial
function ClubCell({ row }) {
  return (
    <span className="ranking-club">
      {row.teamLogo ? (
        <img src={row.teamLogo} alt={`Logo de ${row.teamName}`} className="ranking-club__logo" />
      ) : (
        <span className="ranking-club__logo ranking-club__logo--empty" aria-hidden="true">
          {row.teamName?.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="ranking-club__name">{row.teamName}</span>
    </span>
  )
}

const RANKING_COLUMNS = [
  {
    key: "position",
    label: "#",
    align: "center",
    render: (row) => (
      <span className={`ranking-position ${PODIUM_CLASSES[row.position] ?? ""}`}>{row.position}</span>
    ),
  },
  { key: "teamName", label: "Club", render: (row) => <ClubCell row={row} /> },
  { key: "matchesPlayed", label: "PJ", align: "center" },
  { key: "wins", label: "PG", align: "center" },
  { key: "draws", label: "PE", align: "center" },
  { key: "losses", label: "PP", align: "center" },
  { key: "goalsFor", label: "GF", align: "center" },
  { key: "goalsAgainst", label: "GC", align: "center" },
  {
    key: "goalDiff",
    label: "DG",
    align: "center",
    // La diferencia positiva se muestra con signo: +3
    render: (row) => (row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff),
  },
  {
    key: "points",
    label: "Pts",
    align: "center",
    render: (row) => <strong className="ranking-points">{row.points}</strong>,
  },
]

function RankingPage() {
  const { user } = useSession()
  const { ranking, isLoading, error, isEmpty, page, hasNextPage, goToPreviousPage, goToNextPage, refetch } =
    useGlobalRanking()

  return (
    <main className="ranking-page">
      <header className="ranking-page__header">
        <div className="ranking-page__icon">
          <TrophyIcon />
        </div>
        <div>
          <h1 className="ranking-page__title">Ranking global</h1>
          <p className="ranking-page__subtitle">Los clubes ordenados por puntos y diferencia de goles.</p>
        </div>
      </header>

      {isLoading && <p className="ranking-page__message">Cargando ranking...</p>}

      {error && (
        <div className="ranking-page__error" role="alert">
          <p>{error}</p>
          <Button variant="secondary" onClick={refetch}>
            Reintentar
          </Button>
        </div>
      )}

      {isEmpty && <p className="ranking-page__message">Todavía no hay clubes en el ranking.</p>}

      {!isLoading && !error && ranking.length > 0 && (
        <DataTable columns={RANKING_COLUMNS} rows={ranking} rowKey="teamId" highlightedRowKey={user?.team_id} />
      )}

      <nav className="ranking-page__pagination" aria-label="Paginación del ranking">
        <Button variant="secondary" disabled={page === 1 || isLoading} onClick={goToPreviousPage}>
          Anterior
        </Button>
        <span>Página {page}</span>
        <Button variant="secondary" disabled={!hasNextPage || isLoading} onClick={goToNextPage}>
          Siguiente
        </Button>
      </nav>

      <Link to="/" className="ranking-page__back">
        Volver al Inicio
      </Link>
    </main>
  )
}

export default RankingPage
