import { useEffect, useRef, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import Button from "../../components/Button/Button"
import FormField from "../../components/FormField/FormField"
import TacticalSetup from "../../components/TacticalSetup/TacticalSetup"
import { httpService, ApiError } from "../../services/createhttpService"
import { useSession } from "../../hooks/useSession"
import { MATCH_DURATIONS } from "../../constants/matchDurations"
import { LEAGUE_CAPACITIES } from "../../constants/leagueCapacities"
// Mismo wizard que Crear Amistoso basicamente se reutilizan sus estilos (los pasos, la tarjeta, opciones, alertas, etc)
import "../CreateFriendlyPage/CreateFriendlyPage.css"
import "./CreateLeaguePage.css"

const STEP_LEAGUE = 1
const STEP_TACTICAL = 2

const LEAGUE_TYPE_PUBLIC = "public"
const LEAGUE_TYPE_PRIVATE = "private"


const LEAGUE_TYPES = [
  { value: LEAGUE_TYPE_PUBLIC, title: "Pública", description: "Suma al ranking global" },
  { value: LEAGUE_TYPE_PRIVATE, title: "Privada", description: "Solo con contraseña" },
]

const LEAGUE_PENALTIES = [
  { value: false, title: "Clásica", description: "Hay empates" },
  { value: true, title: "Con penales", description: "No hay empates" },
]

// Se reutilizan los mismos valores que Crear Amistoso, para que la duración de los partidos sea consistente
const DURATION_OPTIONS = MATCH_DURATIONS.map((option) => ({
  value: option.minutes,
  title: `${option.minutes} min`,
  description: option.description,
}))

//sujeta a cambios si definimos otros cupos. se modifica en el archivo de constantes leagueCapacities.js.
const CAPACITY_OPTIONS = LEAGUE_CAPACITIES.map((teams) => ({
  value: teams,
  title: `${teams}`,
  description: "equipos",
}))

const REDIRECT_DELAY_MS = 1500
const NETWORK_ERROR_MESSAGE =
  "No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo."
const SERVER_ERROR_MESSAGE = "Ocurrió un error en el servidor. Intentá de nuevo."

// unico lugar donde se decide qué hacer con cada código de error del contrato.
// step: paso al que se vuelve. target: dónde se muestra el mensaje.
// message: texto en español. si no hay, se usa el message que manda el backend.
const TEAM_SETUP_HANDLING = {
  target: "general",
  message: "Tu equipo necesita el mínimo de jugadores y comportamientos para crear una liga.",
  showPlayersLink: true,
}
const FORBIDDEN_HANDLING = {
  target: "general",
  message: "No tenés permisos para crear esta liga.",
}

const ERROR_HANDLING = {
  INVALID_LEAGUE_CAPACITY: { step: STEP_LEAGUE, target: "maxTeams" },
  INVALID_SETTINGS: { step: STEP_LEAGUE, target: "duration" },
  INVALID_CONFIGURATION: { step: STEP_TACTICAL, target: "tactical" },
  INSUFFICIENT_TEAM_SETUP: TEAM_SETUP_HANDLING,
  PRECONDITION_FAILED: TEAM_SETUP_HANDLING,
  FORBIDDEN: FORBIDDEN_HANDLING,
  UNAUTHORIZED_ACTION: FORBIDDEN_HANDLING,
}

const EMPTY_LEAGUE_DATA = {
  name: "",
  duration: null,
  maxTeams: null,
  leagueType: LEAGUE_TYPE_PUBLIC,
  password: "",
  penaltiesEnabled: false,
}

function validateLeagueData(data) {
  const errors = {}

  if (!data.name.trim()) errors.name = "El nombre de la liga es obligatorio"
  if (!MATCH_DURATIONS.some((option) => option.minutes === data.duration)) {
    errors.duration = "Elegí la duración de cada partido"
  }
  if (!LEAGUE_CAPACITIES.includes(data.maxTeams)) {
    errors.maxTeams = "Elegí la cantidad máxima de equipos"
  }
  if (data.leagueType === LEAGUE_TYPE_PRIVATE && !data.password) {
    errors.password = "La contraseña es obligatoria para una liga privada"
  }

  return errors
}

// Grupo de opciones con el mismo estilo que el selector de duración de Crear Amistoso
function ChoiceGroup({ label, options, value, onChange, error, errorId }) {
  return (
    <div className="league-field">
      <p className="league-field__label">{label}</p>
      <div
        className="duration-options league-field__options"
        role="radiogroup"
        aria-label={label}
        aria-describedby={errorId}
      >
        {options.map((option) => {
          const isSelected = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              className={`duration-option ${isSelected ? "duration-option--selected" : ""}`}
              onClick={() => onChange(option.value)}
            >
              <span className="duration-option__minutes">{option.title}</span>{" "}
              <span className="duration-option__description">{option.description}</span>
            </button>
          )
        })}
      </div>
      <p id={errorId} className="duration-card__error" role={error ? "alert" : undefined}>
        {error}
      </p>
    </div>
  )
}

