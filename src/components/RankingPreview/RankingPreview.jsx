import { useEffect, useState } from "react"
import Button from "../Button/Button"
import { fetchGlobalRanking } from "../../services/rankings"
import "./RankingPreview.css"

const PREVIEW_LIMIT = 3

/*
 Tarjeta de la Home con los tres primeros del ranking global y el acceso al ranking completo.
 Si el ranking no se puede cargar, igual se muestra el botón.
*/
function RankingPreview({ icon, teamId, onSeeAll }) {
  const [topClubs, setTopClubs] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    let isActive = true // evita actualizar el estado si se sale de la Home antes de la respuesta

    fetchGlobalRanking({ page: 1, limit: PREVIEW_LIMIT })
      .then((data) => {
        if (isActive) setTopClubs(data.ranking.slice(0, PREVIEW_LIMIT))
      })
      .catch(() => {
        if (isActive) setHasError(true)
      })
      .finally(() => {
        if (isActive) setIsLoading(false)
      })

    return () => {
      isActive = false
    }
  }, [])

  return (
    <article className="ranking-preview">
      <div className="ranking-preview__head">
        <div className="ranking-preview__icon" aria-hidden="true">
          {icon}
        </div>
        <div>
          <h3 className="ranking-preview__title">Ranking global</h3>
          <p className="ranking-preview__description">Los clubes ordenados por puntos y diferencia de goles.</p>
        </div>
      </div>

      {isLoading && <p className="ranking-preview__message">Cargando ranking...</p>}
      {hasError && <p className="ranking-preview__message">No se pudo cargar el ranking.</p>}
      {!isLoading && !hasError && topClubs.length === 0 && (
        <p className="ranking-preview__message">Todavía no hay clubes en el ranking.</p>
      )}

      {topClubs.length > 0 && (
        <ol className="ranking-preview__list" aria-label="Primeros del ranking">
          {topClubs.map((club) => (
            <li
              key={club.teamId}
              className={`ranking-preview__club${club.teamId === teamId ? " ranking-preview__club--own" : ""}`}
            >
              <span className="ranking-preview__position">{club.position}</span>
              <span className="ranking-preview__name">{club.teamName}</span>
              <span className="ranking-preview__points">{club.points} pts</span>
            </li>
          ))}
        </ol>
      )}

      <div>
        <Button onClick={onSeeAll}>Ver ranking completo</Button>
      </div>
    </article>
  )
}

export default RankingPreview
