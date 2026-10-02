import { useEffect, useRef } from "react"
import { subscribe } from "../services/globalSocket"

// Ejecuta handler(data) cada vez que llega `eventName` por el canal global.
// Se desuscribe solo cuando el componente se desmonta.
export function useGlobalEvent(eventName, handler) {
  // Se guarda el handler más reciente para no resuscribirse en cada render
  const handlerRef = useRef(handler)

  useEffect(() => {
    handlerRef.current = handler
  })

  useEffect(() => {
    return subscribe(eventName, (data) => handlerRef.current(data))
  }, [eventName])
}