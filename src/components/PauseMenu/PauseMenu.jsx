import { useState } from "react"
import Button from "../Button/Button"
import BehaviorSelector from "../BehaviorSelector/BehaviorSelector"
import { ApiError } from "../../services/createhttpService"
import { requestSubstitution } from "../../services/matches"
import { getSubstitutionErrorMessage } from "../../services/substitutionErrors"
import "./PauseMenu.css"

// Nombre que ve el usuario para cada tipo de pausa que manda el backend
const PAUSE_NAMES = {
  HALF_TIME: "Half-Time",
  COOLING_BREAK: "Cooling Break",
}

const SUCCESS_MESSAGE = "Listo: la sustitución ya se ve en la cancha."

function isSessionError(error) {
  return error instanceof ApiError && error.status === 401
}

// Desplegable para elegir un jugador de la lista recibida, se usa tres veces: quién sale, quién entra y a quién se le cambia el comportamiento
function PlayerSelect({ id, label, players, value, onChange, disabled = false }) {
  return (
    <div className="pause-menu__field">
      <label className="pause-menu__label" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className="pause-menu__select"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      >
        <option value="">Elegí un jugador</option>
        {players.map((player) => (
          <option key={player.player_id} value={player.player_id}>
            #{player.number} {player.name}
          </option>
        ))}
      </select>
    </div>
  )
}

/*
 Menu que se muestra mientras el partido está en pausa (Half-Time o Cooling Break)
 - La pantalla lo dibuja solo si hay pausa. Al empezar el partido desaparece y con el, lo que se estaba eligiendo
 - Cuenta regresiva: los segundos llegan por props (los descuenta useMatchLive)
 - Sustitucion: sale un titular y entra un suplente, recién cuando el back confirma se avisa con onSubstituted, para actualizar la cancha
 - Comportamiento: se reutiliza BehaviorSelector con el titular elegido
*/
function PauseMenu({ matchId, teamId, pause, players, substitutes, onSubstituted, onBehaviorChanged }) {
  // Los <select> guardan su valor como texto: "" significa que no se eligió nadie
  const [playerOutId, setPlayerOutId] = useState("")
  const [playerInId, setPlayerInId] = useState("")
  const [behaviorPlayerId, setBehaviorPlayerId] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")

  // match.players trae a los dos equipos: acá solo interesan los propios
  const ownPlayers = players.filter((player) => player.team_id === teamId)
  const behaviorPlayer = ownPlayers.find((player) => player.player_id === Number(behaviorPlayerId))

  const canSubstitute = playerOutId !== "" && playerInId !== "" && !isSubmitting

  async function handleSubstitution() {
    setIsSubmitting(true)
    setError("")
    setSuccessMessage("")

    try {
      await requestSubstitution(matchId, teamId, Number(playerOutId), Number(playerInId))
      onSubstituted(Number(playerOutId), Number(playerInId))
      setSuccessMessage(SUCCESS_MESSAGE)
      setPlayerOutId("")
      setPlayerInId("")
    } catch (err) {
      // Ante un error la cancha no se toca: los jugadores siguen como estaban
      if (!isSessionError(err)) setError(getSubstitutionErrorMessage(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="pause-menu" aria-label="Menú de pausa">
      <header className="pause-menu__header">
        <h2 className="pause-menu__title">{PAUSE_NAMES[pause.type] ?? pause.type}</h2>
        <p className="pause-menu__countdown" role="timer">
          Quedan {pause.remainingSeconds} s
        </p>
      </header>

      <div className="pause-menu__actions">
        <section className="pause-menu__action">
          <h3 className="pause-menu__action-title">Sustitución</h3>
          <PlayerSelect
            id="pause-menu-player-out"
            label="Sale"
            players={ownPlayers}
            value={playerOutId}
            onChange={setPlayerOutId}
            disabled={isSubmitting}
          />
          <PlayerSelect
            id="pause-menu-player-in"
            label="Entra"
            players={substitutes}
            value={playerInId}
            onChange={setPlayerInId}
            disabled={isSubmitting}
          />

          {successMessage && (
            <p className="pause-menu__success" role="status">
              {successMessage}
            </p>
          )}
          {error && (
            <p className="pause-menu__error" role="alert">
              {error}
            </p>
          )}

          <Button onClick={handleSubstitution} disabled={!canSubstitute} isLoading={isSubmitting}>
            Confirmar sustitución
          </Button>
        </section>

        <section className="pause-menu__action">
          <h3 className="pause-menu__action-title">Comportamiento</h3>
          <PlayerSelect
            id="pause-menu-behavior-player"
            label="Jugador"
            players={ownPlayers}
            value={behaviorPlayerId}
            onChange={setBehaviorPlayerId}
          />

          {/* El key reinicia el selector al elegir otro jugador */}
          {behaviorPlayer && (
            <BehaviorSelector
              key={behaviorPlayer.player_id}
              matchId={matchId}
              playerId={behaviorPlayer.player_id}
              currentBehaviorId={behaviorPlayer.behavior_id}
              onChanged={(behaviorId) => onBehaviorChanged(behaviorPlayer.player_id, behaviorId)}
            />
          )}
        </section>
      </div>
    </section>
  )
}

export default PauseMenu
