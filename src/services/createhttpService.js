import { getToken, expireSession } from "./session"

// Códigos de 401 que indican sesión inválida o vencida.
// Otros 401 (INVALID_CREDENTIALS en login, PASSWORD_INCORRECT en ligas privadas) NO cierran la sesión.
const SESSION_ERROR_CODES = ["UNAUTHORIZED", "UNAUTHORIZED_ACCESS"]

/*

class Error {
  constructor(name, message) {
    this.name = nombre
    this.message = menssage
  }

  funciones() {
    return ...
  }
}

*/
export class ApiError extends Error {//extend quiere decir que el ApiError hereda todo de Error

    constructor(status, error, message){ 
      super(message)
      this.name = "ApiError"
      this.status = status   // código HTTP (400, 401, 404, 409, etc)
      this.error = error     // código del contrato (ej: "VOID_TEAM_NAME")
    }
}

function construirHeaders(tieneBody) {
    const headers = {}
  
    if (tieneBody) {
      headers["Content-Type"] = "application/json"
    }
  
    const token = getToken()
    if (token) {
      headers["Authorization"] = `Bearer ${token}`
    }
  
    return headers
}

async function analizarRespuesta(rta) {
    // 204 No Content (o cualquier respuesta sin body) -> no hay nada para parsear
    if (rta.status === 204) {
      return null
    }
  
    const text = await rta.text() //Esperá a que se termine de leer el contenido de rta, obtené ese contenido como texto y guardalo en una variable llamada text.
    const data = text ? JSON.parse(text) : null //SINTAXIX DE IF = condicion ? valorSiVerdadero : valorSiFalso ,Si text tiene un valor, convertí text usando JSON.parse(). Si no tiene un valor, guardá null
    /*

    ¿Qué hace JSON.parse()?

    Supongamos que text contiene esto:

    const text = "{"nombre":"Juan","edad":20}";

    Ojo: eso es un string.

    Para JavaScript, en este momento es simplemente texto:

    "{\"nombre\":\"Juan\",\"edad\":20}"

    Si hacemos:

    const data = JSON.parse(text);

    JavaScript transforma ese texto JSON en un objeto de JavaScript:

    {
        nombre: "Juan",
        edad: 20
    }

    Entonces después podés hacer:

    console.log(data.nombre);

    Y obtenés:

    Juan

    */
    if (!rta.ok) {
      const apiError = new ApiError(
        rta.status,
        data?.error ?? "UNKNOWN_ERROR",
        data?.message ?? "Ocurrió un error inesperado"
      )

      if (apiError.status === 401 && SESSION_ERROR_CODES.includes(apiError.error)) {
        expireSession()
      }

      throw apiError
    }
  
    return data
}
/*
Una función async no es solamente que esta funcion se ejecuta en segundo,sino devuelve una Promise y permite usar await dentro de ella para esperar operaciones asíncronas de una forma más fácil de leer.

Y await tampoco significa:

    "frená todo JavaScript".

Significa más bien:

    "Dentro de esta función, esperá este resultado antes de continuar."

*/

async function solicitar(baseUrl, method , path , body) {
    const tieneCuerpo = body !== undefined && body !== null
  
    const respuesta = await fetch(`${baseUrl}${path}`, { method,
                                                   headers: construirHeaders(tieneCuerpo),
                                                   body: tieneCuerpo ? JSON.stringify(body) : undefined,
    })
  
    return analizarRespuesta(respuesta)
}

export function createHttpService(baseUrl = import.meta.env.VITE_API_BASE_URL) {
    return {
      get: (path) => solicitar(baseUrl, "GET", path),
      post: (path, body) => solicitar(baseUrl, "POST", path, body),
      put: (path, body) => solicitar(baseUrl, "PUT", path, body),
      delete: (path) => solicitar(baseUrl, "DELETE", path),
    }
}

// Instancia lista para importar en cualquier lado sin repetir la baseUrl
export const httpService = createHttpService()

