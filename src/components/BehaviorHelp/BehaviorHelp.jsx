import "./BehaviorHelp.css"

// Contenido fijo de la ayuda. Si cambia la API del back, hay que actualizarlo acá.
const API_METHODS = [
  { code: "api.get_game_state()", text: "devuelve el estado del juego (ver abajo)" },
  { code: "api.get_reach_distance()", text: "distancia máxima a la que podés tocar la pelota" },
  { code: "api.idle()", text: "quedarte quieto" },
  { code: "api.run_to(punto, velocidad)", text: "correr hacia un Point2D; la velocidad va de 0.0 a 1.0" },
  { code: "api.kick_ball(direccion, potencia)", text: "patear hacia un Vector2D (no puede ser el vector cero); la potencia va de 0.0 a 1.0" },
]

const COACH_API_METHODS = [
  { code: "api.get_current_tick()", text: "devuelve el número del tick actual del partido" },
  { code: "api.get_pause_type()", text: 'devuelve "COOLING_BREAK", "HALF_TIME" o None si no hay pausa' },
  { code: "api.get_starters()", text: "devuelve los IDs de tus titulares, en orden de alineación" },
  { code: "api.get_substitutes()", text: "devuelve los IDs de tus suplentes, en orden de alineación" },
  { code: "api.change_behavior(player_id, behavior_id)", text: "cambia el comportamiento de un titular de tu equipo" },
  { code: "api.substitute(player_out_id, player_in_id)", text: "reemplaza un titular por un suplente durante una pausa" },
]

const GAME_STATE = [
  { code: "gs.ball_position", text: "Point2D con la posición de la pelota" },
  { code: "gs.ball_velocity", text: "Vector2D con la velocidad de la pelota" },
  { code: "gs.my_position", text: "Point2D con tu posición" },
  { code: "gs.teammates", text: "lista de Point2D con la posición de tus compañeros" },
  { code: "gs.opponents", text: "lista de Point2D con la posición de los rivales" },
  { code: "gs.team_goal", text: "Point2D con el centro de tu arco" },
  { code: "gs.opponent_goal", text: "Point2D con el centro del arco rival" },
]

const GEOMETRY = [
  { code: "Point2D(x, y)", text: "un punto; tiene .x y .y" },
  { code: "punto.distance_to(otro)", text: "distancia a otro punto (un número)" },
  { code: "punto.direction_to(otro)", text: "Vector2D de largo 1 que apunta hacia el otro punto" },
  { code: "Vector2D(x, y)", text: "una dirección o velocidad; tiene .x y .y" },
  { code: "vector.magnitude()", text: "largo del vector (un número)" },
  { code: "vector.normalize()", text: "mismo vector con largo 1" },
]

// Una lista con título; la usan las secciones de arriba
function HelpList({ title, items }) {
  return (
    <>
      <h3 className="behavior-help__title">{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item.code}>
            <code>{item.code}</code>: {item.text}
          </li>
        ))}
      </ul>
    </>
  )
}

function BehaviorHelp({ behaviorType = "PLAYER" }) {
  const isCoachBehavior = behaviorType === "COACH"

  return (
    <details className="behavior-help">
      <summary>Ayuda: ¿qué puedo usar en el código?</summary>

      {isCoachBehavior ? (
        <>
          <HelpList title="Métodos de api del DT" items={COACH_API_METHODS} />
          <p>
            El DT puede cambiar el comportamiento de sus titulares durante el partido;
            el id del comportamiento debe ser de tipo jugador. Los cambios de jugadores
            se hacen durante las pausas. Si el código DT falla durante el partido, 
            el partido continúa igual y su comportamiento no se ejecuta.
            Cuando se elige un DT, su comportamiento aplicará en el próximo partido.
          </p>
        </>
      ) : (
        <>
          <HelpList title="Métodos de api" items={API_METHODS} />
          <HelpList title="Estado del juego (gs = api.get_game_state())" items={GAME_STATE} />
          <HelpList title="Puntos y vectores" items={GEOMETRY} />
          <h3 className="behavior-help__title">La cancha</h3>
          <p>Mide 105 por 60 metros: x va de 0 a 105 e y va de 0 a 60.</p>
        </>
      )}

      <h3 className="behavior-help__title">Funciones disponibles</h3>
      <p>
        <code>abs</code>, <code>min</code>, <code>max</code>, <code>len</code>,{" "}
        <code>round</code>, <code>float</code>, <code>int</code>, <code>sum</code>,{" "}
        <code>bool</code>, <code>str</code>, <code>list</code>, <code>tuple</code>,{" "}
        <code>dict</code>, <code>any</code>, <code>all</code>, <code>sorted</code> y el
        módulo <code>math</code>. Cualquier otra función no está disponible.
      </p>
    </details>
  )
}

export default BehaviorHelp