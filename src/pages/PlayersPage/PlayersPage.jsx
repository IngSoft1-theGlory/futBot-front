import { Link, useNavigate } from "react-router-dom"
import Button from "../../components/Button/Button"
import "./PlayersPage.css"

function PlayersPage() {
  const navigate = useNavigate()

  return (
    <main className="players-page">
      <header className="players-page__header">
        <h1 className="players-page__title">Jugadores</h1>
        <Button onClick={() => navigate("/players/createplayer")}>
          Crear jugador
        </Button>
      </header>

      <p className="players-page__empty">Todavía no hay jugadores para mostrar.</p>

      <Link to="/" className="players-page__back">
        Volver al inicio
      </Link>
    </main>
  )
}

export default PlayersPage
