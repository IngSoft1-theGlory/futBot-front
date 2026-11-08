//para correr el test = npx vitest run

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// IMPORTANTE: el mock de './session' tiene que declararse ANTES de importar
// httpService.js, porque httpService.js hace `import { getToken } from './session'`
// y necesitamos que, cuando lo importe, ya reciba la versión falsa (mock).
vi.mock("./session", () => ({
  getToken: vi.fn(),
  expireSession: vi.fn(),
}))

import { getToken, expireSession } from "./session"
import { httpService, createHttpService, ApiError } from "./createhttpService"

// --- Helper ---
// fetch() real devuelve un objeto Response bastante complejo (headers, body
// como stream, etc). Acá construimos un objeto "falso" que sólo tiene lo que
// analizarRespuesta() realmente usa: status, ok y text().
function fakeResponse({ status = 200, ok = true, body = null } = {}) {
  return {
    status,
    ok,
    text: async () => (body === null ? "" : JSON.stringify(body)),
  }
}

/*
"describe" es una función que te da Vitest y sirve solo para agrupar y organizar tests relacionados — no hace ninguna verificación por sí sola, es como una carpeta o un "capítulo"
*/
describe("httpService", () => {
  beforeEach(() => {
    // Reemplazamos el fetch global por un mock controlable en cada test.
    global.fetch = vi.fn()
    // Por defecto simulamos que no hay usuario logueado.
    getToken.mockReturnValue(null)

    expireSession.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("Armado del request", () => {
    it("Hace un GET sin body y sin Content-Type", async () => {
      global.fetch.mockResolvedValue(fakeResponse({ status: 200, ok: true, body: { ok: true } }))

      await httpService.get("/players")

      expect(global.fetch).toHaveBeenCalledTimes(1)
      const [url, options] = global.fetch.mock.calls[0]
      expect(url).toContain("/players")
      expect(options.method).toBe('GET')
      expect(options.body).toBeUndefined()
      expect(options.headers["Content-Type"]).toBeUndefined()
    })

    it("Hace un POST con body serializado en JSON y Content-Type", async () => {
      global.fetch.mockResolvedValue(fakeResponse({ status: 201, ok: true, body: { player_id: 1 } }))

      const body = { name: "Lionel Messi", number: 10 }
      await httpService.post('/players', body)

      const [, options] = global.fetch.mock.calls[0]
      expect(options.method).toBe("POST")
      expect(options.headers["Content-Type"]).toBe("application/json")
      expect(options.body).toBe(JSON.stringify(body))
    })

    it("Agrega el header Authorization si hay un token guardado", async () => {
      getToken.mockReturnValue('mi-token-123')
      global.fetch.mockResolvedValue(fakeResponse({ status: 200, ok: true, body: {} }))

      await httpService.get("/teams/1")

      const [, options] = global.fetch.mock.calls[0]
      expect(options.headers['Authorization']).toBe('Bearer mi-token-123')
    })

    it("NO agrega el header Authorization si no hay token", async () => {
      getToken.mockReturnValue(null)
      global.fetch.mockResolvedValue(fakeResponse({ status: 200, ok: true, body: {} }))

      await httpService.get("/teams/1")

      const [, options] = global.fetch.mock.calls[0]
      expect(options.headers["Authorization"]).toBeUndefined()
    })
  })

  describe("Parseo de la respuesta (analizarRespuesta)", () => {
    it("Devuelve null cuando el status es 204", async () => {
      global.fetch.mockResolvedValue(fakeResponse({ status: 204, ok: true, body: null }))

      const resultado = await httpService.delete("/players/1")

      expect(resultado).toBeNull()
    })

    it("Devuelve el JSON parseado cuando la respuesta es exitosa", async () => {
      const payload = { player_id: 1, name: "Lionel Messi" }
      global.fetch.mockResolvedValue(fakeResponse({ status: 200, ok: true, body: payload }))

      const resultado = await httpService.get("/players/1")

      expect(resultado).toEqual(payload)
    })

    it("Lanza un ApiError con los datos del contrato cuando la respuesta no es OK", async () => {
      global.fetch.mockResolvedValue(
        fakeResponse({
          status: 409,
          ok: false,
          body: { error: "DUPLICATE_JERSEY_NUMBER", message: "Ese número ya está en uso" },
        })
      )

      await expect(httpService.post("/players", {})).rejects.toMatchObject({
        name: "ApiError",
        status: 409,
        error: "DUPLICATE_JERSEY_NUMBER",
        message: "Ese número ya está en uso",
      })
    })

    it("Usa valores por defecto si la respuesta de error no trae body", async () => {
      global.fetch.mockResolvedValue(fakeResponse({ status: 500, ok: false, body: null }))

      await expect(httpService.get("/players")).rejects.toMatchObject({
        status: 500,
        error: "UNKNOWN_ERROR",
        message: "Ocurrió un error inesperado",
      })
    })

    it("El error lanzado es instancia de ApiError y de Error", async () => {
      global.fetch.mockResolvedValue(
        fakeResponse({ status: 404, ok: false, body: { error: "NOT_FOUND", message: "No existe" } })
      )

      try {
        await httpService.get("/players/999")
        expect.unreachable("Se esperaba que httpService.get lance un ApiError")
      } catch (e) {
        expect(e).toBeInstanceOf(ApiError)
        expect(e).toBeInstanceOf(Error)
      }
    })
  })

  describe("Sesión vencida (401)", () => {
    it("Cierra la sesión ante un 401 UNAUTHORIZED", async () => {
      global.fetch.mockResolvedValue(
        fakeResponse({
          status: 401,
          ok: false,
          body: { error: "UNAUTHORIZED", message: "El token de sesión no es válido o ha expirado" },
        })
      )

      await expect(httpService.get("/players")).rejects.toMatchObject({ status: 401 })
      expect(expireSession).toHaveBeenCalledTimes(1)
    })

    it("NO cierra la sesión ante un 401 que no es de sesión", async () => {
      global.fetch.mockResolvedValue(
        fakeResponse({
          status: 401,
          ok: false,
          body: { error: "INVALID_CREDENTIALS", message: "Email o contraseña incorrecto" },
        })
      )

      await expect(httpService.post("/auth/login", {})).rejects.toMatchObject({ status: 401 })
      expect(expireSession).not.toHaveBeenCalled()
    })
  })

  describe("postWithStatus", () => {
    it("Debería devolver el código HTTP junto con los datos de la respuesta", async () => {
      global.fetch.mockResolvedValue(fakeResponse({ status: 202, ok: true, body: { match_id: 12 } }))

      const result = await httpService.postWithStatus("/matches/12/teams/1/substitutions", { player_in_id: 105 })

      expect(result).toEqual({ status: 202, data: { match_id: 12 } })
    })
  })

  describe("createHttpService", () => {
    it("Usa la baseUrl que se le pasa en vez de la default", async () => {
      global.fetch.mockResolvedValue(fakeResponse({ status: 200, ok: true, body: {} }))

      const service = createHttpService("https://otra-api.com")
      await service.get("/ping")

      expect(global.fetch).toHaveBeenCalledWith("https://otra-api.com/ping", expect.anything())
    })
  })
})