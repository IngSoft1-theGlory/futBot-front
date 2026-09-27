import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import FormField from "../../components/FormField/FormField"
import Button from "../../components/Button/Button"
import { httpService, ApiError } from "../../services/createhttpService"
import { setSession } from "../../services/session"
import "./LoginPage.css"

const INITIAL_VALUES = {
  email: "",
  password: "",
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/    // Sintaxis del email: usuario@email.com

// Función de validación de los campos del formulario
function validate(values) {  
  const errors = {}
  
  if (!values.email.trim()) {
    errors.email = "El email es obligatorio"
  } else if (!EMAIL_REGEX.test(values.email.trim())) {
    errors.email = "El email no tiene un formato válido"
  }

  if (!values.password.trim()) {
    errors.password = "La contraseña es obligatoria"
  }

  return errors
}

function LoginPage() {
  // Hooks de React (Un hook es una función que permite "engancharse" a funcionalidades de React)
  const navigate = useNavigate()    // useNavigate permite redirigir a otra ruta
  const [values, setValues] = useState(INITIAL_VALUES)    // Hook de estados: Permiten almacenar y actualizar valores 
                                                          // que afectan la renderización del componente
  const [generalError, setGeneralError] = useState("")    // Estado para mostrar un error general 
  const [isSubmitting, setIsSubmitting] = useState(false)    // Estado que indica si se está enviando el formulario
  const [errors, setErrors] = useState({})    // Estado que almacena los errores de validación de cada campo

  // Maneja los cambios en los campos del formulario
  function handleChange(event) {
    const { name, value } = event.target
    setValues((prev) => ({ ...prev, [name]: value }))
    // Al corregir un campo, se limpia su error
    setErrors((prev) => ({ ...prev, [name]: undefined }))
    setGeneralError("")
  }

  // Maneja los errores de la petición al backend
  function handleRequestError(error) {
    if (error instanceof ApiError) {
      // Este error contempla el INVALID_CREDENTIALS que no apunta a un campo puntual.
      // Si falló el email o la contraseña, 
      // Se mostará como mensaje general que hubo un error.
      setGeneralError(error.message)
      return
    }
    // Sin respuesta del servidor (caído, sin conexión, CORS, etc.)
    setGeneralError(
      "No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo."
    )
  }

  // Maneja el envío del formulario
  async function handleSubmit(event) {
    event.preventDefault()
    if (isSubmitting) return 

    const validationErrors = validate(values)
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    setIsSubmitting(true)
    setGeneralError("")

    try {
      const data = await httpService.post("/auth/login", {
        email: values.email.trim(),
        password: values.password,
      })
      
      setSession({ token: data.token, tokenType: data.token_type, user: data.user })
      navigate("/")
       
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
    error: errors[name]
  })

  return (
    <main className="login-page">
    <section className="login-card">
      <header className="login-card__header">
        <p className="login-card__brand">FutBot</p>
        <h1 className="login-card__title">Iniciar sesión</h1>
      </header>

      {generalError && (
        <p className="login-card__alert login-card__alert--error" role="alert">
          {generalError}
        </p>
      )}

      <form className="login-form" onSubmit={handleSubmit} noValidate>
        <fieldset className="login-form__section" disabled={isSubmitting}>
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
            autoComplete="current-password"
            placeholder="Tu contraseña"
            {...fieldProps("password")}
          />
        </fieldset>

        <Button type="submit" isLoading={isSubmitting} className="login-form__submit">
          Iniciar sesión
        </Button>
      </form>

      <p className="login-card__footer">
        ¿No tenés cuenta?{" "}
        <Link to="/register" className="login-card__link">
          Registrate
        </Link>
      </p>
    </section>
  </main>
  )
}

export default LoginPage