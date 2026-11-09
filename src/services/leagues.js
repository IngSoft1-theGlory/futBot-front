import { httpService } from "./createhttpService"

export const LEAGUE_STATUS_PENDING = "PENDING"
export const LEAGUE_PAGE_DEFAULT = 1
export const LEAGUE_LIMIT_DEFAULT = 20

// pasa una liga del formato del backend (snake_case) al que usa la UI (camelCase)
function leagueMapping(league) {
  return {
    leagueId: league.league_id,
    leagueName: league.league_name,
    teamsCurrent: league.current_teams_count,
    maxTeams: league.max_teams,
    isPrivate: league.is_private,
    isMember: league.is_member,
  }
}

// una liga esta llena cuando ya no quedan cupos
export function isLeagueFull(league) {
  return league.teamsCurrent >= league.maxTeams
}

export function chooseLeagueCoach(leagueId, teamId, behaviorId) {
  return httpService.put(`/leagues/${leagueId}/teams/${teamId}/coach`, { behavior_id: behaviorId })
}

// una liga esta en progreso cuando su status es IN_PROGRESS
export function isLeagueInProgress(league) {
  return league.status === LEAGUE_STATUS_IN_PROGRESS
}

// GET /leagues?status=PENDING,IN_PROGRESS&page=1&limit=20, el token de sesion lo agrega httpService solo
export async function fetchLeagues({ page = LEAGUE_PAGE_DEFAULT, limit = LEAGUE_LIMIT_DEFAULT } = {}) {
  const query = new URLSearchParams({ 
    status: `${LEAGUE_STATUS_PENDING},${LEAGUE_STATUS_IN_PROGRESS}`,
    page, 
    limit,
  })
  const data = await httpService.get(`/leagues?${query}`)

  return Array.isArray(data?.leagues) ? data.leagues.map(leagueMapping) : []
}
