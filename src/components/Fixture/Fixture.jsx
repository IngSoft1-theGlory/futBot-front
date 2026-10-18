import { useNavigate } from "react-router-dom"
import Button from "../Button/Button"
import "./Fixture.css"

// teexto que ve el usuario para cada estado del partido
const STATUS_LABELS = {
  PENDING: "Por jugar",
  IN_PROGRESS: "En juego",
  FINISHED: "Finalizado",
}

const EMPTY_MESSAGE = "Todavía no hay partidos en el fixture."
/*
 junta los partidos que se juegan en la misma fecha (match.round_number)
 Devuelve los grupos ordenados por fecha:
   [{ round: 1, matches: [...] }, { round: 2, matches: [...] }]
*/
function groupMatchesByRound(fixture) {
  const groups = []

  for (const match of fixture) {
    // busca si ya existe el grupo de la fecha de este partido
    let group = groups.find((item) => item.round === match.round_number)

    // Si es el primer partido de esa fecha, crea el grupo
    if (!group) {
      group = { round: match.round_number, matches: [] }
      groups.push(group)
    }

    group.matches.push(match)
  }

  // ordena las fechas de menor a mayor (Fecha 1, Fecha 2, ...)
  groups.sort((a, b) => a.round - b.round)
  return groups
}

// el marcador se muestra cuando el partido termino, antes se muestra "vs"
function getScoreText(match) {
  if (match.status === "FINISHED") {
    return `${match.score.home} - ${match.score.away}`
  }
  return "vs"
}

// true si el equipo del usuario juega este partido (de local o de visitante)
function isUserMatch(match, teamId) {
  return match.team_host.team_id === teamId || match.team_away.team_id === teamId
}

// El boton para entrar aparece solo en los partidos del usuario que se están jugando
function canEnterMatch(match, teamId) {
  return match.status === "IN_PROGRESS" && isUserMatch(match, teamId)
}

// dibuja un partido: local, marcador, visitante, estado y, si corresponde, el boton para entrar
function FixtureMatch({ match, teamId }) {
  const navigate = useNavigate()

  return (
    <li className="fixture__match">
      <div className="fixture__teams">
        <span className="fixture__team fixture__team--home">{match.team_host.team_name}</span>
        <span className="fixture__score">{getScoreText(match)}</span>
        <span className="fixture__team fixture__team--away">{match.team_away.team_name}</span>
      </div>

      <span className="fixture__status">{STATUS_LABELS[match.status]}</span>

      {canEnterMatch(match, teamId) && (
        <Button onClick={() => navigate(`/matches/${match.match_id}`)}>
          Acceder al partido
        </Button>
      )}
    </li>
  )
}

function Fixture({
  fixture,  // Lista de partidos de la liga (league.fixture)
  teamId,   // team_id del equipo del usuario
}) {
  // Sin partidos (o si el fixture todavia no llegó) se muestra un mensaje en vez de la lista
  if (!Array.isArray(fixture) || fixture.length === 0) {
    return (
      <section className="fixture">
        <p className="fixture__empty">{EMPTY_MESSAGE}</p>
      </section>
    )
  }

  const groups = groupMatchesByRound(fixture)

  return (
    <section className="fixture">
      {groups.map((group) => (
        <div key={group.round} className="fixture__round">
          <h3 className="fixture__round-title">Fecha {group.round}</h3>

          <ul className="fixture__matches">
            {group.matches.map((match) => (
              <FixtureMatch key={match.match_id} match={match} teamId={teamId} />
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}

export default Fixture
