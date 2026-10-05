import { httpService } from "./createhttpService"
/*
 resultado final de un partido (GET /matches/{matchId}/result)

 forma de la respuesta del backend:
   { match_id, status: "FINISHED",
     home_team: { team_id, team_name, goals },
     away_team: { team_id, team_name, goals } }

 Lanza ApiError si el backend responde con error
   400 MATCH_NOT_FINISHED (el partido sigue en curso) o 404 MATCH_NOT_FOUND
*/
export async function fetchMatchResult(matchId) {
  const data = await httpService.get(`/matches/${matchId}/result`)

  return {
    matchId: data.match_id,
    home: toTeam(data.home_team),
    away: toTeam(data.away_team),
  }
}

// team_name puede venir null (es nullable en la base) se muestra "Equipo #id"
function toTeam(team) {
  return {
    id: team.team_id,
    name: team.team_name ?? `Equipo #${team.team_id}`,
    goals: team.goals,
  }
}

export function getOutcome(result, userTeamId) {
  const mine = [result.home, result.away].find((team) => team.id === userTeamId)
  if (!mine) return null

  const rival = mine === result.home ? result.away : result.home
  if (mine.goals > rival.goals) return "won"
  if (mine.goals < rival.goals) return "lost"
  return "draw"
}
