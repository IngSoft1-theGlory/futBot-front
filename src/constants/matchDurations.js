// Duraciones permitidas para un partido (amistoso o de liga), en minutos.
// Tienen que coincidir con las que acepta el backend (ver contrato: match_duration).
export const MATCH_DURATIONS = [
  { minutes: 2, description: "Partido rápido" },
  { minutes: 5, description: "Partido completo" },
]