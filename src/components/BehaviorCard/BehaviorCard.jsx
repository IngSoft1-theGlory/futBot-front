import "./BehaviorCard.css"

function BehaviorCard({ behavior, onSelect }) {
  return (
    <button
      type="button"
      className="behavior-card"
      data-testid="behavior-card"
      onClick={() => onSelect(behavior.behavior_id)}
    >
      <span className="behavior-card__name">{behavior.name}</span>
      <span className="behavior-card__description" title={behavior.description}>
        {behavior.description}
      </span>
    </button>
  )
}

export default BehaviorCard