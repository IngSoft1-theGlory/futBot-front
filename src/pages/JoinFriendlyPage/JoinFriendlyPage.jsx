import { useEffect, useRef, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import Button from "../../components/Button/Button"
import TacticalSetup from "../../components/TacticalSetup/TacticalSetup"
import { httpService, ApiError } from "../../services/createhttpService"
import { useSession } from "../../hooks/useSession"
import "./JoinFriendlyPage.css"

const REDIRECT_DELAY_MS = 1500
const FRIENDLY_LIST_PATH = "/friendlies"

const SUCCESS_MESSAGE = "¡Te uniste al amistoso! El partido está por comenzar..."
const NETWORK_ERROR_MESSAGE =
  "No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo."

// Único lugar donde se decide qué hacer con cada código de error del contrato.
// target: dónde se muestra el mensaje ("tactical" o "general").
// message: texto en español; si no hay, se usa el message que manda el backend.
// leave: el amistoso ya no está disponible, se vuelve al listado sin permitir reintentar.
const ERROR_HANDLING = {
  // El contrato documenta INVALID_SETTING; el back hoy responde INVALID_CONFIGURATION
  INVALID_SETTING: { target: "tactical" },
  INVALID_CONFIGURATION: { target: "tactical" },
  MATCH_NOT_FOUND: {
    target: "general",
    message: "El amistoso ya no existe o fue cancelado por el anfitrión.",
    leave: true,
  },
  MATCH_UNAVAILABLE: {
    target: "general",
    message: "El amistoso ya comenzó o ya tiene un rival.",
    leave: true,
  },
  PRECONDITION_FAILED: {
    target: "general",
    message: "Tu equipo necesita el mínimo de jugadores y comportamientos para jugar un amistoso.",
    showPlayersLink: true,
  },
}

function JoinFriendlyPage() {
  const { matchId } = useParams()
  const navigate = useNavigate()
  const { user } = useSession()

  const [tacticalError, setTacticalError] = useState("")
  const [generalError, setGeneralError] = useState(null) // { message, showPlayersLink, canRetry }
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState("")

  // Última configuración enviada, para poder reintentar el mismo envío
  const lastConfig = useRef(null)

  // Si la pantalla se cierra antes de redirigir, se cancela la redirección
  const redirectTimer = useRef(null)
  useEffect(() => () => clearTimeout(redirectTimer.current), [])

  function redirectAfterDelay(path) {
    redirectTimer.current = setTimeout(() => navigate(path), REDIRECT_DELAY_MS)
  }

  async function handleConfirm(tacticalConfig) {
    if (isSubmitting) return

    lastConfig.current = tacticalConfig
    setTacticalError("")
    setGeneralError(null)
    setIsSubmitting(true)

    try {
      const data = await httpService.post(`/friendly/${matchId}/teams`, {
        team_id: user?.team_id,
        ...tacticalConfig,
      })

      // El partido arranca apenas se une el rival: se va directo a la pantalla del partido
      setSuccessMessage(data?.message || SUCCESS_MESSAGE)
      redirectAfterDelay(`/matches/${data?.match_id ?? matchId}`)
      // isSubmitting queda en true para que no se pueda volver a enviar
    } catch (error) {
      const keepLocked = handleRequestError(error)
      if (!keepLocked) setIsSubmitting(false)
    }
  }

  // Devuelve true si la confirmación tiene que quedar bloqueada
  function handleRequestError(error) {
    if (!(error instanceof ApiError)) {
      setGeneralError({ message: NETWORK_ERROR_MESSAGE, canRetry: true })
      return false
    }

    // La sesión venció: createhttpService ya cerró la sesión y la app redirige al login
    if (error.status === 401) return false

    const handling = ERROR_HANDLING[error.error] ?? { target: "general" }
    const message = handling.message ?? error.message

    if (handling.target === "tactical") {
      setTacticalError(message)
      return false
    }

    setGeneralError({
      message,
      showPlayersLink: handling.showPlayersLink,
      canRetry: error.status >= 500,
    })

    if (handling.leave) {
      redirectAfterDelay(FRIENDLY_LIST_PATH)
      return true
    }
    return false
  }

  function handleRetry() {
    if (lastConfig.current) handleConfirm(lastConfig.current)
  }

  // Descarta la configuración sin llamar al backend
  function handleCancel() {
    navigate(FRIENDLY_LIST_PATH)
  }

  return (
    <main className="join-friendly-page">
      <div className="join-friendly">
        <header className="join-friendly__header">
          <p className="join-friendly__brand">FutBot</p>
          <h1 className="join-friendly__title">Unirse al amistoso</h1>
          <p className="join-friendly__subtitle">
            Amistoso #{matchId} · Armá tu alineación para enfrentar al anfitrión.
          </p>
        </header>

        {successMessage && (
          <p className="join-friendly__alert join-friendly__alert--success" role="status">
            {successMessage}
          </p>
        )}

        {generalError && (
          <div className="join-friendly__alert join-friendly__alert--error" role="alert">
            <span>{generalError.message}</span>
            {generalError.showPlayersLink && (
              <Link to="/players" className="join-friendly__link">
                Ir a mis jugadores →
              </Link>
            )}
            {generalError.canRetry && (
              <Button variant="secondary" onClick={handleRetry} disabled={isSubmitting}>
                Reintentar
              </Button>
            )}
          </div>
        )}

        <TacticalSetup
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          isSubmitting={isSubmitting}
          errorMessage={tacticalError}
          confirmLabel="Unirme al amistoso"
        />
      </div>
    </main>
  )
}

export default JoinFriendlyPage
