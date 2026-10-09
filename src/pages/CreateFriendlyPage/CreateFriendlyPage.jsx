import { useEffect, useRef, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import Button from "../../components/Button/Button"
import TacticalSetup from "../../components/TacticalSetup/TacticalSetup"
import { httpService, ApiError } from "../../services/createhttpService"
import { useSession } from "../../hooks/useSession"
import { MATCH_DURATIONS } from "../../constants/matchDurations"
import "./CreateFriendlyPage.css"

const STEP_DURATION = 1
const STEP_TACTICAL = 2

const REDIRECT_DELAY_MS = 1500
const NETWORK_ERROR_MESSAGE =
  "No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo."

// Único lugar donde se decide qué hacer con cada código de error del contrato.
// step: paso al que se vuelve. target: dónde se muestra el mensaje.
const ERROR_HANDLING = {
  INVALID_SETTINGS: { step: STEP_DURATION, target: "duration" },
  INVALID_CONFIGURATION: { step: STEP_TACTICAL, target: "tactical" },
  PRECONDITION_FAILED: {
    target: "general",
    message: "Tu equipo necesita el mínimo de jugadores y comportamientos para jugar un amistoso.",
    showPlayersLink: true,
  },
}

function validateDuration(minutes) {
  if (!MATCH_DURATIONS.some((option) => option.minutes === minutes)) {
    return "Elegí la duración del partido"
  }
  return ""
}

function CreateFriendlyPage() {
  const navigate = useNavigate()
  const { user } = useSession()

  const [step, setStep] = useState(STEP_DURATION)
  const [duration, setDuration] = useState(null) // minutos elegidos
  const [durationError, setDurationError] = useState("")
  const [tacticalError, setTacticalError] = useState("")
  const [generalError, setGeneralError] = useState(null) 
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState("")

  // Si la pantalla se cierra antes de redirigir, se cancela la redirección
  const redirectTimer = useRef(null)
  useEffect(() => () => clearTimeout(redirectTimer.current), [])

  function clearErrors() {
    setDurationError("")
    setTacticalError("")
    setGeneralError(null)
  }

  // Handlers de los pasos del wizard: duración y configuración táctica

  function handleDurationChange(minutes) {
    setDuration(minutes)
    setDurationError("")
    setGeneralError(null)
  }

  // Solo valida y avanza: no llama al backend
  function handleDurationSubmit(event) {
    event.preventDefault()

    const error = validateDuration(duration)
    if (error) {
      setDurationError(error)
      return
    }

    clearErrors()
    setStep(STEP_TACTICAL)
  }

  // Llama al backend para crear el amistoso y redirige a la sala de espera

  async function handleTacticalConfirm(tacticalConfig) {
    if (isSubmitting) return

    clearErrors()
    setIsSubmitting(true)

    try {
      const data = await httpService.post("/friendly", {
        team_id: user?.team_id,
        match_duration: duration,
        ...tacticalConfig,
      })

      setSuccessMessage("¡Amistoso creado! Te llevamos a la sala de espera...")
      redirectTimer.current = setTimeout(() => {
        navigate(`/friendlies/${data.match_id}`)
      }, REDIRECT_DELAY_MS)
      // isSubmitting queda en true para que no se pueda volver a enviar
    } catch (error) {
      handleRequestError(error)
      setIsSubmitting(false)
    }
  }

  function handleRequestError(error) {
    if (!(error instanceof ApiError)) {
      setGeneralError({ message: NETWORK_ERROR_MESSAGE })
      return
    }

    // La sesión venció: createhttpService ya cerró la sesión y la app redirige al login
    if (error.status === 401) return

    const handling = ERROR_HANDLING[error.error] ?? { target: "general" }
    const message = handling.message ?? error.message

    if (handling.step) setStep(handling.step)

    if (handling.target === "duration") setDurationError(message)
    else if (handling.target === "tactical") setTacticalError(message)
    else setGeneralError({ message, showPlayersLink: handling.showPlayersLink })
  }

  // Handlers de navegación: cancelar o volver al paso anterior

  // Descarta todo el wizard sin llamar al backend
  function handleCancel() {
    navigate("/")
  }

  function handleBackToDuration() {
    clearErrors()
    setStep(STEP_DURATION)
  }

  return (
    <main className="create-friendly-page">
      <div className="create-friendly">
        <header className="create-friendly__header">
          <p className="create-friendly__brand">FutBot</p>
          <h1 className="create-friendly__title">Crear amistoso</h1>

          <ol className="wizard-steps" aria-label="Pasos">
            <li
              className={`wizard-steps__item ${step === STEP_DURATION ? "wizard-steps__item--active" : "wizard-steps__item--done"}`}
              aria-current={step === STEP_DURATION ? "step" : undefined}
            >
              <span className="wizard-steps__number">1</span>
              Duración
            </li>
            <li
              className={`wizard-steps__item ${step === STEP_TACTICAL ? "wizard-steps__item--active" : ""}`}
              aria-current={step === STEP_TACTICAL ? "step" : undefined}
            >
              <span className="wizard-steps__number">2</span>
              Configuración táctica
            </li>
          </ol>
        </header>

        {successMessage && (
          <p className="create-friendly__alert create-friendly__alert--success" role="status">
            {successMessage}
          </p>
        )}

        {generalError && (
          <div className="create-friendly__alert create-friendly__alert--error" role="alert">
            {generalError.message}
            {generalError.showPlayersLink && (
              <>
                {" "}
                <Link to="/players" className="create-friendly__link">
                  Ir a mis jugadores →
                </Link>
              </>
            )}
          </div>
        )}

        {/* 1) se oculta pero no se desmonta, así no se pierde lo ingresado */}
        <section hidden={step !== STEP_DURATION} aria-labelledby="duration-title">
          <form className="duration-card" onSubmit={handleDurationSubmit} noValidate>
            <h2 id="duration-title" className="duration-card__title">
              Duración del partido
            </h2>
            <p className="duration-card__subtitle">Elegí cuántos minutos va a durar el amistoso.</p>

            <div
              className="duration-options"
              role="radiogroup"
              aria-label="Duración del partido"
              aria-describedby="duration-error"
            >
              {MATCH_DURATIONS.map((option) => {
                const isSelected = option.minutes === duration
                return (
                  <button
                    key={option.minutes}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    className={`duration-option ${isSelected ? "duration-option--selected" : ""}`}
                    onClick={() => handleDurationChange(option.minutes)}
                  >
                    <span className="duration-option__minutes">{option.minutes} min</span>
                    <span className="duration-option__description">{option.description}</span>
                  </button>
                )
              })}
            </div>

            <p id="duration-error" className="duration-card__error" role={durationError ? "alert" : undefined}>
              {durationError}
            </p>

            <div className="duration-card__actions">
              <Button variant="secondary" onClick={handleCancel}>
                Cancelar
              </Button>
              <Button type="submit">Siguiente</Button>
            </div>
          </form>
        </section>

        {/* 2) también queda montado para conservar la selección al volver al paso 1 */}
        <section hidden={step !== STEP_TACTICAL} aria-label="Configuración táctica">
          <button
            type="button"
            className="create-friendly__back"
            onClick={handleBackToDuration}
            disabled={isSubmitting}
          >
            ← Volver a la duración ({duration ?? "-"} min)
          </button>

          <TacticalSetup
            onConfirm={handleTacticalConfirm}
            onCancel={handleCancel}
            isSubmitting={isSubmitting}
            errorMessage={tacticalError}
            confirmLabel="Crear amistoso"
          />
        </section>
      </div>
    </main>
  )
}

export default CreateFriendlyPage