const TOKEN_KEY = "futbot_token"

//localStorage.getItem(clave) Lee el dato guardado bajo esa clave (o null si no existe)
export function getToken() {
    return localStorage.getItem(TOKEN_KEY) 
}

//localStorage.setItem(clave, valor) Guarda un dato bajo esa clave
export function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token)
}

//localStorage.removeItem(clave) Borra el dato guardado bajo esa clave
export function clearSession() {
    localStorage.removeItem(TOKEN_KEY)
}

/*
Función/¿Quién la usa?/¿Para qué?

getToken/createHttpService.js/leer el token para meterlo en el header Authorization de cada request

setToken/el ticket de login/guardar el token que devuelve el backend cuando el usuario inicia sesión

clearSession/el ticket de logout (o el manejo de un 401)/borrar el token cuando el usuario cierra sesión o cuando la sesión expiró
*/