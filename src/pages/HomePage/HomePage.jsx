import { useState } from "react"
import { useNavigate } from "react-router-dom"
import Button from "../../components/Button/Button"
import { useSession } from "../../hooks/useSession"
import "./HomePage.css"

// ---------- Íconos (SVG simples, heredan el color del texto) ----------

function TrophyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
    </svg>
  )
}

function BallIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="m12 7 4 3-1.5 4.5h-5L8 10l4-3Z" />
      <path d="M12 3v4M16 10l4.5-1.5M14.5 14.5 17 19M9.5 14.5 7 19M8 10 3.5 8.5" />
    </svg>
  )
}

function PlayerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="8" r="4" />
      <path d="M3 21a7 7 0 0 1 14 0M19 8v6M16 11h6" />
    </svg>
  )
}

function CodeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16" />
    </svg>
  )
}

// ---------- Tarjeta de acción ----------

function ActionCard({ icon, accent, title, description, children }) {
  return (
    <article className={`action-card action-card--${accent}`}>
      <div className="action-card__icon" aria-hidden="true">
        {icon}
      </div>
      <h3 className="action-card__title">{title}</h3>
      <p className="action-card__description">{description}</p>
      <div className="action-card__actions">{children}</div>
    </article>
  )
}

// ---------- Página ----------

function HomePage() {
  const navigate = useNavigate()
  const { user, logout } = useSession()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  async function handleLogout() {
    setIsLoggingOut(true)
    await logout()
  }

  return (
    <div className="home-page">
      <header className="home-topbar">
        <span className="home-topbar__brand">FutBot</span>

        <div className="home-topbar__user">
          <span className="home-topbar__avatar" aria-hidden="true">
            {(user?.username ?? "?").charAt(0).toUpperCase()}
          </span>
          <span className="home-topbar__username">{user?.username ?? "Jugador"}</span>
          <Button variant="secondary" onClick={handleLogout} isLoading={isLoggingOut}>
            Cerrar sesión
          </Button>
        </div>
      </header>

      <main className="home-content">
        <section className="home-hero">
          <h1 className="home-hero__title">
            Hola, <span className="home-hero__name">{user?.username ?? "jugador"}</span>
          </h1>
          <p className="home-hero__subtitle">
            Armá tu equipo, programá sus comportamientos y salí a la cancha.
          </p>
        </section>

        <section className="home-section" aria-labelledby="play-title">
          <h2 id="play-title" className="home-section__title">
            Jugar
          </h2>
          <div className="home-grid home-grid--two">
            <ActionCard
              icon={<TrophyIcon />}
              accent="league"
              title="Ligas"
              description="Competí contra varios equipos en un torneo todos contra todos y sumá puntos en la tabla."
            >
              <Button onClick={() => navigate("/leagues/new")}>Crear liga</Button>
              <Button variant="secondary" onClick={() => navigate("/leagues")}>
                Unirse a una liga
              </Button>
            </ActionCard>

            <ActionCard
              icon={<BallIcon />}
              accent="friendly"
              title="Amistosos"
              description="Jugá un partido rápido contra otro equipo, sin afectar la tabla de ninguna liga."
            >
              <Button onClick={() => navigate("/friendlies/new")}>Crear amistoso</Button>
              <Button variant="secondary" onClick={() => navigate("/friendlies")}>
                Unirse a un amistoso
              </Button>
            </ActionCard>
          </div>
        </section>

        <section className="home-section" aria-labelledby="team-title">
          <h2 id="team-title" className="home-section__title">
            Mi equipo
          </h2>
          <div className="home-grid home-grid--two">
            <ActionCard
              icon={<PlayerIcon />}
              accent="player"
              title="Jugadores"
              description="Sumá jugadores a tu plantel y repartí sus atributos: potencia, agilidad, control, velocidad y fuerza."
            >
              <Button onClick={() => navigate("/players")}>Jugadores</Button>
            </ActionCard>

            <ActionCard
              icon={<CodeIcon />}
              accent="behavior"
              title="Comportamientos"
              description="Las estrategias que tus jugadores pueden usar en la cancha."
            >
              <Button onClick={() => navigate("/behaviors")}>Ver comportamientos</Button>
            </ActionCard>
          </div>
        </section>
      </main>
    </div>
  )
}

export default HomePage