import { useEffect, useState } from "react"
import { httpService, ApiError } from "../../services/createhttpService"
import Button from "../Button/Button"
import CodeMirror from "@uiw/react-codemirror"
import { python } from "@codemirror/lang-python"
import BehaviorHelp from "../BehaviorHelp/BehaviorHelp"
import { BEHAVIOR_TYPE_LABELS } from "../../constants/behaviorTypes"
import "./BehaviorForm.css"

const MAX_NAME_LENGTH = 100
const MAX_DESCRIPTION_LENGTH = 500
const MAX_CODE_LENGTH = 5000
const CODE_EXTENSIONS = [python()]

// Función de validación de los campos del formulario
function validate({ name, description, code }) {
  const errors = {}
  if (!name.trim()) {
    errors.name = "El nombre es obligatorio"
  } else if (name.length > MAX_NAME_LENGTH) {
    errors.name = `El nombre no puede tener más de ${MAX_NAME_LENGTH} caracteres`
  }
  if (!description.trim()) {
    errors.description = "La descripción es obligatoria"
  } else if (description.length > MAX_DESCRIPTION_LENGTH) {
    errors.description = `La descripción no puede tener más de ${MAX_DESCRIPTION_LENGTH} caracteres`
  }
  if (!code.trim()) {
    errors.code = "El código es obligatorio"
  } else if (code.length > MAX_CODE_LENGTH) {
    errors.code = `El código no puede tener más de ${MAX_CODE_LENGTH} caracteres`
  }
  
  return errors
}
// Maneja que mensaje mostrar según el error
function getErrorMessage(err) {
  if (err instanceof ApiError) {
    if (err.status === 403) return "No tenés permiso para modificar este comportamiento."
    if (err.status === 404) return "El comportamiento no existe o fue eliminado."
    return err.message   // Mensaje del contrato
  }
  return "No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo."
}

/*
 Props:
   behaviorId: id del comportamiento a editar (si no viene, se está creando)
   onBack:     cancela y vuelve a donde estaba el usuario
   onSaved:    se llama con el comportamiento guardado cuando el back lo acepta
*/

