import { useState } from "react"
import { useNavigate } from "react-router-dom"
import Button from "../../components/Button/Button"
import { useSession } from "../../hooks/useSession"
import "./HomePage.css"

// Pantalla privada provisoria: se reemplaza cuando exista el inicio real de la app
function HomePage() {
  const { user, logout } = useSession()
  const navigate = useNavigate()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  async function handleLogout() {
    setIsLoggingOut(true)
    await logout()
  }

  return (
    <main className="home-page">
      <h1 className="home-page__title">FutBot</h1>
      <p className="home-page__greeting">Hola, {user?.username ?? "jugador"}.</p>
      <Button onClick={() => navigate("/players")}>Jugadores</Button>
      <Button variant="alternative" onClick={() => navigate("/friendlies")}>
        Unirse a un Amistoso
      </Button>
      <Button variant="danger" onClick={handleLogout} isLoading={isLoggingOut}>
        Cerrar Sesión
      </Button>
    </main>
  )
}

export default HomePage