import { useEffect, useRef, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import Button from "../../components/Button/Button"
import TacticalSetup from "../../components/TacticalSetup/TacticalSetup"
import { ApiError } from "../../services/createhttpService"
import { fetchLeagueLineup, updateLeagueLineup } from "../../services/leagueLineup"
import { useSession } from "../../hooks/useSession"
// Mismo estilo que las pantallas de unirse a amistoso y a liga
import "../JoinFriendlyPage/JoinFriendlyPage.css"

const REDIRECT_DELAY_MS = 1500
const LEAGUE_LIST_PATH = "/leagues"

const SUCCESS_MESSAGE = "Tu nueva alineación rige desde el próximo partido."
const NETWORK_ERROR_MESSAGE =
  "No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo."
const SERVER_ERROR_MESSAGE = "Ocurrió un error en el servidor. Intentá de nuevo."

// Único lugar donde se decide qué hacer con cada código de error del contrato.
// target: dónde se muestra el mensaje ("tactical" o "general").
// message: texto en español; si no hay, se usa el message que manda el backend.
// link: enlace que se ofrece junto al mensaje ("lobby" o "list").
const ERROR_HANDLING = {
  INVALID_CONFIGURATION: { target: "tactical" },
  LEAGUE_FINISHED: {
    target: "general",
    message: "La liga ya terminó: no se puede cambiar la alineación.",
    link: "lobby",
  },
  LEAGUE_NOT_FOUND: {
    target: "general",
    message: "La liga ya no existe.",
    link: "list",
  },
  TEAM_NOT_IN_LEAGUE: {
    target: "general",
    message: "Tu equipo no está inscripto en esta liga.",
    link: "list",
  },
}

// Traduce un error a lo que muestra la pantalla: { target, message, link, canRetry }
function getErrorInfo(error) {
  if (!(error instanceof ApiError)) {
    return { target: "general", message: NETWORK_ERROR_MESSAGE, canRetry: true }
  }
  if (error.status >= 500) {
    return { target: "general", message: error.message || SERVER_ERROR_MESSAGE, canRetry: true }
  }

  const handling = ERROR_HANDLING[error.error] ?? { target: "general" }
  return {
    target: handling.target,
    message: handling.message ?? error.message,
    link: handling.link,
  }
}

function LeagueLineupPage() {
  const { leagueId } = useParams()
  const navigate = useNavigate()
  const { user } = useSession()
  const teamId = user?.team_id
  const lobbyPath = `/leagues/${leagueId}`

  // Carga de la alineación vigente
  const [loadStatus, setLoadStatus] = useState("loading") // loading | ready | error
  const [lineup, setLineup] = useState(null)
  const [loadError, setLoadError] = useState(null) // { message, link, canRetry }
  const [reloadKey, setReloadKey] = useState(0)

  // Guardado de la nueva alineación
  const [tacticalError, setTacticalError] = useState("")
  const [saveError, setSaveError] = useState(null) // { message, link, canRetry }
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState("")

  // Última configuración enviada, para poder reintentar el mismo guardado
  const lastConfig = useRef(null)

  // Si la pantalla se cierra antes de redirigir, se cancela la redirección
  const redirectTimer = useRef(null)
  useEffect(() => () => clearTimeout(redirectTimer.current), [])

  useEffect(() => {
    let isActive = true
    setLoadStatus("loading")
    setLoadError(null)

    fetchLeagueLineup(leagueId, teamId)
      .then((data) => {
        if (!isActive) return
        setLineup(data)
        setLoadStatus("ready")
      })
      .catch((error) => {
        if (!isActive) return
        // La sesión venció: createhttpService ya cerró la sesión y la app redirige al login
        if (error instanceof ApiError && error.status === 401) return
        setLoadError(getErrorInfo(error))
        setLoadStatus("error")
      })

    return () => {
      isActive = false
    }
  }, [leagueId, teamId, reloadKey])

  async function handleConfirm(tacticalConfig) {
    if (isSubmitting) return

    lastConfig.current = tacticalConfig
    setTacticalError("")
    setSaveError(null)
    setIsSubmitting(true)

    try {
      await updateLeagueLineup(leagueId, teamId, tacticalConfig)

      setSuccessMessage(SUCCESS_MESSAGE)
      redirectTimer.current = setTimeout(() => navigate(lobbyPath), REDIRECT_DELAY_MS)
      // isSubmitting queda en true para que no se pueda volver a enviar
    } catch (error) {
      setIsSubmitting(false)
      if (error instanceof ApiError && error.status === 401) return

      const info = getErrorInfo(error)
      if (info.target === "tactical") setTacticalError(info.message)
      else setSaveError(info)
    }
  }

  function handleRetrySave() {
    if (lastConfig.current) handleConfirm(lastConfig.current)
  }

  function handleRetryLoad() {
    setReloadKey((key) => key + 1)
  }

  // Descarta los cambios sin llamar al backend
  function handleCancel() {
    navigate(lobbyPath)
  }

  const errorLinks = {
    lobby: { to: lobbyPath, label: "Volver al lobby de la liga →" },
    list: { to: LEAGUE_LIST_PATH, label: "Ir al listado de ligas →" },
  }

  function renderError(info, onRetry) {
    const link = info.link ? errorLinks[info.link] : null
    return (
      <div className="join-friendly__alert join-friendly__alert--error" role="alert">
        <span>{info.message}</span>
        {link && (
          <Link to={link.to} className="join-friendly__link">
            {link.label}
          </Link>
        )}
        {info.canRetry && (
          <Button variant="secondary" onClick={onRetry} disabled={isSubmitting}>
            Reintentar
          </Button>
        )}
      </div>
    )
  }

  return (
    <main className="join-friendly-page">
      <div className="join-friendly">
        <header className="join-friendly__header">
          <p className="join-friendly__brand">FutBot</p>
          <h1 className="join-friendly__title">Cambiar alineación</h1>
          <p className="join-friendly__subtitle">
            Elegí titulares, suplentes y formación. Los cambios rigen desde tu próximo partido.
          </p>
        </header>

        {successMessage && (
          <p className="join-friendly__alert join-friendly__alert--success" role="status">
            {successMessage}
          </p>
        )}

        {saveError && renderError(saveError, handleRetrySave)}

        {loadStatus === "loading" && (
          <p className="join-friendly__subtitle">Cargando tu alineación...</p>
        )}

        {loadStatus === "error" && renderError(loadError, handleRetryLoad)}

        {/* Se monta recién con la alineación cargada: TacticalSetup lee initialConfig una sola vez */}
        {loadStatus === "ready" && (
          <TacticalSetup
            initialConfig={lineup}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
            isSubmitting={isSubmitting}
            errorMessage={tacticalError}
            confirmLabel="Guardar alineación"
          />
        )}
      </div>
    </main>
  )
}

export default LeagueLineupPage
