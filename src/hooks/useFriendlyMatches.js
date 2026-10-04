import { useCallback, useEffect, useRef, useState } from "react"
import {fetchFriendlyMatches, FRIENDLY_LIMIT_DEFAULT, FRIENDLY_PAGE_DEFAULT, FRIENDLY_STATUS_PENDING,} from "../services/friendlies"
import {
  applyFriendlyEvent,
  FRIENDLY_CANCELLED,
  FRIENDLY_CREATED,
  GUEST_JOINED_FRIENDLY,
  MATCH_STARTED,
} from "../services/friendlyEvents"
import { useGlobalEvent } from "./useGlobalEvent"

/*
Hook para la sección de amistosos disponibles. Se encarga de:
- Pedir la lista al backend (GET /friendly) cada vez que cambian page/limit/status.
- Mantener la lista actualizada en tiempo real con los eventos del canal global
  (FRIENDLY_CREATED, FRIENDLY_CANCELLED, GUEST_JOINED_FRIENDLY, MATCH_STARTED).
- Exponer matches, loading, error y total para que la UI los use.
- Ofrecer setPage/setLimit/setStatus y refetch para paginar, filtrar y
  refrescar la lista sin que la UI tenga que saber nada de httpService.
*/
export function useFriendlyMatches({ initialPage = FRIENDLY_PAGE_DEFAULT, initialLimit = FRIENDLY_LIMIT_DEFAULT, status = FRIENDLY_STATUS_PENDING,} = {} )/*ver nota1 abajo de estp*/ {
  const [page, setPage] = useState(initialPage)
  const [limit, setLimit] = useState(initialLimit)
  const [currentStatus, setStatus] = useState(status)

  // matches y total van juntos para poder actualizarlos a la vez con cada evento
  const [list, setList] = useState({ matches: [], total: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  // Eventos que llegan mientras se está pidiendo la lista. Se aplican sobre la
  // respuesta del backend para no perderlos (ver nota4).
  const isLoadingRef = useRef(true)
  const pendingEventsRef = useRef([])

  const load = useCallback(async () => {
    setIsLoading(true)
    setError("")
    isLoadingRef.current = true
    pendingEventsRef.current = []

    try { //ver nota2
      const data = await fetchFriendlyMatches({ page, limit, status: currentStatus })
      const matches = pendingEventsRef.current.reduce(
        (current, { eventName, eventData }) => applyFriendlyEvent(current, eventName, eventData),
        data.matches
      )
      setList({ matches, total: data.total + (matches.length - data.matches.length) })
    } catch {
      // No distinguimos ApiError de error de red acá: en ambos casos la
      // acción correcta para este listado es la misma, mostrar un aviso y
      // dejar la lista anterior sin tocar para no dejar la UI inconsistente.
      setError("No se pudieron cargar los amistosos disponibles. Intentá de nuevo más tarde.")
    } finally {
      isLoadingRef.current = false
      pendingEventsRef.current = []
      setIsLoading(false)
    }
  }, [page, limit, currentStatus])

  useEffect(() => { //ver nota3
    load()
  }, [load])

  // Los eventos solo tienen sentido si se están mostrando los amistosos disponibles
  const listensToEvents = currentStatus === FRIENDLY_STATUS_PENDING

  function handleEvent(eventName, eventData) {
    if (!listensToEvents) return

    if (isLoadingRef.current) {
      pendingEventsRef.current.push({ eventName, eventData })
      return
    }

    setList((current) => {
      const matches = applyFriendlyEvent(current.matches, eventName, eventData)
      if (matches === current.matches) return current
      return { matches, total: current.total + (matches.length - current.matches.length) }
    })
  }

  // Cada suscripción se cancela sola al salir de la página (ver useGlobalEvent)
  useGlobalEvent(FRIENDLY_CREATED, (data) => handleEvent(FRIENDLY_CREATED, data))
  useGlobalEvent(FRIENDLY_CANCELLED, (data) => handleEvent(FRIENDLY_CANCELLED, data))
  useGlobalEvent(GUEST_JOINED_FRIENDLY, (data) => handleEvent(GUEST_JOINED_FRIENDLY, data))
  useGlobalEvent(MATCH_STARTED, (data) => handleEvent(MATCH_STARTED, data))

  return {
    matches: list.matches,
    total: list.total,
    isLoading,
    error,
    isEmpty: !isLoading && !error && list.matches.length === 0,
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

nota4 =
Si un evento llega mientras se espera la respuesta del GET, aplicarlo directo sobre la lista
no sirve: cuando llega la respuesta, setList la pisa y el evento se pierde (por ejemplo, un
amistoso creado justo después de que el backend armó la respuesta). Por eso se guardan en
pendingEventsRef y se aplican sobre la respuesta. Si el amistoso creado ya venía en la
respuesta, applyFriendlyEvent no lo duplica.
*/