/*

Este archivo define el **servicio HTTP genérico** que usará el frontend de FutBot para hablar con la API REST (FastAPI). Es la capa que centraliza cómo se hacen los `fetch`, cómo se agregan headers, cómo se maneja la autenticación y cómo se traducen los errores del backend en errores de JavaScript. Después, el resto del frontend (por ejemplo un módulo `players.js` o `teams.js`) va a usar este servicio en vez de llamar `fetch` directamente.


1. ApiError

export class ApiError extends Error {
  constructor(status, error, message){ 
    super(message)
    this.name = "ApiError"
    this.status = status
    this.error = error
  }
}

Es una clase de error personalizada que **hereda de `Error`** (la clase nativa de JS). Al heredar, obtiene gratis cosas como `.message`, `.stack`, y el comportamiento de `throw`/`try-catch`.

`super(message)` llama al constructor de `Error`, que setea `this.message`.
Además guarda dos datos propios que la API de FutBot devuelve en sus respuestas de error (según el contrato): `status` (el código HTTP, ej. 400, 404, 409) y `error` (el código textual del contrato, ej. `"VOID_TEAM_NAME"`, `"DUPLICATE_JERSEY_NUMBER"`).

La idea: en vez de manejar errores genéricos, en el resto de la app se puede hacer `catch (e) { if (e instanceof ApiError && e.error === "DUPLICATE_JERSEY_NUMBER") {...} }` y reaccionar según el código exacto que definió el contrato.


2. construirHeaders(tieneBody)

function construirHeaders(tieneBody) {
  const headers = {}
  if (tieneBody) headers["Content-Type"] = "application/json"
  const token = getToken()
  if (token) headers["Authorization"] = `Bearer ${token}`
  return headers
}

Arma el objeto de headers para cada request:

Si la petición **lleva body** (por ejemplo un POST con datos), agrega `Content-Type: application/json` para avisarle al backend que el body viene en formato JSON.
Busca el token de sesión guardado (con `getToken()`, importado desde `./session`) y, si existe, agrega el header `Authorization: Bearer <token>`. Esto es lo que le permite al backend identificar al usuario logueado (coincide con lo que pide el contrato API: `Authorization: Bearer <token>` en endpoints como logout).
Si no hay token (usuario no logueado, o pidiendo `login`/`register`), simplemente no se agrega ese header.


3. analizarRespuesta(rta)

Esta función toma la respuesta cruda del `fetch` y la convierte en algo utilizable, o lanza un error.

async function analizarRespuesta(rta) {
  if (rta.status === 204) {
    return null
  }
  ...
}

Si el status es **204 No Content** (el contrato lo usa por ejemplo al eliminar un jugador o una liga), no hay body que leer, así que devuelve `null` directamente.

  const text = await rta.text()
  const data = text ? JSON.parse(text) : null

Lee el cuerpo de la respuesta como texto plano (`rta.text()` es asíncrono, por eso el `await`).
Si ese texto no está vacío, lo parsea como JSON (`JSON.parse`) para convertirlo de string a objeto JS real. Si está vacío, `data` queda en `null`. Esto protege contra respuestas sin body que no sean 204 (raro, pero seguro).

  if (!rta.ok) {
    throw new ApiError(
      rta.status,
      data?.error ?? "UNKNOWN_ERROR",
      data?.message ?? "Ocurrió un error inesperado."
    )
  }
  return data


`rta.ok` es `true` cuando el status HTTP está en el rango 200-299. Si es `false` (400, 401, 404, 409, etc.), significa que el backend devolvió un error.
En ese caso, lanza (`throw`) un `ApiError`, usando los campos `error` y `message` que vienen en el body del JSON de error del contrato (ej. `{"error": "DUPLICATE_JERSEY_NUMBER", "message": "..."}`) . El operador `?? ` ("nullish coalescing") pone un valor por defecto si `data` es `null` o si esos campos no vienen.
Si la respuesta fue exitosa, simplemente devuelve `data` (el objeto ya parseado) para que quien llamó lo use.


4. solicitar(baseUrl, method, path, body)

Es la función central que arma y dispara el `fetch`:

async function solicitar(baseUrl, method, path, body) {
  const tieneCuerpo = body !== undefined && body !== null

  const rta = await fetch(`${baseUrl}${path}`, {
    method,
    headers: construirHeaders(tieneCuerpo),
    body: tieneCuerpo ? JSON.stringify(body) : undefined,
  })

  return analizarRespuesta(rta)
}


Concatena `baseUrl` (por ejemplo `https://futbot/api/v1`) con `path` (por ejemplo `/players`) para formar la URL completa.
Decide si hay body válido (`tieneCuerpo`), y si lo hay, lo convierte a JSON con `JSON.stringify` (el paso inverso de `JSON.parse`: de objeto JS a string).
Usa `construirHeaders` para setear los headers correctos según si hay body y si hay token.
Espera la respuesta del `fetch`, y se la pasa a `analizarRespuesta` para que la valide/parsee/lance error si corresponde.
Al ser `async`, devuelve una `Promise`, que quien la llame puede esperar con `await` o resolver con `.then()`.


5. createHttpService y httpService

export function createHttpService(baseUrl = import.meta.env.VITE_API_BASE_URL) {
  return {
    get: (path) => solicitar(baseUrl, "GET", path),
    post: (path, body) => solicitar(baseUrl, "POST", path, body),
    put: (path, body) => solicitar(baseUrl, "PUT", path, body),
    delete: (path) => solicitar(baseUrl, "DELETE", path),
  }
}

export const httpService = createHttpService()


`createHttpService` es una **factory function**: devuelve un objeto con cuatro métodos (`get`, `post`, `put`, `delete`), cada uno una versión "atajo" de `solicitar` con el método HTTP ya fijado.
El parámetro `baseUrl` tiene un valor por defecto: `import.meta.env.VITE_API_BASE_URL`, una variable de entorno de Vite (típicamente definida en un `.env`, algo como `VITE_API_BASE_URL=http://localhost:8000/api/v1`). Esto permite apuntar a distinto backend según el ambiente (dev, producción) sin tocar código.
Al final se exporta `httpService`, una instancia ya creada con la `baseUrl` por defecto, lista para importar donde se necesite sin tener que llamar `createHttpService()` de nuevo. (Pero como `createHttpService` también está exportada, se podría crear otra instancia apuntando a otra URL si hiciera falta, por ejemplo en tests.)

Ejemplo de uso completo (para que quede claro el flujo)

import { httpService, ApiError } from "./createhttpService"

try {
  const jugador = await httpService.post("/players", {
    name: "Lionel Messi",
    number: 10,
    power: 50, agility: 50, control: 50, speed: 50, strength: 100
  })
  console.log(jugador) // { player_id: 1, name: "Lionel Messi", ... }
} catch (e) {
  if (e instanceof ApiError && e.error === "INVALID_PACSS_TOTAL") {
    // mostrar mensaje específico al usuario
  }
}


Acá `httpService.post` termina llamando a `solicitar(baseUrl, "POST", "/players", body)`, que arma el request con headers (incluyendo el token si hay sesión), lo manda, y `analizarRespuesta` se encarga de devolver el JSON parseado o lanzar un `ApiError` con el código y mensaje que vino del backend.

En resumen: este módulo es un wrapper sobre `fetch` que (1) agrega automáticamente el token de autenticación y el `Content-Type`, (2) serializa/deserializa JSON, (3) distingue respuestas vacías (204), y (4) convierte cualquier respuesta HTTP no exitosa en una excepción tipada (`ApiError`) con el código de error del contrato, para que el resto de la app pueda reaccionar a errores específicos sin tener que repetir lógica de parsing en cada llamada.

*/