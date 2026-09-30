import { httpService } from "./createhttpService"

// Estado que usa el backend para marcar un amistoso como disponible para unirse.
export const FRIENDLY_STATUS_PENDING = "PENDING"

export const FRIENDLY_PAGE_DEFAULT = 1 //necesito tenerla guardada asi para usarla en usefriendlyMatches
export const FRIENDLY_LIMIT_DEFAULT = 20

/*
httpService.get sólo recibe un path (string), no soporta un objeto de query
params, así que acá armo el querystring a mano con URLSearchParams antes
de pegarle al endpoint.
*/

// buildQueryString = construirQueryString
function buildQueryString({ page, limit, status }) {
  const params = new URLSearchParams()
  params.set("page", page)
  params.set("limit", limit)
  if (status) {
    params.set("status", status)
  }
  return params.toString()
}
/*
Nota importante = URLSearchParams es una clase que ya viene incluida en el navegador por eso no la escribimos y no hay que importarla, sirve específicamente para armar el pedazo de la URL

Un ejemplo de URL con query params:

/friendly?page=1&limit=20&status=PENDING (todo lo que esta despues del ? es un query params)
*/

// Traduce un elemento crudo de `matches` (tal como lo manda el backend) a la
// forma que va a consumir la UI, quedándonos sólo con lo que pide el contrato.
// friendlymapping = mapearAmistoso
function friendlyMapping(match) {
  return {
    matchId: match.match_id,
    teamHostId: match.team_host_id,
    teamAwayId: match.team_away_id,
    status: match.status,
    matchDuration: match.match_duration,
  }
}

/*
Trae la lista de amistosos disponibles.

page/limit: paginación (por defecto 1 y 20, como pide el contrato).
status: por defecto PENDING (amistosos disponibles para unirse). Se puede
sobreescribir si en el futuro se necesita consultar otros estados.

Devuelve { matches, page, limit, total } manteniendo el orden que ya viene
del backend (no se reordena en el frontend).
*/

//fetchFriendlyMatches se encarga de pedirle al backend la lista de amistosos disponibles y devolverlos en un formato cómodo para el frontend
export async function fetchFriendlyMatches({
  page = FRIENDLY_PAGE_DEFAULT,
  limit = FRIENDLY_LIMIT_DEFAULT,
  status = FRIENDLY_STATUS_PENDING,
} = {}) {
  const query = buildQueryString({ page, limit, status })
  const data = await httpService.get(`/friendly?${query}`)

  const matches = Array.isArray(data?.matches) ? data.matches.map(friendlyMapping) : []

  return {
    matches,
    page: data?.page ?? page,
    limit: data?.limit ?? limit,
    total: data?.total ?? matches.length,
  }
}
