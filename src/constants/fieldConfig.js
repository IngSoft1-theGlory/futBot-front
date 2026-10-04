// Dimensiones fijas de la cancha, en las MISMAS unidades que usa el motor del
// backend (src/engine/pitch.py). Gracias a eso, el viewBox del SVG de <Pitch>
// usa estas unidades y jugadores/pelota se ubican directo con x e y del
// TICK_UPDATE, sin convertir coordenadas.
//
// Si el backend cambia alguna medida, se cambia SOLO acá.
export const FIELD_CONFIG = Object.freeze({
  // Eje x: 0 = línea de fondo que defiende HOME, 105 = la que defiende AWAY (PITCH_LENGTH)
  length: 105,
  // Eje y: de 0 a 60, centro en 30 (PITCH_WIDTH)
  width: 60,
  // Ancho del arco, centrado en y = width / 2 (GOAL_WIDTH)
  goalWidth: 7.32,

  // --- Solo visuales (el backend no las usa) ---
  // Cuánto sobresale el arco detrás de la línea de fondo
  goalDepth: 2,
  // Radio del círculo central (medida FIFA)
  centerCircleRadius: 9.15,
  // Grosor de las líneas de cal
  lineWidth: 0.4,
  // Espacio alrededor de la cancha, para que se vean los arcos y la pelota si sale
  margin: 4,
  // Cantidad de franjas de césped
  grassStripes: 10,
})
