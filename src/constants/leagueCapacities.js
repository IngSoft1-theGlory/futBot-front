// Cupos permitidos para una liga: de 4 a 12 equipos, solo números pares
// (así el fixture no deja a ningún equipo libre en cada fecha).
export const LEAGUE_MIN_TEAMS = 4
export const LEAGUE_MAX_TEAMS = 12

export const LEAGUE_CAPACITIES = Array.from(
  { length: (LEAGUE_MAX_TEAMS - LEAGUE_MIN_TEAMS) / 2 + 1 },
  (_, index) => LEAGUE_MIN_TEAMS + index * 2
) // [4, 6, 8, 10, 12]
