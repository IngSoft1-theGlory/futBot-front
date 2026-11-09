import { httpService } from "./createhttpService"

function lineupPath(leagueId, teamId) {
  return `/leagues/${leagueId}/teams/${teamId}/lineup`
}

// GET de la alineación vigente del equipo en la liga.
// Devuelve { formation_type, starting_players, substitute_players }, el mismo formato que usa TacticalSetup
export function fetchLeagueLineup(leagueId, teamId) {
  return httpService.get(lineupPath(leagueId, teamId))
}

// PUT que reemplaza la alineación vigente por la configuración que entrega TacticalSetup
export function updateLeagueLineup(leagueId, teamId, config) {
  return httpService.put(lineupPath(leagueId, teamId), config)
}
