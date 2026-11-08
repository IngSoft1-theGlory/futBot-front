import { useEffect, useState } from "react"
import { httpService, ApiError } from "../../services/createhttpService"
import Button from "../Button/Button"
import { BEHAVIOR_TYPE_LABELS } from "../../constants/behaviorTypes"
import "./BehaviorDetail.css"

// elige que mensaje mostrar segun el error que devolvio el backend
function getErrorMessage(err) {
  if (err instanceof ApiError) {
    if (err.status === 403) return "No tenés permiso para ver este comportamiento."
    if (err.status === 404) return "El comportamiento no existe o fue eliminado."
    return err.message   // Mensaje del contrato
  }
  return "No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo."
}
/*
 Panel de lectura con el detalle de un comportamientoy un botón para editar
 Props:
   behaviorId: id del comportamiento que se eligio en la coleccion
   onBack:     función para volver a la colección
   onEdit:     función callback que se ejecuta al hacer clic en "Editar"
*/
function BehaviorDetail({ behaviorId, onBack, onEdit }) {
  const [behavior, setBehavior] = useState(null)    // El comportamiento que devuelve el backend
  const [error, setError] = useState("")            // Mensaje de error para mostrar
  const [status, setStatus] = useState("loading")   // Estado del panel: "loading", "success" o "error"

  useEffect(() => {
    let isActive = true   // Pasa a false si se cierra el panel antes de que llegue la respuesta

    httpService
      .get(`/behaviors/${behaviorId}`)
      .then((data) => {
        if (!isActive) return
        setBehavior(data)       // Guarda el comportamiento
        setStatus("success")    // Ya se puede mostrar
      })
      .catch((err) => {
        if (!isActive) return

        // 401: la sesión vencio,el servicio HTTP ya la cerro, asi que la app, redirige sola a /login y ahi avisa que la sesion expir
        if (err instanceof ApiError && err.status === 401) return

        setError(getErrorMessage(err))   // Setea el mensaje de error llamando a la función
        setStatus("error")
      })

    return () => {
      isActive = false   // Evita setear el estado de un componente desmontado
    }
  }, [behaviorId])

  // texto del tipo ("Jugador" o "DT"), mientras carga, behavior es null y no hay nada que mostrar, si el back manda un tipo desconocido, también queda vacío y la etiqueta no se muestra
  const typeLabel = behavior && BEHAVIOR_TYPE_LABELS[behavior.behavior_type]

  return (
    <section className="behavior-detail">
      <div className="behavior-detail__toolbar">
        <button type="button" className="behavior-detail__back" onClick={onBack}>
           Volver a la colección
        </button>

        {status === "success" && !behavior.is_default && (
          <Button onClick={onEdit}>Editar</Button>
        )}
      </div>

      {status === "loading" && (
        <p className="behavior-detail__message" role="status">
          Cargando comportamiento...
        </p>
      )}

      {status === "error" && (
        <p className="behavior-detail__message behavior-detail__message--error" role="alert">
          {error}
        </p>
      )}

      {status === "success" && (
        <div className="behavior-detail__content">
          <div className="behavior-detail__header">
            <h2 className="behavior-detail__name">{behavior.name}</h2>
            {typeLabel && <span className="behavior-detail__badge">{typeLabel}</span>}
            {/* La etiqueta solo aparece si es un comportamiento por default */}
            {behavior.is_default && <span className="behavior-detail__badge">Por default</span>}
          </div>

          <h3 className="behavior-detail__subtitle">Descripción:</h3>
          <p className="behavior-detail__description">{behavior.description}</p>

          <h3 className="behavior-detail__subtitle">Código:</h3>
          {/* <pre> muestra el texto tal cual (respeta espacios y saltos de línea) y no se puede editar */}
          <pre className="behavior-detail__code">{behavior.code}</pre>
        </div>
      )}
    </section>
  )
}

export default BehaviorDetail
