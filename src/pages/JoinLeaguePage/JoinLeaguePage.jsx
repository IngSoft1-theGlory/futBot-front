import { useEffect, useRef, useState } from "react"
import { Link, useLocation, useNavigate, useParams } from "react-router-dom"
import Button from "../../components/Button/Button"
import TacticalSetup from "../../components/TacticalSetup/TacticalSetup"
import { httpService, ApiError } from "../../services/createhttpService"
import { useSession } from "../../hooks/useSession"
// Misma pantalla que Unirse a Amistoso: se reutilizan sus estilos
import "../JoinFriendlyPage/JoinFriendlyPage.css"

const REDIRECT_DELAY_MS = 1500
const LEAGUE_LIST_PATH = "/leagues"

const SUCCESS_MESSAGE = "¡Te uniste a la liga! Te llevamos a la sala de espera..."
const NETWORK_ERROR_MESSAGE =
  "No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo."

// Único lugar donde se decide qué hacer con cada código de error del contrato.
// target: dónde se muestra el mensaje ("tactical" o "general").
// message: texto en español; si no hay, se usa el message que manda el backend.
// redirect: a dónde se lleva al usuario después de mostrar el mensaje ("list" o "verify").
// link: enlace que se ofrece junto al mensaje ("list", "lobby" o "players").
const TOKEN_ERROR = { target: "general", redirect: "verify" }

const ERROR_HANDLING = {
  INVALID_CONFIGURATION: { target: "tactical" },
  INVALID_LINEUP: { target: "tactical" }, // nombre del ticket; el contrato usa INVALID_CONFIGURATION
  LEAGUE_UNAVAILABLE: {
    target: "general",
    message: "La liga ya comenzó, no es posible unirse.",
    link: "list",
  },
  LEAGUE_FULL: {
    target: "general",
    message: "La liga ya no tiene cupos disponibles.",
    link: "list",
  },
  NOT_FOUND: {
    target: "general",
    message: "La liga ya no existe.",
    redirect: "list",
  },
  ALREADY_JOINED: {
    target: "general",
    message: "Tu equipo ya está inscripto en esta liga.",
    link: "lobby",
  },
  PRECONDITION_FAILED: {
    target: "general",
    message: "Tu equipo necesita el mínimo de jugadores y comportamientos para unirse a una liga.",
    link: "players",
  },
  JOIN_TOKEN_EXPIRED: TOKEN_ERROR,
  INVALID_JOIN_TOKEN: TOKEN_ERROR,
  JOIN_TOKEN_REQUIRED: TOKEN_ERROR,
}

// Llega a esta pantalla desde el listado de ligas o, si la liga es privada, desde la
// verificación de contraseña, que le pasa el join_token en el state de la navegación:
// navigate(`/leagues/${leagueId}/join`, { state: { joinToken, leagueName } })
function JoinLeaguePage() {
  const { leagueId } = useParams()
  const { state } = useLocation()
  const navigate = useNavigate()
  const { user } = useSession()

  const joinToken = state?.joinToken ?? null
  const leagueName = state?.leagueName ?? `Liga #${leagueId}`
  const lobbyPath = `/leagues/${leagueId}`
  const verifyPath = `/leagues/${leagueId}/verify-password`

  const [tacticalError, setTacticalError] = useState("")
  const [generalError, setGeneralError] = useState(null) // { message, link, canRetry }
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState("")

  // Última configuración enviada, para poder reintentar el mismo envío
  const lastConfig = useRef(null)

  // Si la pantalla se cierra antes de redirigir, se cancela la redirección
  const redirectTimer = useRef(null)
  useEffect(() => () => clearTimeout(redirectTimer.current), [])

  function redirectAfterDelay(path, options) {
    redirectTimer.current = setTimeout(() => navigate(path, options), REDIRECT_DELAY_MS)
  }

  async function handleConfirm(tacticalConfig) {
    if (isSubmitting) return

    lastConfig.current = tacticalConfig
    setTacticalError("")
    setGeneralError(null)
    setIsSubmitting(true)

    try {
      const data = await httpService.post(`/leagues/${leagueId}/teams`, {
        team_id: user?.team_id,
        ...(joinToken && { join_token: joinToken }), // solo si la liga es privada
        ...tacticalConfig,
      })

      setSuccessMessage(SUCCESS_MESSAGE)
      redirectAfterDelay(`/leagues/${data?.league_id ?? leagueId}`)
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

    setGeneralError({ message, link: handling.link, canRetry: error.status >= 500 })

    if (handling.redirect === "list") {
      redirectAfterDelay(LEAGUE_LIST_PATH)
      return true
    }
    if (handling.redirect === "verify") {
      redirectAfterDelay(verifyPath, { state: { leagueName: state?.leagueName } })
      return true
    }
    // Sin cupo, ya iniciada o ya inscripto: no tiene sentido reintentar
    return Boolean(handling.link && handling.link !== "players")
  }

  function handleRetry() {
    if (lastConfig.current) handleConfirm(lastConfig.current)
  }

  // Descarta la configuración sin llamar al backend
  function handleCancel() {
    navigate(LEAGUE_LIST_PATH)
  }

  const errorLinks = {
    list: { to: LEAGUE_LIST_PATH, label: "Volver al listado de ligas →" },
    lobby: { to: lobbyPath, label: "Ir a la sala de espera →" },
    players: { to: "/players", label: "Ir a mis jugadores →" },
  }
  const errorLink = generalError?.link ? errorLinks[generalError.link] : null

  return (
    <main className="join-friendly-page">
      <div className="join-friendly">
        <header className="join-friendly__header">
          <p className="join-friendly__brand">FutBot</p>
          <h1 className="join-friendly__title">Unirse a la liga</h1>
          <p className="join-friendly__subtitle">
            {leagueName} · Armá tu alineación para competir en la liga.
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
            {errorLink && (
              <Link to={errorLink.to} className="join-friendly__link">
                {errorLink.label}
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
          confirmLabel="Unirme a la liga"
        />
      </div>
    </main>
  )
}

export default JoinLeaguePage
