import { httpService } from "./createhttpService"

export const RANKING_PAGE_DEFAULT = 1
export const RANKING_LIMIT_DEFAULT = 20

// pasa una fila del ranking del formato del backend (snake_case) al que usa la UI (camelCase)
function rankingMapping(row) {
  const goalsFor = row.goals_for ?? 0
  const goalsAgainst = row.goals_against ?? 0

  return {
    position: row.position,
    teamId: row.team_id,
    teamName: row.team_name,
    teamLogo: row.team_logo ?? null,
    matchesPlayed: row.matches_played ?? 0,
    wins: row.wins ?? 0,
    draws: row.draws ?? 0,
    losses: row.losses ?? 0,
    goalsFor,
    goalsAgainst,
    goalDiff: row.goal_diff ?? goalsFor - goalsAgainst,
    points: row.points ?? 0,
  }
}

// GET /rankings/global?page=1&limit=20, el token de sesion lo agrega httpService solo
export async function fetchGlobalRanking({ page = RANKING_PAGE_DEFAULT, limit = RANKING_LIMIT_DEFAULT } = {}) {
  const query = new URLSearchParams({ page, limit })
  const data = await httpService.get(`/rankings/global?${query}`)
  const ranking = Array.isArray(data?.ranking) ? data.ranking.map(rankingMapping) : []

  // si el back manda la paginacion se usa, si no: llegaron menos clubes que el limite => no hay mas paginas
  const totalPages = data?.pagination?.total_pages
  const hasNextPage = totalPages != null ? page < totalPages : ranking.length >= limit

  return { ranking, hasNextPage }
}
