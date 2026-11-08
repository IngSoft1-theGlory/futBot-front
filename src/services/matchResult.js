import { httpService } from "./createhttpService"
/*
 resultado final de un partido (GET /matches/{matchId}/result)

 forma de la respuesta del backend:
   { match_id, status: "FINISHED",
     home_team: { team_id, team_name, goals, penalty_goals },
     away_team: { team_id, team_name, goals, penalty_goals } }

 penalty_goals viene en null si el partido no se definió por penales

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
    // si el back no manda el campo (undefined) queda null, igual que "no hubo penales"
    penaltyGoals: team.penalty_goals ?? null,
  }
}

// true si el partido se definio por penales (los dos equipos tienen goles de penales), se compara con null y no se usa solo el valor, porque 0 penales convertidos tambien es un resultado valido
export function hasPenalties(result) {
  return result.home.penaltyGoals !== null && result.away.penaltyGoals !== null
}

export function getOutcome(result, userTeamId) {
  const mine = [result.home, result.away].find((team) => team.id === userTeamId)
  if (!mine) return null

  const rival = mine === result.home ? result.away : result.home
  if (mine.goals > rival.goals) return "won"
  if (mine.goals < rival.goals) return "lost"

  // empate en goles: si hubo penales, el ganador lo decide la tanda
  if (hasPenalties(result)) {
    if (mine.penaltyGoals > rival.penaltyGoals) return "won"
    if (mine.penaltyGoals < rival.penaltyGoals) return "lost"
  }
  return "draw"
}
