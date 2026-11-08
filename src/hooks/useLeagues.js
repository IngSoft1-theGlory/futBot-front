import { useCallback, useEffect, useState } from "react"
import { fetchLeagues, LEAGUE_LIMIT_DEFAULT } from "../services/leagues"
import { useGlobalEvent } from "./useGlobalEvent"

const LEAGUE_CREATED = "LEAGUE_CREATED"
const LEAGUE_CANCELLED = "LEAGUE_CANCELLED"
/*
 trae las ligas disponibles de la pagina y permite cambiar de pagina, cuando alguien crea o cancela una liga (eventos LEAGUE_CREATED y LEAGUE_CANCELLED) vuelve a pedir la lista
*/
export function useLeagues(limit = LEAGUE_LIMIT_DEFAULT) {
  const [page, setPage] = useState(1)
  const [leagues, setLeagues] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setIsLoading(true)
    setError("")
    try {
      setLeagues(await fetchLeagues({ page, limit }))
    } catch {
      setError("No se pudieron cargar las ligas. Intentá de nuevo más tarde.")
    } finally {
      setIsLoading(false)
    }
  }, [page, limit])

  useEffect(() => {
    load()
  }, [load])

  useGlobalEvent(LEAGUE_CREATED, load)
  useGlobalEvent(LEAGUE_CANCELLED, load)

  return {
    leagues,
    isLoading,
    error,
    page,
    // si llegaron menos ligas que el limite, no hay pagina siguiente
    hasNextPage: leagues.length >= limit,
    goToPreviousPage: () => setPage((current) => current - 1),
    goToNextPage: () => setPage((current) => current + 1),
  }
}
