import "./MatchHeader.css"


const TICK_DURATION_SECONDS = 0.5

export function formatClock(currentTick, totalTicks) {
  // Limita el currentTick para que sea un numero finito
  const finiteTick = Number.isFinite(currentTick) ? currentTick : 0
  // Limitá currentTick al rango [0, totalTicks]
  const clampedTick = Math.max(0, Math.min(finiteTick, totalTicks))

  //  Convierte los ticks a segundos enteros
  const totalSeconds = Math.floor(TICK_DURATION_SECONDS * clampedTick)

  // Separamos los minutos y segundos
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  // Armamos el texto "mm:ss" para el reloj
  return String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0')
}


// penalties: goles de penales { home, away }, o null si no hubo penales
function MatchHeader({ homeTeam, awayTeam, score, currentTick, totalTicks, penalties = null, isPenalties = false }) {
  if (!homeTeam || !awayTeam || !score) {   //Si no hay equipos o score, no renderizamos nada
    return null
  }

  return (
    <header className="match-header">
      <div className="match-header__team">
        {homeTeam.logo && (
          <img src={homeTeam.logo} alt={`Logo de ${homeTeam.name}`} className="match-header__logo" />
        )}
        <span className="match-header__name">{homeTeam.name}</span>
      </div>

      <div className="match-header__center">
        <p className="match-header__score">
          {penalties && <span className="match-header__penalties">({penalties.home}) </span>}
          {score.home} - {score.away}
          {penalties && <span className="match-header__penalties"> ({penalties.away})</span>}
        </p>
        {isPenalties ? (
          <p className="match-header__clock match-header__clock--penalties">En Penales</p>
        ) : (
          <p className="match-header__clock">{formatClock(currentTick, totalTicks)}</p>
        )}
      </div>

      <div className="match-header__team">
        {awayTeam.logo && (
          <img src={awayTeam.logo} alt={`Logo de ${awayTeam.name}`} className="match-header__logo" />
        )}
        <span className="match-header__name">{awayTeam.name}</span>
      </div>
    </header>
  )
}


export default MatchHeader