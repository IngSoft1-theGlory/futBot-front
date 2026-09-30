import { useCallback, useEffect, useState } from "react"
import {fetchFriendlyMatches, FRIENDLY_LIMIT_DEFAULT, FRIENDLY_PAGE_DEFAULT, FRIENDLY_STATUS_PENDING,} from "../services/friendlies"

/*
Hook para la sección de amistosos disponibles. Se encarga de:
- Pedir la lista al backend (GET /friendly) cada vez que cambian page/limit/status.
- Exponer matches, loading, error y total para que la UI los use.
- Ofrecer setPage/setLimit/setStatus y refetch para paginar, filtrar y
  refrescar la lista sin que la UI tenga que saber nada de httpService.

Todavía no existe la pantalla que consume esto: este hook es la capa de
datos lista para que, cuando se construya la UI, sólo haga
`const { matches, isLoading, error, ... } = useFriendlyMatches()`.
*/
export function useFriendlyMatches({ initialPage = FRIENDLY_PAGE_DEFAULT, initialLimit = FRIENDLY_LIMIT_DEFAULT, status = FRIENDLY_STATUS_PENDING,} = {} )/*ver nota1 abajo de estp*/ {
  const [page, setPage] = useState(initialPage)
  const [limit, setLimit] = useState(initialLimit)
  const [currentStatus, setStatus] = useState(status)

  const [matches, setMatches] = useState([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setIsLoading(true)
    setError("")

    try { //ver nota2
      const data = await fetchFriendlyMatches({ page, limit, status: currentStatus })
      setMatches(data.matches)
      setTotal(data.total)
    } catch {
      // No distinguimos ApiError de error de red acá: en ambos casos la
      // acción correcta para este listado es la misma, mostrar un aviso y
      // dejar la lista anterior sin tocar para no dejar la UI inconsistente.
      setError("No se pudieron cargar los amistosos disponibles. Intentá de nuevo más tarde.")
    } finally {
      setIsLoading(false)
    }
  }, [page, limit, currentStatus])

  useEffect(() => { //ver nota3
    load()
  }, [load])

  return {
    matches,
    total,
    isLoading,
    error,
    isEmpty: !isLoading && !error && matches.length === 0,
    page,
    limit,
    status: currentStatus,
    setPage,
    setLimit,
    setStatus,
    refetch: load,
  }
}

/*

hook = es una función o mecanismo que permite "engancharse" a un código existente para modificar o ampliar su comportamiento sin alterar su estructura original

nota1 = 
useFriendlyMatches({ initialPage = FRIENDLY_PAGE_DEFAULT, initialLimit = FRIENDLY_LIMIT_DEFAULT,status = FRIENDLY_STATUS_PENDING,} = {})

Es un hook que se llama así: useFriendlyMatches() o useFriendlyMatches({ initialPage: 2 }). El = {} al final significa "si no me pasás nada, asumí un objeto vacío" (para que useFriendlyMatches() sin argumentos no explote al intentar destructurar undefined). Adentro, cada campo también tiene su propio default (initialPage = 1, etc), mismo patrón que en friendlies.js

nota2 =
try/catch/finally funciona asi

1) Antes de arrancar, prende el loading y borra cualquier error viejo.
2) Llama a fetchFriendlyMatches (la función de friendlies.js) con los valores actuales de page/limit/currentStatus.
3) Si sale bien, guarda matches y total en el estado
4) Si falla (catch, sin capturar el error en una variable porque no lo necesito, a diferencia de handleRequestError que sí distinguía tipos de error), pone un mensaje genérico de error. Acá no distingo ApiError de error de red como en CreatePlayerPage, porque para este listado la reacción es la misma en cualquier caso: mostrar el aviso y no tocar la lista anterior
5) finally siempre apaga el loading, haya salido bien o mal

nota3 =
useEffect basicamente lo que hace es cada vez que load cambie, ejecutala". Y como load (por el useCallback de arriba) solo cambia cuando cambian page, limit o currentStatus, en la práctica este efecto se traduce a: "pedí la lista al backend cada vez que cambie la página, el límite o el filtro de estado". Y también se dispara una vez al montar el componente (primera carga)
*/