// Wizard de 2 pasos para crear una liga: primero los datos, luego la configuración táctica
function CreateLeaguePage() {
  const navigate = useNavigate()
  const { user } = useSession()

  const [step, setStep] = useState(STEP_LEAGUE)
  const [leagueData, setLeagueData] = useState(EMPTY_LEAGUE_DATA)
  const [fieldErrors, setFieldErrors] = useState({}) // errores del paso 1, por campo
  const [tacticalError, setTacticalError] = useState("")
  const [generalError, setGeneralError] = useState(null) // { message, showPlayersLink, canRetry }
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState("")

  // Último body enviado: lo reusa "Reintentar" ante un error de red o del servidor
  const lastBody = useRef(null)

  // Si la pantalla se cierra antes de redirigir, se cancela la redirección
  const redirectTimer = useRef(null)
  useEffect(() => () => clearTimeout(redirectTimer.current), [])

  function clearErrors() {
    setFieldErrors({})
    setTacticalError("")
    setGeneralError(null)
  }

  // 1) datos de la liga

  function updateField(field, value) {
    setLeagueData((previous) => ({ ...previous, [field]: value }))
    setFieldErrors((previous) => ({ ...previous, [field]: "" }))
    setGeneralError(null)
  }

  function handleLeagueTypeChange(leagueType) {
    updateField("leagueType", leagueType)
    // Una liga pública no lleva contraseña: se descarta lo que se haya escrito
    if (leagueType === LEAGUE_TYPE_PUBLIC) updateField("password", "")
  }

  // Solo valida y avanza: no llama al backend
  function handleLeagueSubmit(event) {
    event.preventDefault()

    const errors = validateLeagueData(leagueData)
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    clearErrors()
    setStep(STEP_TACTICAL)
  }

  // 2) crea la liga con el body completo y redirige a la sala de espera

  function handleTacticalConfirm(tacticalConfig) {
    const isPrivate = leagueData.leagueType === LEAGUE_TYPE_PRIVATE

    submitLeague({
      league_name: leagueData.name.trim(),
      match_duration: leagueData.duration,
      max_teams: leagueData.maxTeams,
      password: isPrivate ? leagueData.password : null,
      team_id: user?.team_id,
      penalties_enabled: leagueData.penaltiesEnabled,
      ...tacticalConfig,
    })
  }

  async function submitLeague(body) {
    if (isSubmitting) return

    clearErrors()
    setIsSubmitting(true)
    lastBody.current = body

    try {
      const data = await httpService.post("/leagues", body)

      setSuccessMessage("¡Liga creada! Te llevamos a la sala de espera...")
      redirectTimer.current = setTimeout(() => {
        navigate(`/leagues/${data.league_id}`)
      }, REDIRECT_DELAY_MS)
      // isSubmitting queda en true para que no se pueda volver a enviar
    } catch (error) {
      handleRequestError(error)
      setIsSubmitting(false)
    }
  }

  function handleRetry() {
    submitLeague(lastBody.current)
  }

  function handleRequestError(error) {
    if (!(error instanceof ApiError)) {
      setGeneralError({ message: NETWORK_ERROR_MESSAGE, canRetry: true })
      return
    }

    // La sesión venció: createhttpService ya cerró la sesión y la app redirige al login
    if (error.status === 401) return

    if (error.status >= 500) {
      setGeneralError({ message: error.message || SERVER_ERROR_MESSAGE, canRetry: true })
      return
    }

    const handling = ERROR_HANDLING[error.error] ?? { target: "general" }
    const message = handling.message ?? (error.message || SERVER_ERROR_MESSAGE)

    if (handling.step) setStep(handling.step)

    if (handling.target === "tactical") setTacticalError(message)
    else if (handling.target === "general") {
      setGeneralError({ message, showPlayersLink: handling.showPlayersLink })
    } else setFieldErrors({ [handling.target]: message })
  }

  // Navegación: cancelar o volver al paso anterior

  // Descarta todo el wizard sin llamar al backend
  function handleCancel() {
    navigate("/")
  }

  function handleBackToLeague() {
    clearErrors()
    setStep(STEP_LEAGUE)
  }

  const isPrivate = leagueData.leagueType === LEAGUE_TYPE_PRIVATE

  return (
    <main className="create-friendly-page">
      <div className="create-friendly">
        <header className="create-friendly__header">
          <p className="create-friendly__brand">FutBot</p>
          <h1 className="create-friendly__title">Crear liga</h1>

          <ol className="wizard-steps" aria-label="Pasos">
            <li
              className={`wizard-steps__item ${step === STEP_LEAGUE ? "wizard-steps__item--active" : "wizard-steps__item--done"}`}
              aria-current={step === STEP_LEAGUE ? "step" : undefined}
            >
              <span className="wizard-steps__number">1</span>
              Datos de la liga
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
            {generalError.canRetry && (
              <div className="create-league__retry">
                <Button variant="secondary" onClick={handleRetry} isLoading={isSubmitting}>
                  Reintentar
                </Button>
              </div>
            )}
          </div>
        )}

        {/* 1) se oculta pero no se desmonta, así no se pierde lo ingresado */}
        <section hidden={step !== STEP_LEAGUE} aria-labelledby="league-title">
          <form className="duration-card create-league__card" onSubmit={handleLeagueSubmit} noValidate>
            <h2 id="league-title" className="duration-card__title">
              Datos de la liga
            </h2>
            <p className="duration-card__subtitle">Configurá cómo se va a jugar tu liga.</p>

            <FormField
              id="league-name"
              label="Nombre de la liga"
              value={leagueData.name}
              onChange={(event) => updateField("name", event.target.value)}
              error={fieldErrors.name}
              placeholder="Ej: Liga FAMAF Apertura"
            />

            <ChoiceGroup
              label="Duración de cada partido"
              options={DURATION_OPTIONS}
              value={leagueData.duration}
              onChange={(minutes) => updateField("duration", minutes)}
              error={fieldErrors.duration}
              errorId="league-duration-error"
            />

            <ChoiceGroup
              label="Cantidad máxima de equipos"
              options={CAPACITY_OPTIONS}
              value={leagueData.maxTeams}
              onChange={(teams) => updateField("maxTeams", teams)}
              error={fieldErrors.maxTeams}
              errorId="league-max-teams-error"
            />

            <ChoiceGroup
              label="Tipo de liga"
              options={LEAGUE_TYPES}
              value={leagueData.leagueType}
              onChange={handleLeagueTypeChange}
              error=""
              errorId="league-type-error"
            />

            {isPrivate && (
              <FormField
                id="league-password"
                label="Contraseña"
                type="password"
                value={leagueData.password}
                onChange={(event) => updateField("password", event.target.value)}
                error={fieldErrors.password}
                autoComplete="new-password"
              />
            )}

            <ChoiceGroup
              label="Definición de empates"
              options={LEAGUE_PENALTIES}
              value={leagueData.penaltiesEnabled}
              onChange={(penalties) => updateField("penaltiesEnabled", penalties)}
              error=""
              errorId="league-penalties-error"
            />

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
            onClick={handleBackToLeague}
            disabled={isSubmitting}
          >
            ← Volver a los datos de la liga
          </button>

          <TacticalSetup
            onConfirm={handleTacticalConfirm}
            onCancel={handleCancel}
            isSubmitting={isSubmitting}
            errorMessage={tacticalError}
            confirmLabel="Crear liga"
          />
        </section>
      </div>
    </main>
  )
}

export default CreateLeaguePage
