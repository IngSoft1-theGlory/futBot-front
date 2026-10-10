import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { httpService, ApiError } from "../../services/createhttpService"
import BehaviorCard from "../../components/BehaviorCard/BehaviorCard"
import BehaviorDetail from "../../components/BehaviorDetail/BehaviorDetail"
import "./BehaviorListPage.css"


function getBehaviorErrorMessage(err) {   // Maneja los errores al obtener el behavior
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

  useEffect(() => {
    let isActive = true   // Chequeamos si el componente esta activo

    httpService
      .get("/behaviors?is_default=true")   
      .then((data) => {
        if (!isActive) return
        setBehaviors(data)    // Setea la lista de comnportamientos  
        setStatus("success")  // Setea el estado de la página
      })
      .catch((err) => {
        if (!isActive) return
        setError(getBehaviorErrorMessage(err))    // Setea el mensaje de error llamando a la funcion
        setStatus("error")    // Setea el estado de la pagina
      })
    
    return () => {
      isActive = false  // Evita setear el estado de un componente desmontado
    }
  }, [])

  // La colección llama a esta función cuando el usuario elige un comportamiento: abre su detalle
  function onSelectBehavior(behaviorId) {
    setSelectedBehaviorId(behaviorId)
  }

  // Vuelve a la coleccion, la lista sigue guardada en "behaviors", asi que por eso no se vuelve a pedir
  function onBackToCollection() {
    setSelectedBehaviorId(null)
  }

  // Si hay un comportamiento elegido, se muestra su detalle en lugar de la lista
  if (selectedBehaviorId !== null) {
    return (
      <main className="behavior-page">
        <header className="behavior-page__header">
          <h1 className="behavior-page__title">Comportamientos</h1>
        </header>

        <BehaviorDetail behaviorId={selectedBehaviorId} onBack={onBackToCollection} />
      </main>
    )
  }

  return (
  <main className="behavior-page">
    <header className="behavior-page__header">
      <h1 className="behavior-page__title">Comportamientos</h1>
    </header>

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
  </main>
  )
}

export default BehaviorListPage
