/**
 * Lectura del payload de un JWT (APIS_BACKEND.md).
 *
 * El token trae `{ id_usuario, id_rol, correo, id_docente, exp }` y dura 8 horas,
 * así que una sesión caduca mientras el docente trabaja. Leer `exp` permite
 * mandarlo al login antes de disparar una petición condenada al 401.
 *
 * ESTO NO ES SEGURIDAD. El payload va en base64: es legible y editable por
 * cualquiera. Sirve para decidir qué pinta la interfaz, nunca para conceder un
 * permiso — quien decide de verdad es el backend en cada petición, y la guarda
 * real de rutas sigue siendo `RoleRoute` contra lo que devuelve `GET /me`.
 *
 * Se decodifica a mano en lugar de instalar `jwt-decode`: son tres líneas y el
 * stack de §2 no admite dependencias nuevas sin justificarlas.
 */

/** Margen para no dar por válido un token que expira mientras viaja la petición. */
const MARGEN_SEGUNDOS = 30

/** Devuelve el payload del token, o null si no se puede leer. */
export function leerPayload(token) {
  try {
    const payload = String(token ?? '').split('.')[1]
    if (!payload) return null
    // base64url → base64, y relleno hasta múltiplo de 4.
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const relleno = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
    const json = decodeURIComponent(
      atob(relleno)
        .split('')
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join(''),
    )
    return JSON.parse(json)
  } catch {
    // Token del mock, malformado o recortado: no es un error, simplemente no se lee.
    return null
  }
}

/**
 * ¿El token ya caducó?
 *
 * Solo responde `true` cuando hay un `exp` legible y quedó atrás. Un token que
 * no se puede leer —como el del modo mock— NO se declara caducado: de eso se
 * encarga el 401 del servidor.
 */
export function tokenCaducado(token) {
  const exp = leerPayload(token)?.exp
  if (!Number.isFinite(exp)) return false
  return exp - MARGEN_SEGUNDOS <= Math.floor(Date.now() / 1000)
}

/** Momento de caducidad como Date, o null si el token no lo declara. */
export function caducaEn(token) {
  const exp = leerPayload(token)?.exp
  return Number.isFinite(exp) ? new Date(exp * 1000) : null
}
