import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ApiError } from "../services/createhttpService"
import { fetchMatchState, fetchMatchTeams } from "../services/matches"
import { openMatchSocket } from "../services/matchSocket"
import { applyTick, applyFullState, isMatchOver, MATCH_FINISHED } from "../services/matchState"
import { useGlobalEvent } from "./useGlobalEvent"

// Este hook hace TODO el trabajo "invisible" de la pantalla del partido:
//   1. carga el estado inicial (partido + equipos) en paralelo
//   2. abre la conexión en vivo y aplica cada TICK_UPDATE
//   3. si la conexión se corta, avisa y al volver pide el estado de nuevo
//   4. cuando el partido termina, navega al resultado
//   5. al salir de la pantalla, cierra la conexión
//
// Devuelve lo que la pantalla necesita para dibujarse:
//   status:       "loading" | "ready" | "connection-error" | "not-participant" | "not-found"
//   match:        estado del partido { currentTick, totalTicks, score, ball, players }
//   teams:        { home, away } con { id, name, logo }
//   reconnecting: true mientras la conexión en vivo está cortada
//   retry:        función para volver a intentar después de un error de conexión

export function useMatchLive(matchId) {
  const navigate = useNavigate()

  const [status, setStatus] = useState("loading")
  const [match, setMatch] = useState(null)
  const [teams, setTeams] = useState(null)
  const [reconnecting, setReconnecting] = useState(false)
  // Cada vez que sube este número, el efecto de abajo vuelve a correr (es el "reintentar")
  const [attempt, setAttempt] = useState(0)

  const resultPath = `/matches/${matchId}/result`

  // Fin del partido, forma 1: el canal global avisa MATCH_FINISHED con el id de ESTE partido
  useGlobalEvent(MATCH_FINISHED, (data) => {
    if (data?.match_id === Number(matchId)) navigate(resultPath, { replace: true })
  })

  // Fin del partido, forma 2: el tick actual alcanzó el total de ticks
  const isOver = match ? isMatchOver(match) : false
  useEffect(() => {
    if (isOver) navigate(resultPath, { replace: true })
  }, [isOver, resultPath])

  // Efecto principal: se ejecuta al entrar a la pantalla (y al reintentar)
  useEffect(() => {
    // Pasa a false cuando la pantalla se cierra. Evita que respuestas que llegan
    // tarde (de pedidos viejos) cambien el estado de una pantalla que ya no existe.
    let isActive = true
    let connection = null

    setStatus("loading")
    setMatch(null)
    setReconnecting(false)

    // Decide qué hacer según el error que devolvió el backend
    function handleError(error) {
      if (!isActive) return

      if (error instanceof ApiError) {
        if (error.status === 401) return // la gestión de sesión se encarga
        if (error.error === "MATCH_PENDING") {
          navigate(`/friendlies/${matchId}`, { replace: true }) // todavía no empezó: al lobby
          return
        }
        if (error.error === "MATCH_FINISHED") {
          navigate(resultPath, { replace: true }) // ya terminó: al resultado
          return
        }
        if (error.status === 403) {
          setStatus("not-participant")
          return
        }
        if (error.status === 404) {
          setStatus("not-found")
          return
        }
      }

      // Cualquier otra cosa (sin internet, error 500...): error de conexión con "Reintentar"
      setStatus("connection-error")
    }

    // Al reconectar, pedimos el estado de nuevo para recuperar lo que pasó mientras
    // estuvimos desconectados (marcador y tick de los ticks perdidos)
    function resync() {
      fetchMatchState(matchId)
        .then((freshState) => {
          if (isActive) setMatch((current) => applyFullState(current, freshState))
        })
        .catch((error) => {
          // Si el pedido falla no pasa nada grave: el próximo tick actualizará todo.
          // Solo reaccionamos si el backend dice algo definitivo (ej: el partido terminó).
          if (error instanceof ApiError) handleError(error)
        })
    }

    async function start() {
      // 1) Carga inicial: los dos pedidos salen a la vez y esperamos a que lleguen ambos
      try {
        const [initialState, initialTeams] = await Promise.all([
          fetchMatchState(matchId),
          fetchMatchTeams(matchId),
        ])
        if (!isActive) return // la pantalla se cerró mientras esperábamos

        setMatch(initialState)
        setTeams(initialTeams)
        setStatus("ready")
      } catch (error) {
        handleError(error)
        return
      }

      // 2) Conexión en vivo (una sola por pantalla)
      connection = openMatchSocket(matchId, {
        onTick: (tick) => {
          if (isActive) setMatch((current) => applyTick(current, tick))
        },
        onConnected: (isReconnection) => {
          if (!isActive) return
          setReconnecting(false)
          if (isReconnection) resync()
        },
        onDisconnected: () => {
          // Solo se muestra el aviso: NO se borra el último estado mostrado
          if (isActive) setReconnecting(true)
        },
        onFirstConnectionFailed: () => {
          if (isActive) setStatus("connection-error")
        },
        onRejected: handleError,
      })
    }

    start()

    // Al salir de la pantalla (o antes de reintentar): se cierra la conexión
    return () => {
      isActive = false
      connection?.close()
    }
  }, [matchId, attempt])

  function retry() {
    setAttempt((current) => current + 1)
  }

  return { status, match, teams, reconnecting, retry }
}
