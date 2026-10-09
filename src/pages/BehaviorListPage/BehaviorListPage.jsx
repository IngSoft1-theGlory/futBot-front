import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { httpService, ApiError } from "../../services/createhttpService"
import BehaviorCard from "../../components/BehaviorCard/BehaviorCard"
import "./BehaviorListPage.css"


function getBehaviorErrorMessage(err) {   // Maneja los errores al obtener el behavior
  if (err instanceof ApiError) {
    if (err.status === 403) return "No tenés permisos para ver los comportamientos."
    return err.message   // Mensaje del contrato
  }
  return "No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo."
}

function BehaviorListPage() {
  const navigate = useNavigate()        // Lo usamos para navegar a otra ruta
  const [behaviors, setBehaviors] = useState([]) // Almacena la lista de comportamientos
  const [error, setError] = useState("") // Setea los errores
  const [status, setStatus] = useState("loading") // Setea el estado de la página

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
            onSelect={(behaviorId) => navigate(`/behaviors/${behaviorId}`)}
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
