import { ApiError } from "./createhttpService"
import { requestMatchWebsocketUrl } from "./matches"

// Conexión en vivo a UN partido (WS /ws/v1/matches/{matchId}).
//
// A diferencia del canal global (globalSocket.js), que es único para toda la app,
// esta conexión es de una pantalla: se crea al entrar y se cierra al salir.
// Sigue las mismas reglas que el canal global:
//   - una sola conexión a la vez
//   - un token nuevo en cada intento
//   - si se corta, reintenta esperando cada vez más (1s, 2s, 4s... hasta 30s)
//
// Uso:
//   const connection = openMatchSocket(matchId, { onTick, onConnected, ... })
//   connection.close()   // al salir de la pantalla

const BASE_RECONNECT_DELAY_MS = 1000
const MAX_RECONNECT_DELAY_MS = 30000

// Errores del backend que reintentar no arregla (partido terminado, sin permiso, etc.)
// Se los avisamos a la pantalla para que decida qué mostrar.
function isFinalError(error) {
  return error instanceof ApiError && [400, 403, 404].includes(error.status)
}

/*
 callbacks:
   onTick(mensaje)       llegó un TICK_UPDATE
   onPauseStarted(mensaje)  llegó un PAUSE_STARTED (empezó una pausa)
   onPauseFinished(mensaje) llegó un PAUSE_FINISHED (terminó la pausa)
   onConnected(esReconexion) la conexión quedó abierta (true si antes ya se había cortado)
   onDisconnected()      se cortó una conexión que ya había funcionado (se va a reintentar)
   onFirstConnectionFailed() falló el PRIMER intento: no se reintenta, la pantalla ofrece un botón
   onRejected(error)     el backend rechazó el pedido con un error definitivo (400/403/404)
*/
export function openMatchSocket(matchId, callbacks) {
  const { onTick, onPauseStarted, onPauseFinished, onConnected, onDisconnected, onFirstConnectionFailed, onRejected,} = callbacks

  let isClosed = false // true cuando la pantalla pidió cerrar (o ya no hay que reintentar)
  let socket = null
  let hasConnectedBefore = false // ¿alguna vez se abrió la conexión?
  let attempt = 0 // cuántos reintentos seguidos fallaron (sirve para calcular la espera)
  let retryTimer = null

  // Se llama cuando un intento falla (no se pudo pedir el token o se cortó el socket)
  function handleFailure() {
    if (isClosed) return

    // Si nunca llegó a conectar, no reintentamos solos: avisamos para mostrar el error
    if (!hasConnectedBefore) {
      close()
      onFirstConnectionFailed()
      return
    }

    // Ya había funcionado: avisamos del corte y reintentamos más tarde
    onDisconnected()
    scheduleRetry()
  }

  // Espera cada vez más antes de reintentar: 1s, 2s, 4s, 8s... con tope de 30s
  function scheduleRetry() {
    if (isClosed || retryTimer) return

    const delay = Math.min(BASE_RECONNECT_DELAY_MS * 2 ** attempt, MAX_RECONNECT_DELAY_MS)
    attempt += 1

    retryTimer = setTimeout(() => {
      retryTimer = null
      connect()
    }, delay)
  }

  async function connect() {
    // 1) Pedimos un token nuevo (siempre uno nuevo, los tokens duran poco)
    let websocketUrl
    try {
      websocketUrl = await requestMatchWebsocketUrl(matchId)
    } catch (error) {
      if (isClosed) return // la pantalla se cerró mientras esperábamos

      // 401: la gestión de sesión se encarga (cierra la sesión y redirige al login)
      if (error instanceof ApiError && error.status === 401) {
        close()
        return
      }

      // Error definitivo: se lo pasamos a la pantalla
      if (isFinalError(error)) {
        close()
        onRejected(error)
        return
      }

      handleFailure() // cualquier otro error (red, 500...)
      return
    }

    // Si la pantalla se cerró mientras esperábamos el token, no abrimos nada
    if (isClosed) return

    // 2) Abrimos el websocket con la URL recibida
    const newSocket = new WebSocket(websocketUrl)
    socket = newSocket

    newSocket.onopen = () => {
      const isReconnection = hasConnectedBefore
      hasConnectedBefore = true
      attempt = 0 // conectó bien: reiniciamos las esperas
      onConnected(isReconnection)
    }

    newSocket.onmessage = (messageEvent) => {
      let message
      try {
        message = JSON.parse(messageEvent.data)
      } catch {
        return // mensaje que no es JSON: se ignora
      }

      // El motor manda los datos junto al nombre del evento:
      // { "event": "TICK_UPDATE", "current_tick": 10, ... }
      // { "event": "PAUSE_STARTED", "type": "...", "duration_seconds": 30, "current_tick": 600 }
      // { "event": "PAUSE_FINISHED", "type": "..." }
      if (message?.event === "TICK_UPDATE") onTick(message)
      else if (message?.event === "PAUSE_STARTED") onPauseStarted(message)
      else if (message?.event === "PAUSE_FINISHED") onPauseFinished(message)
    }

    // El navegador siempre llama a onclose (también después de un error),
    // así que los cortes se manejan solo acá.
    newSocket.onclose = () => {
      if (socket !== newSocket) return // es un socket viejo, ya no nos importa
      socket = null
      handleFailure()
    }
  }

  // Cierra todo y deja de procesar eventos. Se puede llamar más de una vez sin problema.
  function close() {
    isClosed = true

    clearTimeout(retryTimer)
    retryTimer = null

    if (socket) {
      const closingSocket = socket
      socket = null
      // Se sueltan los handlers para que nada más se procese después de cerrar
      closingSocket.onopen = null
      closingSocket.onmessage = null
      closingSocket.onclose = null
      closingSocket.close()
    }
  }

  connect()

  return { close }
}
