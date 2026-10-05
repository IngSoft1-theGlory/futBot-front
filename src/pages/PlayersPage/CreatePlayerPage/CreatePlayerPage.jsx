import { useState } from "react"
import { useNavigate } from "react-router-dom"
import FormField from "../../../components/FormField/FormField"
import Button from "../../../components/Button/Button"
import { httpService, ApiError } from "../../../services/createhttpService"
import "./CreatePlayerPage.css"

/* 
Los 5 atributos PACSS: Power, Agility, Control, Speed, Strength
funciona asi
 
*/
const ATRIBUTOS_PACSS = [
  { clave: "power", etiqueta: "Potencia (Power)" },
  { clave: "agility", etiqueta: "Agilidad (Agility)" },
  { clave: "control", etiqueta: "Control" },
  { clave: "speed", etiqueta: "Velocidad (Speed)" },
  { clave: "strength", etiqueta: "Fuerza (Strength)" },
] //lo escribi como un arreglo de objetos ya que me parecio mas comodo asi
// la idea de tener clave y etiqueta es = tengo una lista de atributos y cada atributo tiene una clave interna y una etiqueta para mostrar al resto

const PUNTOS_MINIMOS_POR_ATRIBUTO = 20 
const PUNTOS_MAXIMOS_POR_ATRIBUTO = 100
const PUNTOS_MAXIMOS = 300

// 5 atributos x 60 puntos = 300: arranca ya sumando el total correcto
const VALORES_INICIALES = {
  name: "",
  number: "",
  power: "60",
  agility: "60",
  control: "60",
  speed: "60",
  strength: "60",
}

// Errores del contrato que corresponden a un campo puntual del formulario
const CAMPO_POR_CODIGO_DE_ERROR = {
  DUPLICATE_JERSEY_NUMBER: "number",
}//esto de aca es un mapeo de error para el backend , si el backend responde con ese codigo de error se muestra debajo del campo el numero(number)

// Suma los 5 atributos PACSS cargados hasta el momento
function sumarPuntosPacss(values) {
  return ATRIBUTOS_PACSS.reduce((total, { clave }) => total + (Number(values[clave]) || 0), 0)
} //reduce es una funcion que ya viene en js

function validate(values) { //values tiene el formato de VALORES_INICIALES
  const errors = {} //Creá un objeto vacío y guardalo en la constante errors

  if (!values.name.trim()) {
    errors.name = "El nombre del jugador es obligatorio." //antes de esto errors no tiene ningun atributo (osea era un objeto vacio), aca le acabo de crear un nuevo atributo llamado name que tiene de valor ese string se podria decir
  }
  /* TODAS ESTAS FUNCIONES YA VIENEN EN JS y esto son lo que hacen
  toString() sirve para convertir un valor a texto (string)
  
  trim() sirve para sacar los espacios que están al principio y al final de un texto
  
  Number() sirve para convertir algo a número
  
  isInterger sirve para preguntar si el numero es entero
  */ 
  if (!values.number.toString().trim()) {
    errors.number = "El número de camiseta es obligatorio." //mismo caso que con name arriba
  } else if (!Number.isInteger(Number(values.number)) || Number(values.number) < 0 || Number(values.number) > 100) {
    errors.number = "El número de camiseta debe ser un número entero positivo entre 1 y 99."
  }

  // Nota: que el número no se repita con otro jugador del equipo lo valida el backend
  // (código DUPLICATE_JERSEY_NUMBER), porque el frontend no tiene la lista de jugadores acá.
  
  // some() preguntar si al menos un elemento del arreglo cumple la condición, SINTAXIS = array.some((elemento) => condicion
  const hayAtributoFueraDeRango = ATRIBUTOS_PACSS.some(({ clave }) => { 
    const valor = Number(values[clave])
    return (
      !values[clave].toString().trim() || Number.isNaN(valor) || valor < PUNTOS_MINIMOS_POR_ATRIBUTO || valor > PUNTOS_MAXIMOS_POR_ATRIBUTO
    ) //Revisá todos los atributos PACSS y decime si existe alguno que tenga un valor inválido
  })

  if (hayAtributoFueraDeRango) { //aca errors paccs mismo caso que name y number , leer el name de arriba
    errors.pacss = `Cada atributo debe valer entre ${PUNTOS_MINIMOS_POR_ATRIBUTO} y ${PUNTOS_MAXIMOS_POR_ATRIBUTO} puntos.`
  } else {
    const total = sumarPuntosPacss(values)
    if (total !== PUNTOS_MAXIMOS) {
      errors.pacss = `La suma de los atributos debe dar exactamente ${PUNTOS_MAXIMOS} puntos (ahora suma ${total}).`
    }
  }

  return errors
}

