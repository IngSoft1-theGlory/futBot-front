import { useNavigate } from "react-router-dom"
import Button from "../../components/Button/Button"
import DataTable from "../../components/DataTable/DataTable"
import Fixture from "../../components/Fixture/Fixture"
import CoachSelector from "../../components/CoachSelector/CoachSelector"
import "./LeagueInProgressView.css"

// Columnas de la tabla de posiciones (campos del ranking de GET /leagues/{leagueId})
const RANKING_COLUMNS = [
  { key: "position", label: "#", align: "center" },
  { key: "team_name", label: "Equipo" },
  { key: "matches_played", label: "PJ", align: "center" },
  { key: "wins", label: "PG", align: "center" },
  { key: "draws", label: "PE", align: "center" },
  { key: "losses", label: "PP", align: "center" },
  { key: "goals_for", label: "GF", align: "center" },
  { key: "goals_against", label: "GC", align: "center" },
  {
    key: "goal_diff",
    label: "DG",
    align: "center",
    // La diferencia positiva se muestra con signo: +3
    render: (row) => (row.goal_diff > 0 ? `+${row.goal_diff}` : row.goal_diff),
  },
  {
    key: "points",
    label: "Pts",
    align: "center",
    render: (row) => <strong className="league-progress__points">{row.points}</strong>,
  },
]

/*
 Vista de una liga iniciada (en curso o finalizada): tabla de posiciones, fixture
 y, mientras se juega, el acceso a editar la alineación del equipo del usuario.
 También el selector para asignar un comportamiento DT al equipo.
*/
function LeagueInProgressView({ league, teamId, isMember, onCoachChanged }) {
  const navigate = useNavigate()
  const canEditLineup = isMember && league.status === "IN_PROGRESS"

  return (
    <>
      {canEditLineup && (
        <div className="league-progress__actions">
          <p className="league-progress__hint">
            Los cambios de alineación rigen desde tu próximo partido.
          </p>
          <Button onClick={() => navigate(`/leagues/${league.league_id}/lineup`)}>
            Editar alineación
          </Button>
        </div>
      )}

      {/* Muestra al miembro de la liga el selector del comportamiento del DT del equipo. */}
      {isMember && (
        <CoachSelector
          leagueId={league.league_id}
          teamId={teamId}
          currentCoachId={league.coach_behavior_id ?? null}
          disabled={league.status !== "IN_PROGRESS"}
          onChanged={onCoachChanged}
        />
      )}
      <section className="league-progress__section" aria-labelledby="league-ranking-title">
        <h2 id="league-ranking-title" className="league-progress__title">
          Tabla de posiciones
        </h2>
        <DataTable
          columns={RANKING_COLUMNS}
          rows={league.ranking ?? []}
          rowKey="team_id"
          highlightedRowKey={teamId}
          emptyMessage="La tabla todavía no tiene datos."
        />
      </section>

      <section className="league-progress__section" aria-labelledby="league-fixture-title">
        <h2 id="league-fixture-title" className="league-progress__title">
          Fixture
        </h2>
        <Fixture fixture={league.fixture} teamId={teamId} />
      </section>
    </>
  )
}

export default LeagueInProgressView
