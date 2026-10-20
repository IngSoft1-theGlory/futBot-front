import { httpService } from "./createhttpService"

// Comportamientos que el usuario puede usar: los predeterminados y los propios (GET /behaviors)
export async function fetchBehaviors() {
  const data = await httpService.get("/behaviors")
  return Array.isArray(data) ? data : []
}