function BehaviorForm({ behaviorId, onBack, onSaved }) {
  // Si hay un id, es edición. Si no, es crear.
  const isEditing = behaviorId !== undefined && behaviorId !== null

  // Valores de los campos
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [code, setCode] = useState("")
  const [behaviorType, setBehaviorType] = useState("PLAYER")  // "PLAYER" o "COACH", al crear arranca en PLAYER

  // Errores de los campos
  const [fieldErrors, setFieldErrors] = useState({})

  // Estado del envío
  const [isSubmitting, setIsSubmitting] = useState(false)  // Petición en curso
  const [submitError, setSubmitError] = useState("")   // Mensaje del back o de conexión

  // Carga inicial (solo en edición)
  const [loadStatus, setLoadStatus] = useState(isEditing ? "loading" : "success")  // Estados: "loading", "success" o "error"
  const [loadError, setLoadError] = useState("")

  useEffect(() => {
    if (!isEditing) return  // al crear no hay nada que pedir
    let isActive = true   // el componente esta activo 

    httpService
      .get(`/behaviors/${behaviorId}`)
      .then((data) => {
        if (!isActive) return
        setName(data.name)
        setDescription(data.description)
        setCode(data.code)
        setBehaviorType(data.behavior_type)   // solo para mostrarlo, al editar no se puede cambiar
        setLoadStatus("success")    // Se muestra el formulario
      })
      .catch((err) => {
        if (!isActive) return
        // 401: la sesión vencio y se redirigue al login
        if (err instanceof ApiError && err.status === 401) return

        setLoadError(getErrorMessage(err))
        setLoadStatus("error")
      })

    return () => {
      isActive = false
    }
  }, [behaviorId])

  function handleFieldChange(field, value, setValue) {
    // Actualización del campo que se esta editando
    setValue(value) 

    // Si el campo tenía un error de validación, lo quita al empezar a corregirlo
    setFieldErrors((previousErrors) => {
      if (!previousErrors[field]) return previousErrors

      const nextErrors = { ...previousErrors }
      delete nextErrors[field]
      return nextErrors
    })

    setSubmitError("")  // Se descarta el error general 
  }

  function handleSubmit(event) {
    event.preventDefault()     // evita que el navegador recargue la página al enviar
    if (isSubmitting) return   // segunda barrera contra doble envío

    //Si hay errores los mostramos y no mandamos nada al back.
    const errors = validate({ name, description, code })
    if(Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    // Limpiamos los errores y marcamos el envío como iniciado
    setFieldErrors({})
    setSubmitError("")
    setIsSubmitting(true)

    const body = { name, description, code }
    let request
    if (isEditing) {
      // Al editar no se manda el tipo, una vez creado, no se puede cambiar
      request = httpService.put(`/behaviors/${behaviorId}`, body)
    } else {
      // Al crear se manda siempre el tipo elegido, junto con los otros tres campos
      request = httpService.post(`/behaviors`, { ...body, behavior_type: behaviorType })
    }


    request 
      .then ((data) => onSaved(data))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) return
        setSubmitError(getErrorMessage(err))
      })
      .finally(() => setIsSubmitting(false))  // volvemos a habilitar el botón
  }

  if (loadStatus === "loading") {
    return (
      <p className="behavior-form__message" role="status">
        Cargando comportamiento...
      </p>
    )
  }
 
  if (loadStatus === "error") {
    return (
      <section className="behavior-form">
        <button type="button" className="behavior-form__back" onClick={onBack}>
          Volver
        </button>
        <p className="behavior-form__message behavior-form__message--error" role="alert">
          {loadError}
        </p>
      </section>
    )
  }
 
  const isCodeTooLong = code.length > MAX_CODE_LENGTH
  // Texto del tipo ("Jugador" o "DT"). Queda undefined si el back no mandó el tipo
  const behaviorTypeLabel = BEHAVIOR_TYPE_LABELS[behaviorType]
  return (
    <section className="behavior-form">
      <h2 className="behavior-form__title">
        {isEditing ? "Editar comportamiento" : "Crear comportamiento"}
      </h2>

      {/* Al editar el tipo no se puede cambiar: se muestra como texto, sin campo.
          Si el back no mandó el tipo, no se muestra nada (mejor que una línea vacía) */}
      {isEditing && behaviorTypeLabel && (
        <p className="behavior-form__type">
          Tipo: <strong>{behaviorTypeLabel}</strong>
        </p>
      )}

      <form onSubmit={handleSubmit}>
        {/* Tipo: solo al crear se elige con el desplegable */}
        {!isEditing && (
          <div className="behavior-form__field">
            <label htmlFor="behavior-type">Tipo:</label>
            <select
              id="behavior-type"
              value={behaviorType}
              onChange={(e) => setBehaviorType(e.target.value)}
            >
              <option value="PLAYER">{BEHAVIOR_TYPE_LABELS.PLAYER}</option>
              <option value="COACH">{BEHAVIOR_TYPE_LABELS.COACH}</option>
            </select>
          </div>
        )}

        {/* Nombre */}
        <div className="behavior-form__field">
          <label htmlFor="behavior-name">Nombre:</label>
          <input
            id="behavior-name"
            className={fieldErrors.name ? "behavior-form__input--error" : ""}
            type="text"
            value={name}
            onChange={(e) => handleFieldChange("name", e.target.value, setName)}
          />
          {fieldErrors.name && (
            <p className="behavior-form__error" role="alert">{fieldErrors.name}</p>
          )}
        </div>
 
        {/* Descripción */}
        <div className="behavior-form__field">
          <label htmlFor="behavior-description">Descripción:</label>
          <textarea
            id="behavior-description"
            className={fieldErrors.description ? "behavior-form__input--error" : ""}
            rows={4}
            value={description}
            onChange={(e) => handleFieldChange("description", e.target.value, setDescription)}
          />
          {fieldErrors.description && (
            <p className="behavior-form__error" role="alert">{fieldErrors.description}</p>
          )}
        </div>
 
        {/* Código */}
        <div className="behavior-form__field">
          <label htmlFor="behavior-code">Código:</label>
          <CodeMirror
            id="behavior-code"
            className={`behavior-form__code ${fieldErrors.code ? "behavior-form__code--error" : ""}`}
            value={code}
            height="300px"
            theme="dark"
            extensions={CODE_EXTENSIONS}
            onChange={(value) => handleFieldChange("code", value, setCode)}
            basicSetup={{ autocompletion:false }}
          />
          <p className={isCodeTooLong ? "behavior-form__counter behavior-form__counter--over" : "behavior-form__counter"}>
            {code.length} / {MAX_CODE_LENGTH}
          </p>
          {fieldErrors.code && (
            <p className="behavior-form__error" role="alert">{fieldErrors.code}</p>
          )}
          {/* Reglas del código del comportamiento. La frase del jugador quieto no aplica
              al DT: lo que pasa si falla el código del DT lo explica su ayuda */}
          <p className="behavior-form__hint">
            El código debe definir una función on_tick(api). No se permiten for, while, import
            ni comprensiones, y tampoco el texto "__".
            {behaviorType !== "COACH" && " Si usás algo que no está disponible, el jugador con este comportamiento se quedará quieto durante el partido."}
            {" "}Debajo esta la ayuda con lo que sí podés usar.
          </p>
          {/* La ayuda cambia según el tipo: primitivas de jugador o de DT */}
          <BehaviorHelp behaviorType={behaviorType} />
        </div>
 
        {/* Error que devolvió el back (o de conexión) al enviar */}
        {submitError && (
          <p className="behavior-form__message behavior-form__message--error" role="alert">
            {submitError}
          </p>
        )}
 
        {/* Acciones para cancelar o guardar el formulario */}
        <div className="behavior-form__actions">
          <Button variant="secondary" onClick={onBack}>Cancelar</Button>
          <Button type="submit" isLoading={isSubmitting}>Guardar</Button>
        </div>
      </form>
    </section>
  )
}

export default BehaviorForm
