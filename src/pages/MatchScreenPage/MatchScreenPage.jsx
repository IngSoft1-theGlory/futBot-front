import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import { useMatchLive } from "../../hooks/useMatchLive"
import { useSession } from "../../hooks/useSession"
import MatchHeader from "../../components/MatchHeader/MatchHeader"
import Pitch from "../../components/Pitch/Pitch"
import MatchField from "../../components/MatchField/MatchField"
import PlayerPanel from "../../components/PlayerPanel/PlayerPanel"
import PauseMenu from "../../components/PauseMenu/PauseMenu"
import Button from "../../components/Button/Button"
import "./MatchScreenPage.css"

const CONNECTION_ERROR_MESSAGE = "Error al no poder iniciar el partido por falla en la conexión"

// Pantalla del partido en vivo (/matches/:matchId).
//
// Esta pantalla casi no tiene lógica: el hook useMatchLive consigue los datos
// y acá solo se los pasamos por props a los componentes visuales.
// Lo único que maneja acá es qué jugador está seleccionado.
function MatchPage() {
  const { matchId } = useParams()
  const { status, match, teams, reconnecting, retry, updatePlayerBehavior, substitutePlayer } = useMatchLive(matchId)
  const { user } = useSession()

  // Guardamos solo el ID del jugador seleccionado (no el jugador entero),
  // así el panel siempre muestra los datos más recientes.
  const [selectedPlayerId, setSelectedPlayerId] = useState(null)

  // Cargando
  if (status === "loading") {
    return (
      <main className="match-page match-page--message">
        <p>Cargando partido...</p>
      </main>
    )
  }

  // Error al conectar: mensaje + botón para reintentar
  if (status === "connection-error") {
    return (
      <main className="match-page match-page--message">
        <p role="alert">{CONNECTION_ERROR_MESSAGE}</p>
        <Button onClick={retry}>Reintentar</Button>
      </main>
    )
  }

  // El usuario no juega este partido
  if (status === "not-participant") {
    return (
      <main className="match-page match-page--message">
        <p role="alert">No participás en este partido.</p>
        <Link to="/">Volver al inicio</Link>
      </main>
    )
  }

  // El partido no existe
  if (status === "not-found") {
    return (
      <main className="match-page match-page--message">
        <p role="alert">El partido no existe.</p>
        <Link to="/">Volver al inicio</Link>
      </main>
    )
  }

  // Por seguridad: si por algún motivo todavía no hay datos, no dibujamos nada
  if (!match || !teams) return null

  // Buscamos el jugador seleccionado entre los del partido (null si no hay ninguno)
  const selectedPlayer = match.players.find((player) => player.player_id === selectedPlayerId) ?? null

  // phome y paway vienen en null si no hubo penales
  const penalties = match.score?.phome != null ? { home: match.score.phome, away: match.score.paway } : null
  const isPenalties = Boolean(match.isPenalties)

  return (
    <main className="match-page">
      {/* Aviso de corte: se muestra ARRIBA de la pantalla, sin borrar lo que ya se veía */}
      {reconnecting && (
        <p className="match-page__reconnecting" role="status">
          Reconectando…
        </p>
      )}

      {/* Menú de pausa: solo existe mientras dura la pausa. Mientras tanto, el marcador,
          el reloj y la cancha quedan congelados (ver useMatchLive) */}
      {match.pause && (
        <PauseMenu
          matchId={Number(matchId)}
          teamId={user?.team_id}
          pause={match.pause}
          players={match.players}
          substitutes={match.substitutes}
          onSubstituted={substitutePlayer}
          onBehaviorChanged={updatePlayerBehavior}
        />
      )}

      <MatchHeader
        homeTeam={teams.home}
        awayTeam={teams.away}
        score={match.score}
        currentTick={match.currentTick}
        totalTicks={match.totalTicks}
        penalties={penalties}
        isPenalties={isPenalties}
      />

      <div className="match-page__content">
        <Pitch isPenalties={isPenalties}>
          <MatchField
            players={match.players}
            ball={match.ball}
            homeTeamId={teams.home.id}
            selectedPlayerId={selectedPlayerId}
            onSelectPlayer={setSelectedPlayerId}
          />
        </Pitch>

        {/* El panel solo aparece cuando hay un jugador seleccionado */}
        {selectedPlayer && (
          <PlayerPanel
            player={selectedPlayer}
            onClose={() => setSelectedPlayerId(null)}
            matchId={Number(matchId)}
            canChangeBehavior={selectedPlayer.team_id === user?.team_id}
            isPenalties={isPenalties}
            onBehaviorChanged={(behaviorId) => updatePlayerBehavior(selectedPlayer.player_id, behaviorId)}
          />
        )}
      </div>
    </main>
  )
}

export default MatchPage
