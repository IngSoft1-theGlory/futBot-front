import { useState, useEffect, useRef } from "react"
import { Link } from "react-router-dom"
import Button from "../Button/Button"
import { ApiError } from "../../services/createhttpService"
import { fetchBehaviors, filterCoachBehaviors } from "../../services/behaviors"
import { chooseLeagueCoach } from "../../services/leagues"
import "./CoachSelector.css"


const SUCCESS_MESSAGE = "Listo: tu DT se aplicará desde el próximo partido."
const SUCCESS_DURATION_MS = 4000 // cuánto tiempo se ve el mensaje de éxito
const HINT_MESSAGE = "El DT que elijas se aplica desde el próximo partido."
const DISABLED_MESSAGE = "El DT solo se puede elegir mientras la liga está en curso."
const NETWORK_ERROR_MESSAGE =
  "No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo."
const LOAD_ERROR_MESSAGE = "No se pudieron cargar los comportamientos."
 

const ERROR_MESSAGES = {
  LEAGUE_NOT_IN_PROGRESS: "El DT solo se puede elegir mientras la liga está en curso.",
  UNAUTHORIZED_ACTION: "Solo podés elegir el DT de tu propio equipo.",
  INVALID_DATA: "Ese comportamiento no es de director técnico.",
  BEHAVIOR_NOT_FOUND: "No se encontró el comportamiento elegido.",
  TEAM_NOT_IN_LEAGUE: "El equipo no está en esta liga.",
  LEAGUE_NOT_FOUND: "La liga no existe.",
}


function getErrorMessage(error) {
  if (!(error instanceof ApiError)) return NETWORK_ERROR_MESSAGE
  return ERROR_MESSAGES[error.error] ?? error.message
}

function isSessionError(error) {
  return error instanceof ApiError && error.status === 401
}

// El <select> trabaja con strings: null (sin DT) se representa con ""
function toSelectValue(coachId) {
  return String(coachId ?? "")
}


/*
 Selector del DT del equipo del usuario en una liga en curso.
 - Pide la lista de comportamientos al montarse y deja solo los de tipo COACH.
 - Muestra el DT actual (currentCoachId) y permite cambiarlo o quitarlo ("Sin DT").
 - Al confirmar llama al back y avisa el nuevo behavior_id con onChanged.
   Mientras el pedido está en curso no se puede volver a enviar.
 - disabled: la liga no está en curso, se ve pero no se puede usar.
*/
function CoachSelector ({ leagueId, teamId, currentCoachId, disabled, onChanged }) {
  const [loadStatus, setLoadStatus] = useState("loading") // loading | ready | error
  const [behaviors, setBehaviors] = useState([])
  const [reloadKey, setReloadKey] = useState(0) // al cambiar, el efecto vuelve a pedir la lista
  const [selectedId, setSelectedId] = useState(toSelectValue(currentCoachId))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")

  // Para poder cancelar el timer que oculta el mensaje de éxito
  const successTimer = useRef(null)
  useEffect(() => () => clearTimeout(successTimer.current), [])


  useEffect(() => {
    let isActive = true
    setLoadStatus("loading")

    fetchBehaviors()
      .then((list) => {
        if (!isActive) return
        // Se muestran los comportamientos DT
        setBehaviors(filterCoachBehaviors(list))
        setLoadStatus("ready")
      })
      .catch((err) => {
        if (!isActive || isSessionError(err)) return
        setLoadStatus("error")
      })

    return () => {
      isActive = false
    }
  }, [reloadKey])


  // Cuando cambia el DT actual, se actualiza la opción seleccionada
  useEffect(() => {
    setSelectedId(toSelectValue(currentCoachId))
  }, [currentCoachId])

 
  async function handleConfirm() {
    // Con un envío en curso no se manda nada
    if (isSubmitting || disabled) return
 
    setIsSubmitting(true)
    setError("")
    setSuccessMessage("")
    clearTimeout(successTimer.current)
 
    try {
      const behaviorId = selectedId ? Number(selectedId) : null
      const data = await chooseLeagueCoach(leagueId, teamId, behaviorId)
      onChanged(data?.behavior_id ?? behaviorId)
 
      setSuccessMessage(SUCCESS_MESSAGE)
      successTimer.current = setTimeout(() => setSuccessMessage(""), SUCCESS_DURATION_MS)
    } catch (err) {
      // Ante un error no se llama a onChanged: el DT actual queda como estaba
      if (!isSessionError(err)) setError(getErrorMessage(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  // Nombre del DT actual para mostrar en pantalla
  function getCurrentCoachName() {
    if (currentCoachId === null || currentCoachId === undefined) return "Sin DT"
    const coach = behaviors.find((behavior) => behavior.behavior_id === currentCoachId)
    if (coach) return coach.name
    return loadStatus === "loading" ? "Cargando..." : "DT elegido"
  }

  const isSameAsCurrent = selectedId === toSelectValue(currentCoachId)
  const canConfirm = !disabled && !isSameAsCurrent && !isSubmitting
 
  return (
    <section className="coach-selector" aria-labelledby="coach-selector-title">
      <h2 id="coach-selector-title" className="coach-selector__title">
        Director técnico
      </h2>
 
      <p className="coach-selector__current">
        DT actual: <strong>{getCurrentCoachName()}</strong>
      </p>
      <p className="coach-selector__hint">{disabled ? DISABLED_MESSAGE : HINT_MESSAGE}</p>
 
      {loadStatus === "loading" && <p className="coach-selector__hint">Cargando comportamientos...</p>}
 
      {loadStatus === "error" && (
        <div className="coach-selector__error" role="alert">
          <span>{LOAD_ERROR_MESSAGE}</span>
          <Button variant="secondary" onClick={() => setReloadKey((key) => key + 1)}>
            Reintentar
          </Button>
        </div>
      )}
 
      {loadStatus === "ready" && behaviors.length === 0 && (
        <p className="coach-selector__hint">
          Todavía no tenés comportamientos de DT. Creá uno en{" "}
          <Link to="/behaviors" className="coach-selector__link">
            Comportamientos
          </Link>
          .
        </p>
      )}
 
      {loadStatus === "ready" && behaviors.length > 0 && (
        <div className="coach-selector__form">
          <label className="coach-selector__label" htmlFor="coach-select">
            Elegí tu DT
          </label>
          <select
            id="coach-select"
            className="coach-selector__select"
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
            disabled={disabled || isSubmitting}
          >
            <option value="">Sin DT</option>
            {behaviors.map((behavior) => (
              <option key={behavior.behavior_id} value={behavior.behavior_id}>
                {behavior.name}
              </option>
            ))}
          </select>
          <Button onClick={handleConfirm} disabled={!canConfirm} isLoading={isSubmitting}>
            Confirmar
          </Button>
        </div>
      )}
 
      {error && (
        <p className="coach-selector__error" role="alert">
          {error}
        </p>
      )}
 
      {successMessage && (
        <p className="coach-selector__success" role="status">
          {successMessage}
        </p>
      )}
    </section>
  )
}
 
export default CoachSelector
