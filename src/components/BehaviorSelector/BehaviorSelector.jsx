import { useState } from "react"
import Button from "../Button/Button"
import { ApiError } from "../../services/createhttpService"
import { fetchBehaviors } from "../../services/behaviors"
import { changePlayerBehavior } from "../../services/matches"
import "./BehaviorSelector.css"

const SUCCESS_MESSAGE = "Listo: el nuevo comportamiento se aplica desde el próximo tick."
const NETWORK_ERROR_MESSAGE =
  "No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo."
const LOAD_ERROR_MESSAGE = "No se pudieron cargar los comportamientos."

// Único lugar donde se traduce cada código de error del contrato.
// Si el código no está, se usa el message que manda el backend.
const ERROR_MESSAGES = {
  MATCH_FINISHED: "El partido ya terminó: no se puede cambiar el comportamiento.",
  UNAUTHORIZED_ACTION: "Solo podés cambiar el comportamiento de tus jugadores.",
  INVALID_BEHAVIOR: "Ese comportamiento no está disponible para tu equipo.",
  RESOURCE_NOT_FOUND: "No se encontró el jugador o el comportamiento elegido.",
}

function getErrorMessage(error) {
  if (!(error instanceof ApiError)) return NETWORK_ERROR_MESSAGE
  return ERROR_MESSAGES[error.error] ?? error.message
}

function isSessionError(error) {
  return error instanceof ApiError && error.status === 401
}

/*
 Selector para cambiar el comportamiento de un jugador propio durante el partido.
 - Cada vez que se abre, pide la lista actualizada de comportamientos.
 - Al confirmar, llama al endpoint y avisa el nuevo behavior_id con onChanged.
   El motor lo aplica desde el próximo tick.
*/
function BehaviorSelector({ matchId, playerId, currentBehaviorId, onChanged }) {
  const [isOpen, setIsOpen] = useState(false)
  const [loadStatus, setLoadStatus] = useState("idle") // idle | loading | ready | error
  const [behaviors, setBehaviors] = useState([])
  const [selectedId, setSelectedId] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")

  function loadBehaviors() {
    setLoadStatus("loading")
    fetchBehaviors()
      .then((list) => {
        setBehaviors(list)
        setLoadStatus("ready")
      })
      .catch((err) => {
        if (isSessionError(err)) return
        setLoadStatus("error")
      })
  }

  function handleOpen() {
    setIsOpen(true)
    setSelectedId("")
    setError("")
    setSuccessMessage("")
    loadBehaviors()
  }

  function handleCancel() {
    setIsOpen(false)
    setError("")
  }

  async function handleConfirm() {
    // Sin selección o con un envío en curso no se manda nada
    if (!selectedId || isSubmitting) return

    setIsSubmitting(true)
    setError("")

    try {
      const data = await changePlayerBehavior(matchId, playerId, Number(selectedId))
      onChanged(data?.behavior_id ?? Number(selectedId))
      setSuccessMessage(SUCCESS_MESSAGE)
      setIsOpen(false)
    } catch (err) {
      // Ante un error no se toca el comportamiento del jugador: queda el anterior
      if (!isSessionError(err)) setError(getErrorMessage(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) {
    return (
      <div className="behavior-selector">
        {successMessage && (
          <p className="behavior-selector__success" role="status">
            {successMessage}
          </p>
        )}
        <Button variant="secondary" onClick={handleOpen}>
          Cambiar comportamiento
        </Button>
      </div>
    )
  }

  const isSameAsCurrent = Number(selectedId) === currentBehaviorId
  const canConfirm = selectedId !== "" && !isSameAsCurrent && !isSubmitting

  return (
    <div className="behavior-selector behavior-selector--open">
      {loadStatus === "loading" && <p className="behavior-selector__hint">Cargando comportamientos...</p>}

      {loadStatus === "error" && (
        <div className="behavior-selector__error" role="alert">
          <span>{LOAD_ERROR_MESSAGE}</span>
          <Button variant="secondary" onClick={loadBehaviors}>
            Reintentar
          </Button>
        </div>
      )}

      {loadStatus === "ready" && (
        <>
          <label className="behavior-selector__label" htmlFor={`behavior-select-${playerId}`}>
            Nuevo comportamiento
          </label>
          <select
            id={`behavior-select-${playerId}`}
            className="behavior-selector__select"
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
            disabled={isSubmitting}
          >
            <option value="">Elegí un comportamiento</option>
            {behaviors.map((behavior) => (
              <option key={behavior.behavior_id} value={behavior.behavior_id}>
                {behavior.name}
                {behavior.is_default ? " · predeterminado" : ""}
                {behavior.behavior_id === currentBehaviorId ? " (actual)" : ""}
              </option>
            ))}
          </select>
        </>
      )}

      {error && (
        <p className="behavior-selector__error" role="alert">
          {error}
        </p>
      )}

      <div className="behavior-selector__actions">
        <Button variant="secondary" onClick={handleCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button onClick={handleConfirm} disabled={!canConfirm} isLoading={isSubmitting}>
          Confirmar
        </Button>
      </div>
    </div>
  )
}

export default BehaviorSelector
