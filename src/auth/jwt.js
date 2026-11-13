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

import { ahora, hayContinuidad } from '../lib/relojServidor'

/** Margen para no dar por válido un token que expira mientras viaja la petición. */
const MARGEN_SEGUNDOS = 30

/** Devuelve el payload del token, o null si no se puede leer. */
export function leerPayload(token) {
  try {
    const payload = String(token ?? '').split('.')[1]
    if (!payload) return null
    // base64url → base64, y relleno hasta múltiplo de 4.
    const base64 = payload.replaceAll('-', '+').replaceAll('_', '/')
    const relleno = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
    const json = decodeURIComponent(
      atob(relleno)
        .split('')
        .map((c) => `%${c.codePointAt(0).toString(16).padStart(2, '0')}`)
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
 *
 * D104 y D57 — SE MIDE CON LA HORA DEL SERVIDOR, NUNCA CON LA DEL EQUIPO.
 * Con `Date.now()`, un equipo adelantado daba por vencido el token que el
 * servidor acababa de emitir: el `AuthProvider` lo borraba en pleno login,
 * `GET /me` salía sin `Authorization` y el servidor contestaba "La sesión no
 * es válida" (D104); y al recargar se volvía al login (D57). Sin referencia
 * del servidor —al recargar, antes de la primera respuesta— no se decide
 * nada: lo decide el 401 de la primera petición.
 */
export function tokenCaducado(token) {
  const exp = leerPayload(token)?.exp
  if (!Number.isFinite(exp) || !hayContinuidad()) return false
  return exp - MARGEN_SEGUNDOS <= Math.floor(ahora().getTime() / 1000)
}

/** Momento de caducidad como Date, o null si el token no lo declara. */
export function caducaEn(token) {
  const exp = leerPayload(token)?.exp
  return Number.isFinite(exp) ? new Date(exp * 1000) : null
}

/**
 * `jti`: el identificador de la sesión en el servidor.
 *
 * Hace falta para la sincronización de actividades hechas sin conexión. El
 * problema que resuelve: si el docente abre una actividad, pierde la red y la
 * sesión caduca antes de recuperarla, al reconectar y volver a entrar ese
 * envío llegaría con la hora de una sesión que ya no es la actual. El backend
 * lo rechazaría, y aunque no lo hiciera, la actividad quedaría colgada de la
 * sesión equivocada y se perdería la trazabilidad que pide CU008.
 *
 * Por eso se guarda junto a cada pendiente: el backend validará contra ESA
 * sesión aunque ya esté cerrada.
 */
export function idSesionDe(token) {
  return leerPayload(token)?.jti ?? null
}

/**
 * La cuenta dueña del token, como texto; null si no se puede leer.
 *
 * D82 y D92 — EL BACKEND LA FIRMA EN `sub`, NO EN `id_usuario`.
 * `create_access_token` emite `{sub, jti, iat, exp}` (RFC 7519): `sub` es el
 * `id_usuario` en texto. Leer `payload.id_usuario` daba siempre `undefined`
 * con el backend real, y así:
 *   · D82 — al recargar sin conexión no se encontraba la copia del perfil
 *     (`perfilLocalDe(undefined)`) y la aplicación se quedaba en "No se pudo
 *     contactar con el servidor";
 *   · D92 — cada operación de la cola quedaba sin dueño (`usuario: null`) y se
 *     enviaba con el token de la siguiente cuenta que entraba en el navegador.
 * Las pruebas armaban tokens con `id_usuario` y no lo veían. Se acepta también
 * `id_usuario` por si el contrato lo agrega.
 */
export function idUsuarioDe(token) {
  const payload = leerPayload(token)
  const id = payload?.id_usuario ?? payload?.sub
  return id == null || id === '' ? null : String(id)
}
