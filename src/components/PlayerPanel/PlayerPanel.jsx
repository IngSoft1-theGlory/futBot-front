import { useEffect, useState } from "react"
import { httpService } from "../../services/createhttpService"
import BehaviorSelector from "../BehaviorSelector/BehaviorSelector"
import SubstitutionSelector from "../SubstitutionSelector/SubstitutionSelector"
import "./PlayerPanel.css"

const ATTRIBUTES = [
  { key: "power", label: "Potencia" },
  { key: "agility", label: "Agilidad" },
  { key: "control", label: "Control" },
  { key: "speed", label: "Velocidad" },
  { key: "strength", label: "Fuerza" },
]

// En penales el back asigna arquero o pateador, así que no se puede cambiar el comportamiento
// canSubstitute: la pantalla decide si se puede planificar un cambio (jugador propio, sin pausa ni penales)
function PlayerPanel({
  player,
  onClose,
  matchId,
  canChangeBehavior = false,
  isPenalties = false,
  onBehaviorChanged,
  canSubstitute = false,
  teamId,
  substitutes = [],
  plannedSubstitution = null,
  onPlanned,
  onSubstituted,
}) {
  const [behavior, setBehavior] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    if (!player?.behavior_id) {
      setBehavior(null)
      setHasError(false)
      setIsLoading(false)
      return
    }

    let cancelled = false
    setIsLoading(true)
    setHasError(false)
    setBehavior(null)

    httpService
      .get(`/behaviors/${player.behavior_id}`)
      .then((data) => { if (!cancelled) setBehavior(data) })
      .catch(() => { if (!cancelled) setHasError(true) })
      .finally(() => { if (!cancelled) setIsLoading(false) })

    // Cleanup: si el jugador cambia a mitad del pedido, se ignora la respuesta vieja
    return () => { cancelled = true }
  }, [player?.behavior_id])

  if (!player) return null

  function renderBehavior() {
    if (!player.behavior_id) return <p>Sin información</p>
    if (isLoading) return <p>Cargando...</p>
    if (hasError) {
      return (
        <p className="player-panel__error" role="alert">
          Error al cargar el comportamiento
        </p>
      )
    }
    if (behavior) return <p className="player-panel__behavior-name">{behavior.name}</p>
    return null
  }

  return (
    <aside className="player-panel">
      <header className="player-panel__header">
        <h2 className="player-panel__title">#{player.number} {player.name}</h2>
        <button
          type="button"
          className="player-panel__close"
          onClick={onClose}
          aria-label="Cerrar panel"
        >
          ✕
        </button>
      </header>

      <ul className="player-panel__attributes">
        {ATTRIBUTES.map(({ key, label }) => (
          <li key={key} className="player-panel__attribute">
            <span className="player-panel__attribute-label">{label}</span>
            <span className="player-panel__attribute-value">{player.attributes[key]}</span>
          </li>
        ))}
      </ul>

      <section className="player-panel__behavior">
        <h3 className="player-panel__section-title">Comportamiento</h3>
        {renderBehavior()}
        {/* Solo para jugadores propios. El key reinicia el selector al elegir otro jugador */}
        {canChangeBehavior && isPenalties && (
          <p className="player-panel__notice" role="status">
            No se pueden hacer cambios durante los penales
          </p>
        )}
        {canChangeBehavior && !isPenalties && (
          <BehaviorSelector
            key={player.player_id}
            matchId={matchId}
            playerId={player.player_id}
            currentBehaviorId={player.behavior_id}
            onChanged={onBehaviorChanged}
          />
        )}
      </section>

      {canSubstitute && (
        <section className="player-panel__substitution">
          <h3 className="player-panel__section-title">Sustitución</h3>
          {/* El key reinicia el selector al elegir otro jugador */}
          <SubstitutionSelector
            key={player.player_id}
            matchId={matchId}
            teamId={teamId}
            player={player}
            substitutes={substitutes}
            plannedSubstitution={plannedSubstitution}
            onPlanned={onPlanned}
            onSubstituted={onSubstituted}
          />
        </section>
      )}
    </aside>
  )
}

export default PlayerPanel