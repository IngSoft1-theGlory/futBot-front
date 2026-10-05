import "./MatchField.css"
import { FIELD_CONFIG } from "../../constants/fieldConfig"

// radios en unidades del juego (el viewBox de <Pitch> usa las mismas unidades)
const PLAYER_RADIUS = 1.6
const BALL_RADIUS = 0.8

// deja un valor dentro de [min, max], asi nada se dibuja fuera de la cancha
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}
/*
 devuelve la posicion limitada a la cancha, o null si los datos no son validos (asi un dato roto no rompe el render de toda la pantalla)
*/
function toPitchPosition(position) {
  if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) {
    return null
  }
  return {
    x: clamp(position.x, 0, FIELD_CONFIG.length),
    y: clamp(position.y, 0, FIELD_CONFIG.width),
  }
}
/*
  mueve el <g> a (x, y) con CSS transform,como la posicion va en `style`, al cambiar el valor el navegador anima solo el desplazamiento (ver .css) sin remontar el elemento: la estructura de la cancha no se toca
*/
function placeAt({ x, y }) {
  return { transform: `translate(${x}px, ${y}px)` }
}

// jugador: circulo con su numero, clickeable con mouse y teclado
function Player({ player, isHome, isSelected, onSelect }) {
  const position = toPitchPosition(player.position)
  if (!position) return null

  const teamClass = isHome ? "pitch-player--home" : "pitch-player--away"
  const selectedClass = isSelected ? " pitch-player--selected" : ""

  function handleKeyDown(event) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      onSelect?.(player.player_id)
    }
  }

  return (
    <g
      className={`pitch-player ${teamClass}${selectedClass}`}
      style={placeAt(position)}
      role="button"
      tabIndex={0}
      aria-label={`Jugador ${player.number}`}
      aria-pressed={isSelected}
      data-testid={`pitch-player-${player.player_id}`}
      onClick={() => onSelect?.(player.player_id)}
      onKeyDown={handleKeyDown}
    >
      <circle className="pitch-player__body" r={PLAYER_RADIUS} />
      <text className="pitch-player__number" textAnchor="middle" dominantBaseline="central">
        {player.number}
      </text>
    </g>
  )
}
/*
 jugadores de ambos equipos y pelota, para dibujar dentro de <Pitch>:

   <Pitch>
     <MatchField players={...} ball={...} homeTeamId={...} onSelectPlayer={...} />
   </Pitch>

 es solo visual: no pide datos ni abre sockets, la pantalla del partido le pasa
 las posiciones ya actualizadas por props
   players:          [{ player_id, team_id, number, position: { x, y } }]
   ball:             { x, y }
   homeTeamId:       team_id del equipo local (el resto se considera visitante)
   selectedPlayerId: player_id marcado como seleccionado (opcional)
   onSelectPlayer:   (player_id) => void, se llama al hacer clic (opcional)
*/
function MatchField({ players = [], ball, homeTeamId, selectedPlayerId, onSelectPlayer }) {
  const ballPosition = toPitchPosition(ball)

  return (
    <g data-testid="match-field">
      {players.map((player) => (
        <Player
          key={player.player_id}
          player={player}
          isHome={player.team_id === homeTeamId}
          isSelected={player.player_id === selectedPlayerId}
          onSelect={onSelectPlayer}
        />
      ))}

      {/* la pelota va al final para quedar dibujada por encima de los jugadores */}
      {ballPosition && (
        <g className="pitch-ball" style={placeAt(ballPosition)} data-testid="pitch-ball">
          <circle r={BALL_RADIUS} />
        </g>
      )}
    </g>
  )
}

export default MatchField
