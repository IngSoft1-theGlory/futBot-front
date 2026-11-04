import { useCallback, useEffect, useState } from "react"
import { fetchGlobalRanking, RANKING_LIMIT_DEFAULT, RANKING_PAGE_DEFAULT } from "../services/rankings"

/*
 trae una pagina del ranking global y permite pasar de pagina y reintentar si falla
*/
export function useGlobalRanking(limit = RANKING_LIMIT_DEFAULT) {
  const [page, setPage] = useState(RANKING_PAGE_DEFAULT)
  const [ranking, setRanking] = useState([])
  const [hasNextPage, setHasNextPage] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setIsLoading(true)
    setError("")
    try {
      const data = await fetchGlobalRanking({ page, limit })
      setRanking(data.ranking)
      setHasNextPage(data.hasNextPage)
    } catch {
      setError("No se pudo cargar el ranking. Intentá de nuevo.")
    } finally {
      setIsLoading(false)
    }
  }, [page, limit])

  useEffect(() => {
    load()
  }, [load])

  return {
    ranking,
    isLoading,
    error,
    isEmpty: !isLoading && !error && ranking.length === 0,
    page,
    hasNextPage,
    goToPreviousPage: () => setPage((current) => Math.max(RANKING_PAGE_DEFAULT, current - 1)),
    goToNextPage: () => setPage((current) => current + 1),
    refetch: load,
  }
}
