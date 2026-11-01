import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { httpService, ApiError } from "../../services/createhttpService"
import BehaviorCard from "../../components/BehaviorCard/BehaviorCard"
import BehaviorDetail from "../../components/BehaviorDetail/BehaviorDetail"
import BehaviorForm from "../../components/BehaviorForm/BehaviorForm"
import Button from "../../components/Button/Button"
import "./BehaviorListPage.css"


function getErrorMessage(err) {   // Maneja los errores al obtener el behavior
  if (err instanceof ApiError) {
    if (err.status === 403) return "No tenés permisos para ver los comportamientos."
    return err.message   // Mensaje del contrato
  }
  return "No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo."
}

function BehaviorListPage() {
  const [behaviors, setBehaviors] = useState([]) // Almacena la lista de comportamientos
  const [error, setError] = useState("") // Setea los errores
  const [status, setStatus] = useState("loading") // Setea el estado de la página
  const [selectedBehaviorId, setSelectedBehaviorId] = useState(null) // Id del comportamiento abierto (null = se ve la lista)
  const [isFormOpen, setIsFormOpen] = useState(false) // Se muestra el formulario de crear/editar
  const [successMessage, setSuccessMessage] = useState("") // Mensaje de éxito después de guardar
  const [refreshKey, setRefreshKey] = useState(0) // Al cambiar, el efecto vuelve a pedir la lista

  // El mensaje de éxito al guardar un comportamiento.
  // El clearTimeout evita que quede un timer colgado si el componente se cierra antes.
  useEffect(() => {
    if (!successMessage) return
    const timerId = setTimeout(() => setSuccessMessage(""), 4000)
    return () => clearTimeout(timerId)
  }, [successMessage])

  // Pide la lista al montar la página y cada vez que cambia refreshKey (después de guardar)
  useEffect(() => {
    let isActive = true   // Chequeamos si el componente esta activo

    httpService
      .get("/behaviors")
      .then((data) => {
        if (!isActive) return
        setBehaviors(data)    // Setea la lista de comportamientos
        setStatus("success")  // Setea el estado de la página
      })
      .catch((err) => {
        if (!isActive) return
        setError(getErrorMessage(err))    // Setea el mensaje de error llamando a la funcion
        setStatus("error")    // Setea el estado de la pagina
      })

    return () => {
      isActive = false  // Evita setear el estado de un componente desmontado
    }
  }, [refreshKey])

  // La colección llama a esta función cuando el usuario elige un comportamiento: abre su detalle
  function onSelectBehavior(behaviorId) {
    setSelectedBehaviorId(behaviorId)
  }

  // Vuelve a la coleccion, la lista sigue guardada en "behaviors", asi que por eso no se vuelve a pedir
  function onBackToCollection() {
    setSelectedBehaviorId(null)
  }

  // Abre el formulario para crear un comportamiento si es desde el listado,
  // o para editar si es seleccionado desde su detalle. 
  function onOpenForm() {
    setIsFormOpen(true)
  }

  // Cierra el formulario sin guardar. Como selectedBehaviorId no se toca,
  // el usuario vuelve solo adonde estaba: al detalle o a la lista
  function onCloseForm() {
    setIsFormOpen(false)
  }

  // El formulario llama a esta función cuando el back aceptó el guardado
  function onSaved(saved) {
    // Si no había un comportamiento seleccionado, se estaba creando
    const wasCreating = selectedBehaviorId === null
    setSuccessMessage(wasCreating ? "Comportamiento creado correctamente" : "Comportamiento editado correctamente")
    setSelectedBehaviorId(saved.behavior_id)   // abre el detalle del comportamiento guardado
    setIsFormOpen(false)
    setRefreshKey((k) => k + 1)                // la lista se vuelve a pedir, así no queda desactualizada
  }

  // Se muestra el formulario si está abierto; si no, el detalle seleccionado o la lista.
  let view = "list"
  if (isFormOpen) {
    view = "form"
  } else if (selectedBehaviorId !== null) {
    view = "detail"
  }

  return (
    <main className="behavior-page">
      <header className="behavior-page__header">
        <h1 className="behavior-page__title">Comportamientos</h1>
      </header>

      {successMessage && (
        <p className="behavior-page__success" role="status">{successMessage}</p>
      )}

      {view === "form" && (
        <BehaviorForm
          behaviorId={selectedBehaviorId}
          onBack={onCloseForm}
          onSaved={onSaved}
        />
      )}

      {view === "detail" && (
        <BehaviorDetail
          behaviorId={selectedBehaviorId}
          onBack={onBackToCollection}
          onEdit={onOpenForm}
        />
      )}

      {view === "list" && (
        <>
          <div className="behavior-page__actions">
            <Button onClick={onOpenForm}>Crear comportamiento</Button>
          </div>

          {status === "loading" && (
            <p className="behavior-page__message" role="status">
              Cargando comportamientos...
            </p>
          )}

          {status === "error" && (
            <p className="behavior-page__message behavior-page__message--error" role="alert">
              {error}
            </p>
          )}

          {status === "success" && behaviors.length === 0 && (
            <p className="behavior-page__message" role="status">
              No hay comportamientos disponibles
            </p>
          )}

          {status === "success" && behaviors.length > 0 && (
            <div className="behavior-page__list">
              {behaviors.map((behavior) => (
                <BehaviorCard
                  key={behavior.behavior_id}
                  behavior={behavior}
                  onSelect={onSelectBehavior}
                />
              ))}
            </div>
          )}

          <Link to="/" className="behavior-page__back">
            Volver al inicio
          </Link>
        </>
      )}
    </main>
  )
}

export default BehaviorListPage