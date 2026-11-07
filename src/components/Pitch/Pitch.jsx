import "./Pitch.css"
import { FIELD_CONFIG } from "../../constants/fieldConfig"

// En penales se muestra la mitad del local, que es donde se patean. Se mantiene la
// proporción de la cancha entera para que el SVG no cambie de tamaño
function getViewBox(isPenalties) {
  const { length, width, margin } = FIELD_CONFIG
  const fullWidth = length + 2 * margin
  const fullHeight = width + 2 * margin

  if (!isPenalties) return `${-margin} ${-margin} ${fullWidth} ${fullHeight}`

  const viewWidth = length / 2 + 2 * margin
  const viewHeight = viewWidth * (fullHeight / fullWidth)
  const top = width / 2 - viewHeight / 2
  return `${-margin} ${top} ${viewWidth} ${viewHeight}`
}

// Cancha de fútbol en SVG. El viewBox está en unidades del juego, así que los
// children (jugadores, pelota) se dibujan directamente con las coordenadas
// x e y que manda el backend, y la cancha escala sola al tamaño del contenedor.
function Pitch({ children, isPenalties = false }) {
  const {
    length,
    width,
    goalWidth,
    goalDepth,
    centerCircleRadius,
    lineWidth,
    margin,
    grassStripes,
  } = FIELD_CONFIG

  const centerX = length / 2
  const centerY = width / 2
  const goalTop = centerY - goalWidth / 2
  const stripeLength = length / grassStripes
  const viewBox = getViewBox(isPenalties)

  return (
    <svg
      className="pitch-field"
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Cancha de fútbol"
    >
      <rect
        className="pitch-field__surround"
        x={-margin}
        y={-margin}
        width={length + 2 * margin}
        height={width + 2 * margin}
      />

      <g data-testid="pitch-grass">
        {Array.from({ length: grassStripes }, (_, index) => (
          <rect
            key={index}
            className={`pitch-field__stripe pitch-field__stripe--${index % 2 === 0 ? "light" : "dark"}`}
            x={index * stripeLength}
            y={0}
            width={stripeLength}
            height={width}
          />
        ))}
      </g>

      <g className="pitch-field__lines" strokeWidth={lineWidth}>
        <rect data-testid="pitch-boundary" x={0} y={0} width={length} height={width} />
        <line data-testid="pitch-halfway-line" x1={centerX} y1={0} x2={centerX} y2={width} />
        <circle data-testid="pitch-center-circle" cx={centerX} cy={centerY} r={centerCircleRadius} />
      </g>
      <circle
        data-testid="pitch-center-spot"
        className="pitch-field__spot"
        cx={centerX}
        cy={centerY}
        r={lineWidth}
      />

      <g className="pitch-field__goals" strokeWidth={lineWidth}>
        <rect
          data-testid="pitch-goal-home"
          x={-goalDepth}
          y={goalTop}
          width={goalDepth}
          height={goalWidth}
        />
        <rect
          data-testid="pitch-goal-away"
          x={length}
          y={goalTop}
          width={goalDepth}
          height={goalWidth}
        />
      </g>

      <g data-testid="pitch-content">{children}</g>
    </svg>
  )
}

export default Pitch