function CreatePlayerPage() {
  const navigate = useNavigate()
  const [values, setValues] = useState(VALORES_INICIALES)
  const [errors, setErrors] = useState({})
  const [generalError, setGeneralError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCreated, setIsCreated] = useState(false)

  // handleChange = manejar cambio
  function handleChange(event) { //event es un objeto que contiene información sobre lo que acaba de pasar
    const { name, value } = event.target 
    /*
    const { name, value } = event.target
    Es una forma corta de escribir:

    const name = event.target.name
    const value = event.target.value
    */
    setValues((prev) => ({ ...prev, [name]: value }))
    // Al corregir un campo se limpia su error puntual y el de la suma de atributos

    /*
      Ese "prev" significa: estado anterior , es como 

    "El valor de values justo antes de este cambio."

      Ese "..." significa: spread operator , es como

    "Copiá todo lo que tiene este objeto."
    */
    setErrors((prev) => ({ ...prev, [name]: undefined, pacss: undefined }))
    setGeneralError("")
    setIsCreated(false)
  }
  
  function handleCancel() {
    // vuelve siempre al lobby (home), no a la pantalla anterior: la lista de jugadores no se muestra por ahora
    navigate("/")
  }

  function handleRequestError(error) {
    if (error instanceof ApiError) {
      if (error.error === "INVALID_PACSS_DATA") {
        setErrors((prev) => ({ ...prev, pacss: error.message }))
        return //Ya manejé este error. Salgo de handleRequestError y no sigo ejecutando el código que viene abajo
      }

      const campo = CAMPO_POR_CODIGO_DE_ERROR[error.error]
      if (campo) {
        setErrors((prev) => ({ ...prev, [campo]: error.message }))
        return
      }

      // Acá caen INVALID_PLAYER_DATA, UNAUTHORIZED y TEAM_NOT_FOUND: se muestran como aviso general
      setGeneralError(error.message)
      return
    }

    // Sin respuesta del servidor (caído, sin conexión, CORS, etc.)
    setGeneralError(
      "No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo."
    )
  }
  /*
  lo que hace handleChange es basicamente 
    El usuario modificó un campo.

    Averiguá qué campo modificó (name).

    Averiguá qué valor puso (value).

    Actualizá ese campo en values, sin borrar los demás.

    Limpiá el error de ese campo.

    Limpiá el error de PACSS.

    Limpiá cualquier error general.

    Ocultá el mensaje de "jugador creado".

  */

  // necesito que esta funcion sea asincrona ya que va a esperar la respuesta del back
  async function handleSubmit(event) {
    event.preventDefault() //Cancelá el comportamiento predeterminado del formulario, esto porque el protocolo para cuando se han subido nuevos datos es recargar la pagina y no queremos eso
    if (isSubmitting) return //osea si se esta enviando un formulario sali de aca

    const validationErrors = validate(values)
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    setIsSubmitting(true)
    setGeneralError("")
    setIsCreated(false)

    try { //Intentá ejecutar este código, Porque dentro vamos a hacer una operación que puede fallar
      await httpService.post("/players", { //await = Esperá el resultado de esta operación antes de continuar con las siguientes líneas de esta función
        name: values.name.trim(),
        number: Number(values.number),
        power: Number(values.power),
        agility: Number(values.agility),
        control: Number(values.control),
        speed: Number(values.speed),
        strength: Number(values.strength),
      })
      setIsCreated(true)
      setValues(VALORES_INICIALES)
      setErrors({})
    } catch (error) {
      handleRequestError(error)
    } finally {
      setIsSubmitting(false)
    }
  }
  /*
  handleSubmit es el coordinador de todo el proceso de creación del jugador

  basicamente lo que hace es= el usuario quiere crear un jugador, 
  primero evito que el navegador recargue la página, 
  compruebo que no haya otro envío en curso, 
  valido todos los datos, 
  si están mal, muestro los errores y termino, 
  si están bien, bloqueo temporalmente el formulario y mando los datos al backend, 
  si el backend acepta al jugador, muestro que se creó correctamente y limpio el formulario. Si algo falla, capturo el error y lo muestro de la manera correspondiente, 
  finalmente, haya salido bien o mal, vuelvo a habilitar el formulario
  */

  const fieldProps = (name) => ({
    id: name,
    value: values[name],
    onChange: handleChange,
    error: errors[name],
  })

  const totalPacss = sumarPuntosPacss(values)

  return (
    <main className="create-player-page">
      <section className="create-player-card" >
        <header className="create-player-card__header">
          <p className="create-player-card__brand">FutBot</p>
          <h1 id="create-player-title" className="create-player-card__title">
            Crear jugador
          </h1>
          <p className="create-player-card__subtitle">
            Cargá los datos y repartí 300 puntos entre los atributos PACSS.
          </p>
        </header>

        {isCreated && (
          <p className="create-player-card__alert create-player-card__alert--success" role="status">
            ¡Jugador creado con éxito!
          </p>
        )}

        {generalError && (
          <p className="create-player-card__alert create-player-card__alert--error" role="alert">
            {generalError}
          </p>
        )}

        <form className="create-player-form" onSubmit={handleSubmit} noValidate>
          <fieldset className="create-player-form__section" disabled={isSubmitting}>
            <legend className="create-player-form__legend">Datos del jugador</legend>
            <FormField label="Nombre" {...fieldProps("name")} />
            <FormField
              label="Número de camiseta"
              type="number"
              min="1"
              {...fieldProps("number")}
            />
          </fieldset>

          <fieldset className="create-player-form__section" disabled={isSubmitting}>
            <legend className="create-player-form__legend">Atributos PACSS</legend>

            {ATRIBUTOS_PACSS.map(({ clave, etiqueta }) => (
              <FormField
                key={clave}
                label={etiqueta}
                type="number"
                min={PUNTOS_MINIMOS_POR_ATRIBUTO}
                max={PUNTOS_MAXIMOS_POR_ATRIBUTO}
                {...fieldProps(clave)}
              />
            ))}

            <p
              className={`create-player-form__total ${
                totalPacss === PUNTOS_MAXIMOS
                  ? "create-player-form__total--ok"
                  : "create-player-form__total--warning"
              }`}
            >
              Total repartido: {totalPacss} / {PUNTOS_MAXIMOS} puntos
            </p>

            {errors.pacss && (
              <span className="create-player-form__pacss-error" role="alert">
                {errors.pacss}
              </span>
            )}
          </fieldset>

          <div className="create-player-form__actions">
            <Button
              type="button"
              variant="danger"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Crear jugador
            </Button>
          </div>
        </form>
      </section>
    </main>
  )
}

export default CreatePlayerPage
