// Formaciones y roles disponibles en la configuración táctica.
// x / y: posición del jugador en la mini cancha, en porcentaje (el arco propio queda abajo).

export const FORMATIONS = [
  {
    type: "2-1",
    label: "2-1",
    description: "Dos defensores y un delantero",
    roles: [
      { role: "DEF_LEFT", label: "Defensor izquierdo", short: "DEF IZQ", x: 27, y: 70 }, //son solo para dibujar la cancha de ejemplo
      { role: "DEF_RIGHT", label: "Defensor derecho", short: "DEF DER", x: 73, y: 70 }, //son solo para dibujar la cancha de ejemplo
      { role: "FORWARD", label: "Delantero", short: "DEL", x: 50, y: 28 }, //son solo para dibujar la cancha de ejemplo
    ],
  },
  {
    type: "1-2",
    label: "1-2",
    description: "Un defensor y dos delanteros",
    roles: [
      { role: "DEFENDER", label: "Defensor", short: "DEF", x: 50, y: 70 },
      { role: "FORWARD_LEFT", label: "Delantero izquierdo", short: "DEL IZQ", x: 27, y: 28 },
      { role: "FORWARD_RIGHT", label: "Delantero derecho", short: "DEL DER", x: 73, y: 28 },
    ],
  },
]

export const DEFAULT_FORMATION = "2-1"
export const SUBSTITUTES_COUNT = 3

export function getFormation(type) {
  return FORMATIONS.find((formation) => formation.type === type)
}