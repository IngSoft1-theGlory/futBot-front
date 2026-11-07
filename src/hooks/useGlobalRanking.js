import { useCallback, useEffect, useState, useRef } from "react"
import { fetchGlobalRanking, RANKING_LIMIT_DEFAULT, RANKING_PAGE_DEFAULT } from "../services/rankings"
import { useGlobalEvent } from "./useGlobalEvent"

const RANKING_UPDATED = "RANKING_UPDATED"

/*
 trae una pagina del ranking global y permite pasar de pagina y reintentar si falla
*/
export function useGlobalRanking(limit = RANKING_LIMIT_DEFAULT) {
  const [page, setPage] = useState(RANKING_PAGE_DEFAULT)   // página actual del ranking
  const [ranking, setRanking] = useState([])               // equipos del ranking
  const [hasNextPage, setHasNextPage] = useState(false)    // indica si hay pág. siguiente
  const [isLoading, setIsLoading] = useState(true)         // estado de carga
  const [error, setError] = useState("")                   // mensaje de error
  const loadIdRef = useRef(0)             // contador que identifica la carga más reciente
  const seqRef = useRef(0)         // asigna un orden a cada request de carga o refresco
  const appliedSeqRef = useRef(0)  // número de la solicitud cuyos datos se están mostrando

  const load = useCallback(async () => {     // carga la página actual del ranking
    loadIdRef.current += 1
    const loadId = loadIdRef.current
    seqRef.current += 1
    const seq = seqRef.current
    setIsLoading(true)
    setError("")
    try {
      const data = await fetchGlobalRanking({ page, limit })
      if (loadId !== loadIdRef.current || seq < appliedSeqRef.current) return
      appliedSeqRef.current = seq
      setRanking(data.ranking)
      setHasNextPage(data.hasNextPage)
    } catch {
      if (loadId !== loadIdRef.current || seq < appliedSeqRef.current) return
      setError("No se pudo cargar el ranking. Intentá de nuevo.")
    } finally {
      if (loadId === loadIdRef.current) setIsLoading(false)
    }
  }, [page, limit])

  // refresh silencioso
  const refresh = useCallback(async () => {
    const loadId = loadIdRef.current
    seqRef.current += 1
    const seq = seqRef.current
    try {
      const data = await fetchGlobalRanking({ page, limit })
      if (loadId !== loadIdRef.current || seq < appliedSeqRef.current) return
      appliedSeqRef.current = seq
      setRanking(data.ranking)
      setHasNextPage(data.hasNextPage)
      setError("")        // si sale bien, limpia el error anterior
    } catch (err) {
      console.error("No se pudo actualizar el ranking:", err)
    }
  }, [page, limit])

  useGlobalEvent(RANKING_UPDATED, refresh)

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
