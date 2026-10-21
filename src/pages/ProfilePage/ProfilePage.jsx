import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import Button from "../../components/Button/Button"
import TeamSummary from "../../components/TeamSummary/TeamSummary"
import { useSession } from "../../hooks/useSession"
import { ApiError } from "../../services/createhttpService"
import { fetchTeam } from "../../services/teams"
import "./ProfilePage.css"

/*
 Perfil del usuario (/profile): sus datos de cuenta (de la sesion) y los de su equipo (de GET /teams/{teamId}).

 status: "loading" | "ready" | "error"
*/
function ProfilePage() {
  const navigate = useNavigate()
  const { user } = useSession()

  const [status, setStatus] = useState("loading")
  const [team, setTeam] = useState(null)
  // Cada vez que sube este número, el efecto vuelve a correr (es el "reintentar")
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    // pasa a false al salir de la pantalla: una respuesta que llega tarde no cambia nada
    let isActive = true
    setStatus("loading")

    fetchTeam(user?.team_id)
      .then((data) => {
        if (!isActive) return
        setTeam(data)
        setStatus("ready")
      })
      .catch((error) => {
        if (!isActive) return
        if (error instanceof ApiError && error.status === 401) return // la sesion se encarga
        setStatus("error")
      })

    return () => {
      isActive = false
    }
  }, [user?.team_id, attempt])

  return (
    <main className="profile-page">
      <div className="profile-page__card">
        <header className="profile-page__header">
          <span className="profile-page__avatar" aria-hidden="true">
            {(user?.username ?? "?").charAt(0).toUpperCase()}
          </span>
          <div className="profile-page__account">
            <h1 className="profile-page__username">{user?.username}</h1>
            <p className="profile-page__email">{user?.email}</p>
          </div>
          <Button onClick={() => navigate("/profile/edit")}>Editar perfil</Button>
        </header>

        <h2 className="profile-page__section-title">Mi equipo</h2>

        {status === "loading" && <p className="profile-page__message">Cargando equipo...</p>}

        {status === "error" && (
          <div className="profile-page__error" role="alert">
            <p>No se pudieron cargar los datos de tu equipo.</p>
            <Button variant="secondary" onClick={() => setAttempt((current) => current + 1)}>
              Reintentar
            </Button>
          </div>
        )}

        {status === "ready" && <TeamSummary team={team} />}
      </div>

      <Link to="/" className="profile-page__back">
        Volver al Inicio
      </Link>
    </main>
  )
}

export default ProfilePage
