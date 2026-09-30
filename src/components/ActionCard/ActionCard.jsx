import "./ActionCard.css";

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

export default ActionCard;