import { httpService, ApiError } from "./createhttpService"

// Conexión única al canal WebSocket global (WS /ws/v1/global).
// - connect(): pide el token de acceso y abre la conexión.
// - disconnect(): cierra la conexión y cancela cualquier reconexión pendiente.
// - subscribe(evento, listener): recibe la `data` de ese evento. Devuelve la función para desuscribirse.

const TOKEN_PATH = "/live-token/global"
const BASE_RECONNECT_DELAY_MS = 1000
const MAX_RECONNECT_DELAY_MS = 30000

// nombre del evento -> Set de listeners
const listeners = new Map()

let socket = null
let shouldBeConnected = false // false después de disconnect() o de un 401
let reconnectAttempt = 0
let reconnectTimer = null

// Se incrementa en cada intento de conexión y en cada disconnect().
// Sirve para descartar respuestas de token que llegan tarde (por ejemplo, si se cerró
// la sesión mientras se pedía el token).
let connectionId = 0

// Suscripcion al canal

export function subscribe(eventName, listener) {
  if (!listeners.has(eventName)) {
    listeners.set(eventName, new Set())
  }
  listeners.get(eventName).add(listener)

  return () => {
    const eventListeners = listeners.get(eventName)
    if (!eventListeners) return
    eventListeners.delete(listener)
    if (eventListeners.size === 0) listeners.delete(eventName)
  }
}

// Mensaje esperado: { "event": "NOMBRE", "data": {...} } //sujeto a cambios en base a resolucion del back
function dispatch(rawMessage) {
  let message
  try {
    message = JSON.parse(rawMessage)
  } catch {
    return // formato inválido: se ignora
  }

  if (!message || typeof message.event !== "string") return

  const eventListeners = listeners.get(message.event)
  if (!eventListeners) return // evento desconocido o sin suscriptores

  // Se copia el Set por si algún listener se desuscribe mientras se recorre
  for (const listener of [...eventListeners]) {
    try {
      listener(message.data)
    } catch (error) {
      // Un error en una pantalla no debe afectar a las demás ni a la conexión
      console.error(`Error al procesar el evento ${message.event}:`, error)
    }
  }
}

// Conexión

export function connect() {
  if (shouldBeConnected) return // ya conectado o conectando: una sola conexión

  shouldBeConnected = true
  reconnectAttempt = 0
  openConnection()
}

export function disconnect() {
  shouldBeConnected = false
  connectionId += 1

  clearTimeout(reconnectTimer)
  reconnectTimer = null

  if (socket) {
    const closingSocket = socket
    socket = null
    closingSocket.onopen = null
    closingSocket.onmessage = null
    closingSocket.onclose = null
    closingSocket.onerror = null
    closingSocket.close()
  }
}

async function openConnection() {
  const currentId = ++connectionId

  let websocketUrl
  try {
    const data = await httpService.post(TOKEN_PATH)
    websocketUrl = data?.websocket_url
    if (!websocketUrl) throw new Error("La respuesta no incluye websocket_url")
  } catch (error) {
    if (currentId !== connectionId) return

    // 401: la sesión no es válida. createHttpService ya se encarga de cerrarla.
    if (error instanceof ApiError && error.status === 401) {
      shouldBeConnected = false
      return
    }

    // Cualquier otro error se trata como un corte
    scheduleReconnect()
    return
  }

  // Se desconectó mientras se pedía el token
  if (currentId !== connectionId) return

  const newSocket = new WebSocket(websocketUrl)
  socket = newSocket

  newSocket.onopen = () => {
    reconnectAttempt = 0 // conexión exitosa: se reinician las esperas
  }

  newSocket.onmessage = (messageEvent) => {
    dispatch(messageEvent.data)
  }

  // El navegador siempre dispara onclose después de un error, así que la
  // reconexión se maneja solo acá.
  newSocket.onclose = () => {
    if (socket !== newSocket) return
    socket = null
    scheduleReconnect()
  }
}

// Esperas crecientes: 1s, 2s, 4s, 8s hasta un máximo de 30s
function scheduleReconnect() {
  if (!shouldBeConnected || reconnectTimer) return

  const delay = Math.min(BASE_RECONNECT_DELAY_MS * 2 ** reconnectAttempt, MAX_RECONNECT_DELAY_MS)
  reconnectAttempt += 1

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    if (shouldBeConnected) openConnection()
  }, delay)
}