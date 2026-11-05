import "./TeamSummary.css"

/*
 Logo, nombre y estadisticas de un equipo.
 Lo usa el perfil del usuario y lo puede reusar el perfil de otro club.

 team: { name, logo, position, matchesPlayed, wins, draws, losses, points }
*/
function TeamSummary({ team }) {
  const stats = [
    { label: "Ranking", value: team.position ? `#${team.position}` : "—" },
    { label: "PJ", value: team.matchesPlayed },
    { label: "PG", value: team.wins },
    { label: "PE", value: team.draws },
    { label: "PP", value: team.losses },
    { label: "Pts", value: team.points },
  ]

  return (
    <section className="team-summary" aria-label={`Equipo ${team.name}`}>
      <div className="team-summary__identity">
        {team.logo ? (
          <img src={team.logo} alt={`Logo de ${team.name}`} className="team-summary__logo" />
        ) : (
          <span className="team-summary__logo team-summary__logo--empty" aria-hidden="true">
            {team.name?.charAt(0).toUpperCase()}
          </span>
        )}
        <h2 className="team-summary__name">{team.name}</h2>
      </div>

      <dl className="team-summary__stats">
        {stats.map((stat) => (
          <div key={stat.label} className="team-summary__stat">
            <dt>{stat.label}</dt>
            <dd>{stat.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export default TeamSummary
