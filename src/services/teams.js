import { httpService } from "./createhttpService"

// pasa un equipo del formato del backend (snake_case) al que usa la UI (camelCase)
function teamMapping(team) {
  return {
    teamId: team.team_id,
    name: team.name ?? team.team_name,
    logo: team.team_logo ?? null,
    position: team.position ?? null, // posicion en el ranking global
    matchesPlayed: team.matches_played ?? 0,
    wins: team.wins ?? 0,
    draws: team.draws ?? 0,
    losses: team.losses ?? 0,
    points: team.points ?? 0,
  }
}

// GET /teams/{teamId}: nombre, logo y estadisticas del equipo. El token lo agrega httpService
export async function fetchTeam(teamId) {
  const data = await httpService.get(`/teams/${teamId}`)
  return teamMapping(data)
}
