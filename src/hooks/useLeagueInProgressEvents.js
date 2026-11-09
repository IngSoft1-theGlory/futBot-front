import { useGlobalEvent } from "./useGlobalEvent"

// Eventos del canal global que cambian una liga en curso
const MATCH_STARTED = "MATCH_STARTED"
const LEAGUE_MATCH_FINISHED = "LEAGUE_MATCH_FINISHED"
const LEAGUE_FINISHED = "LEAGUE_FINISHED"

/* 
 true si el partido esta en el fixture que ya se cargo
 mientras la liga no cargo, fixture es undefined y se devuelve false
*/
function isMatchInFixture(fixture, matchId) {
  if (!Array.isArray(fixture)) return false
  return fixture.some((match) => match.match_id === matchId)
}
/*
mantiene actualizada una liga en curso: cuando el canal global avisa algo de ESTA liga, llama a refetchLeague() para volver a pedirla al backend

- refetchLeague: vuelve a pedir la liga, si falla, deja lo que ya se ve

todo lo que la pantalla muestre a partir de la liga (tabla, fixture, estado)
se actualiza solo cuando refetchLeague guarda la respuesta nueva
*/
export function useLeagueInProgressEvents(leagueId, fixture, refetchLeague) {
  /* 
  MATCH_STARTED llega para cualquier partido (tambien los amistosos):
  se sabe que es de esta liga porque el partido está en su fixture
  */
  useGlobalEvent(MATCH_STARTED, (data) => {
    if (isMatchInFixture(fixture, data?.match_id)) refetchLeague()
  })

  // Terminó un partido de la liga: cambian la tabla y el fixture
  useGlobalEvent(LEAGUE_MATCH_FINISHED, (data) => {
    if (data?.league_id === Number(leagueId)) refetchLeague()
  })

  // Terminó la liga: la respuesta llega con status FINISHED y se muestra "Finalizada"
  useGlobalEvent(LEAGUE_FINISHED, (data) => {
    if (data?.league_id === Number(leagueId)) refetchLeague()
  })
}
