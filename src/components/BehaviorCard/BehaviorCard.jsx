import { BEHAVIOR_TYPE_LABELS } from "../../constants/behaviorTypes"
import "./BehaviorCard.css"

function BehaviorCard({ behavior, onSelect }) {
  // texto del tipo ("Jugador" o "DT"), si el back no manda un tipo conocido, queda undefined y no se muestra
  const typeLabel = BEHAVIOR_TYPE_LABELS[behavior.behavior_type]

  return (
    <button
      type="button"
      className="behavior-card"
      data-testid="behavior-card"
      onClick={() => onSelect(behavior.behavior_id)}
    >
      <span className="behavior-card__name">{behavior.name}</span>
      <span className="behavior-card__badges">
        {typeLabel && <span className="behavior-card__badge">{typeLabel}</span>}
        {behavior.is_default && <span className="behavior-card__badge">Por default</span>}
      </span>
      <span className="behavior-card__description" title={behavior.description}>
        {behavior.description}
      </span>
    </button>
  )
}

export default BehaviorCard