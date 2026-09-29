import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import FormField from "../../components/FormField/FormField"
import Button from "../../components/Button/Button"
import { httpService, ApiError } from "../../services/createhttpService"
import { useSession } from "../../hooks/useSession"
import "./LoginPage.css"

const INITIAL_VALUES = {
  email: "",
  password: "",
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/    // Sintaxis del email: usuario@email.com

// Función de validación de los campos del formulario
function validate(values) {  
  const errors = {}
  // trim() elimina los espacios al inicio y al final de un string (no en el medio ;P)
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
// Hooks de React (Un hook es una función que permite "engancharse" a funcionalidades de React)
// useState es un hook que permite manejar estados.
// useNavigate es un hook que permite navegar de un ruta hacia otra.
function LoginPage() {
  const { startSession } = useSession()
  const navigate = useNavigate()    
  const [values, setValues] = useState(INITIAL_VALUES)      // Estado que almacena los valores de los campos del formulario
  const [generalError, setGeneralError] = useState("")      // Estado que almacena el error general 
  const [isSubmitting, setIsSubmitting] = useState(false)   // Estado que indica si el formulario se está enviando
  const [errors, setErrors] = useState({})                  // Estado que almacena los errores de validación de cada campo

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
      setGeneralError(error.message)  //Este mensaje de error viene del backend
      return
    }
    // Sin respuesta del servidor (caído, sin conexión, CORS, etc.)
    setGeneralError(
      "No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo."
    )
  }

  // Maneja el envío del formulario
  async function handleSubmit(event) {
    event.preventDefault()      //Evita que el navegador recargue la página al enviar el form
    if (isSubmitting) return     // Evita enviar el formulario dos veces si ya se envió una vez

    const validationErrors = validate(values)     //Valida los campos del formulario y los guarda en validationErrors
    if (Object.keys(validationErrors).length > 0) {      // Si encuentra algún error en la validación
      setErrors(validationErrors)       // Lo setea en setErrors y lo muestra por pantalla
      return                           // Cortamos para no enviar los datos al backend 
    }

    setIsSubmitting(true)       // Activamos el estado de que se está enviando 
    setGeneralError("")         // Limpiamos el mensaje de error general

    try {
      const data = await httpService.post("/auth/login", {      // Manda la request y pausa la función hasta tener una respuesta. Si sale bien
        email: values.email.trim(),                             // data contendrá la respuesta del backend ({ token, token_type, user }).
        password: values.password,
      })
      
      startSession({ token: data.token, tokenType: data.token_type, user: data.user })   
      navigate("/")                                                                    // Se redirige a la pagina principal (HomePage)
       
    } catch (error) {            // Si algo salta en el "try" salta directo al "catch" 
        handleRequestError(error)
    } finally {                  // Siempre se ejecuta, haya pasado un éxito (try) o un error (catch)
      setIsSubmitting(false)     // Se cambia el estado para reactivar el boton de envío
    }
  }

  const fieldProps = (name) => ({    // Setea los props de cada campo del formulario
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