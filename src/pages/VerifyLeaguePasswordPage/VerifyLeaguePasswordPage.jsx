import { useState } from "react"
import { useLocation, useNavigate, useParams } from "react-router-dom"
import FormField from "../../components/FormField/FormField"
import Button from "../../components/Button/Button"
import { httpService, ApiError } from "../../services/createhttpService"
import "./VerifyLeaguePasswordPage.css"

const LEAGUE_LIST_PATH = "/leagues"

// Mensajes en español para cada código de error del contrato.
// Si el código no está acá, se usa el message que manda el backend.
const ERROR_MESSAGES = {
  PASSWORD_INCORRECT: "La contraseña es incorrecta. Intentá de nuevo.",
  NOT_FOUND: "La liga ya no existe.",
}

const NETWORK_ERROR_MESSAGE = "No se pudo conectar con el servidor. Intentá de nuevo."

// Llega desde el listado de ligas cuando se elige una liga privada.
// Si la contraseña es correcta, va a la inscripción pasándole el join_token por el state
// de la navegación (así no queda en la URL ni en el navegador).
function VerifyLeaguePasswordPage() {
  const { leagueId } = useParams()
  const { state } = useLocation()
  const navigate = useNavigate()

  const leagueName = state?.leagueName // opcional, lo manda el listado
  const joinPath = `/leagues/${leagueId}/join`

  const [password, setPassword] = useState("")
  const [passwordError, setPasswordError] = useState("") // error que se muestra junto al campo
  const [serverError, setServerError] = useState("")     // error de red o del servidor (con "Reintentar")
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()

    // No se llama al endpoint si el campo está vacío
    if (!password) {
      setPasswordError("La contraseña es obligatoria")
      return
    }

    setPasswordError("")
    setServerError("")
    setIsLoading(true)

    try {
      const data = await httpService.post(`/leagues/${leagueId}/verify-password`, { password })
      navigate(joinPath, { state: { joinToken: data.join_token, leagueName } })
    } catch (error) {
      handleError(error)
      setIsLoading(false)
    }
  }

  function handleError(error) {
    // Error de red: no hay respuesta del servidor
    if (!(error instanceof ApiError)) {
      setServerError(NETWORK_ERROR_MESSAGE)
      return
    }

    // 401 de sesión: createHttpService ya cerró la sesión y la app redirige al login
    // (PASSWORD_INCORRECT también es 401, por eso se distingue por el código y no por el status)
    if (error.status === 401 && error.error !== "PASSWORD_INCORRECT") return

    const message = ERROR_MESSAGES[error.error] ?? error.message

    if (error.error === "PASSWORD_INCORRECT") {
      setPassword("") // se limpia el campo para reintentar
      setPasswordError(message)
    } else if (error.error === "LEAGUE_NOT_PRIVATE") {
      // La liga es pública: no necesita contraseña ni join_token
      navigate(joinPath, { state: { leagueName } })
    } else if (error.error === "NOT_FOUND") {
      // La liga ya no existe: se vuelve al listado mostrando el mensaje
      navigate(LEAGUE_LIST_PATH, { state: { message } })
    } else {
      setServerError(message)
    }
  }

  function handleChange(event) {
    setPassword(event.target.value)
    setPasswordError("")
  }

  return (
    <main className="verify-page">
      <section className="verify-card">
        <header className="verify-card__header">
          <p className="verify-card__brand">FutBot</p>
          <h1 className="verify-card__title">Liga privada</h1>
          <p className="verify-card__subtitle">
            {leagueName ? `${leagueName}: ` : ""}ingresá la contraseña para unirte.
          </p>
        </header>

        {serverError && (
          <div className="verify-card__alert" role="alert">
            <span>{serverError}</span>
            <Button variant="secondary" type="submit" form="verify-form" disabled={isLoading}>
              Reintentar
            </Button>
          </div>
        )}

        <form id="verify-form" className="verify-form" onSubmit={handleSubmit} noValidate>
          <FormField
            id="password"
            label="Contraseña"
            type="password"
            autoComplete="off"
            placeholder="Contraseña de la liga"
            value={password}
            onChange={handleChange}
            error={passwordError}
            disabled={isLoading}
          />

          <div className="verify-form__buttons">
            <Button variant="secondary" onClick={() => navigate(LEAGUE_LIST_PATH)}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={isLoading}>
              Confirmar
            </Button>
          </div>
        </form>
      </section>
    </main>
  )
}

export default VerifyLeaguePasswordPage
