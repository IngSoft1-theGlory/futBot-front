import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import FormField from "../../components/FormField/FormField"
import Button from "../../components/Button/Button"
import { httpService, ApiError } from "../../services/createhttpService"
import "./RegisterPage.css"

const INITIAL_VALUES = {
  username: "",
  email: "",
  password: "",
  teamName: "",
  teamLogo: null, // archivo (File) seleccionado por el usuario
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const LOGO_EXTENSION_REGEX = /\.(png|jpe?g|svg)$/i
const LOGO_ACCEPT = ".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml"
const LOGO_MAX_SIZE_BYTES = 1024 * 1024 // 1 MB
const REDIRECT_DELAY_MS = 1500

// Errores del contrato que corresponden a un campo puntual del formulario
const FIELD_BY_ERROR_CODE = {
  DUPLICATE_EMAIL: "email",
  VOID_USERNAME: "username",
  VOID_TEAM_NAME: "teamName",
  VOID_TEAM_LOGO: "teamLogo",
  INVALID_LOGO_FORMAT: "teamLogo",
}

function getLogoError(file) {
  if (!file) {
    return "El logo del equipo es obligatorio."
  }
  if (!LOGO_EXTENSION_REGEX.test(file.name)) {
    return "El logo debe ser una imagen .png, .jpg, .jpeg o .svg."
  }
  if (file.size > LOGO_MAX_SIZE_BYTES) {
    return "El logo no puede superar 1 MB."
  }
  return undefined
}

// Convierte el archivo en un texto "data:image/...;base64,..." para enviarlo en el JSON
function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function validate(values) {
  const errors = {}

  if (!values.username.trim()) {
    errors.username = "El nombre de usuario es obligatorio."
  }

  if (!values.email.trim()) {
    errors.email = "El email es obligatorio."
  } else if (!EMAIL_REGEX.test(values.email.trim())) {
    errors.email = "El email ingresado no tiene un formato válido."
  }

  if (!values.password) {
    errors.password = "La contraseña es obligatoria."
  }

  if (!values.teamName.trim()) {
    errors.teamName = "El nombre del equipo es obligatorio."
  }

  const logoError = getLogoError(values.teamLogo)
  if (logoError) {
    errors.teamLogo = logoError
  }

  return errors
}

function RegisterPage() {
  const navigate = useNavigate()
  const [values, setValues] = useState(INITIAL_VALUES)
  const [errors, setErrors] = useState({})
  const [generalError, setGeneralError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRegistered, setIsRegistered] = useState(false)
  const [logoPreview, setLogoPreview] = useState("")

  // Tras un registro exitoso, se muestra el mensaje y luego se redirige al login
  useEffect(() => {
    if (!isRegistered) return
    const timer = setTimeout(() => navigate("/login"), REDIRECT_DELAY_MS)
    return () => clearTimeout(timer)
  }, [isRegistered, navigate])

  function handleChange(event) {
    const { name, value } = event.target
    setValues((prev) => ({ ...prev, [name]: value }))
    // Al corregir un campo, se limpia su error
    setErrors((prev) => ({ ...prev, [name]: undefined }))
    setGeneralError("")
  }

  async function handleLogoChange(event) {
    const file = event.target.files?.[0] ?? null
    setValues((prev) => ({ ...prev, teamLogo: file }))
    setGeneralError("")
    setLogoPreview("")

    // El formato y el tamaño se validan apenas se elige el archivo
    const logoError = file ? getLogoError(file) : undefined
    setErrors((prev) => ({ ...prev, teamLogo: logoError }))

    if (file && !logoError) {
      try {
        setLogoPreview(await readFileAsDataUrl(file))
      } catch {
        setLogoPreview("")
      }
    }
  }

  function handleRequestError(error) {
    if (error instanceof ApiError) {
      const field = FIELD_BY_ERROR_CODE[error.error]
      if (field) {
        setErrors((prev) => ({ ...prev, [field]: error.message }))
      } else {
        setGeneralError(error.message)
      }
      return
    }

    // Sin respuesta del servidor (caído, sin conexión, CORS, etc.)
    setGeneralError(
      "No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo."
    )
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (isSubmitting || isRegistered) return

    const validationErrors = validate(values)
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    setIsSubmitting(true)
    setGeneralError("")

    try {
      const teamLogo = await readFileAsDataUrl(values.teamLogo)
      await httpService.post("/auth/register", {
        username: values.username.trim(),
        email: values.email.trim(),
        password: values.password,
        team_name: values.teamName.trim(),
        team_logo: teamLogo,
      })
      setIsRegistered(true)
    } catch (error) {
      handleRequestError(error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const fieldProps = (name) => ({
    id: name,
    value: values[name],
    onChange: handleChange,
    error: errors[name],
  })

  const isBusy = isSubmitting || isRegistered

  return (
    <main className="register-page">
      <section className="register-card" >
        <header className="register-card__header">
          <p className="register-card__brand">FutBot</p>
          <h1 id="register-title" className="register-card__title">
            Creá tu cuenta
          </h1>
          <p className="register-card__subtitle">
            Registrate y armá tu equipo para empezar a jugar.
          </p>
        </header>

        {isRegistered && (
          <p className="register-card__alert register-card__alert--success" role="status">
            ¡Registro exitoso! Te estamos llevando al inicio de sesión…
          </p>
        )}

        {generalError && (
          <p className="register-card__alert register-card__alert--error" role="alert">
            {generalError}
          </p>
        )}

        <form className="register-form" onSubmit={handleSubmit} noValidate>
          <fieldset className="register-form__section" disabled={isBusy}>
            <legend className="register-form__legend">Tu cuenta</legend>
            <FormField
              label="Nombre de usuario"
              autoComplete="username"
              placeholder="Escribí un nombre"
              {...fieldProps("username")}
            />
            <FormField
              label="Email"
              type="email"
              autoComplete="email"
              placeholder="ejemplo@email.com"
              {...fieldProps("email")}
            />
            <FormField
              label="Contraseña"
              type="password"
              autoComplete="new-password"
              placeholder="Escribí una contraseña"
              {...fieldProps("password")}
            />
          </fieldset>

          <fieldset className="register-form__section" disabled={isBusy}>
            <legend className="register-form__legend">Tu equipo</legend>
            <FormField 
              label="Nombre del equipo" 
              placeholder="Elegí el nombre del equipo"
              {...fieldProps("teamName")} 
            />
            <div className="logo-picker">
              <span className="logo-picker__label" id="teamLogo-label">
                Logo del equipo
              </span>

              <div className="logo-picker__row">
                <div className="logo-picker__preview" >
                  {logoPreview ? (
                    <img src={logoPreview} alt="" className="logo-picker__image" />
                  ) : (
                    <span className="logo-picker__placeholder">⚽</span>
                  )}
                </div>

                <label
                  htmlFor="teamLogo"
                  className={`logo-picker__button ${
                    errors.teamLogo ? "logo-picker__button--error" : ""
                  }`}
                >
                  <span className="logo-picker__button-text">
                    {values.teamLogo ? "Cambiar imagen" : "Adjuntar imagen"}
                  </span>
                  <span className="logo-picker__filename">
                    {values.teamLogo ? values.teamLogo.name : "PNG, JPG o SVG · máx. 1 MB"}
                  </span>
                </label>

                <input
                  id="teamLogo"
                  name="teamLogo"
                  type="file"
                  accept={LOGO_ACCEPT}
                  className="logo-picker__input"
                  onChange={handleLogoChange}
                />
              </div>

              <span id="teamLogo-error" className="logo-picker__error">
                {errors.teamLogo || ""}
              </span>
            </div>
          </fieldset>

          <Button
            type="submit"
            isLoading={isSubmitting}
            disabled={isRegistered}
            className="register-form__submit"
          >
            Crear cuenta
          </Button>
        </form>

        <p className="register-card__footer">
          ¿Ya tenés una cuenta?{" "}
          <Link to="/login" className="register-card__link">
            Iniciá sesión
          </Link>
        </p>
      </section>
    </main>
  )
}

export default RegisterPage
