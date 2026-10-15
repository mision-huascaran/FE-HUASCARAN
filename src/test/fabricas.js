// Datos de prueba compartidos: usuarios por rol, tokens y errores HTTP.
//
// Viven aquí y no en cada archivo de pruebas para no repetir las mismas
// fábricas en todos (SonarQube mide la duplicación) y para que, si cambia la
// forma de un perfil o de un error del backend, se cambie en un solo sitio.
import { ANIO_LECTIVO, USUARIOS } from '../api/mock/db'
import { normalizarPerfil } from '../api/resources/auth'
import { ROLES } from '../auth/roles'

/** Una cuenta real del mock por rol, para que los handlers la reconozcan. */
const CUENTA_POR_ROL = {
  [ROLES.DOCENTE]: USUARIOS.find((u) => u.id_rol === ROLES.DOCENTE),
  [ROLES.SUPERVISOR]: USUARIOS.find((u) => u.id_rol === ROLES.SUPERVISOR),
  [ROLES.DIRECTIVO]: USUARIOS.find((u) => u.id_rol === ROLES.DIRECTIVO),
}

export const ROLES_DE_PRUEBA = [
  { idRol: ROLES.DOCENTE, nombre: 'Docente' },
  { idRol: ROLES.SUPERVISOR, nombre: 'Supervisor' },
  { idRol: ROLES.DIRECTIVO, nombre: 'Directivo' },
]

/** La cuenta del mock (con su correo) para un rol. */
export const cuentaDe = (idRol) => CUENTA_POR_ROL[idRol]

/** Perfil tal como lo deja `GET /me` normalizado. */
export const usuarioDe = (idRol, extra = {}) => normalizarPerfil({ ...CUENTA_POR_ROL[idRol], ...extra })

/** Token con la forma que entiende el mock: `mock.<id_usuario>.<año>`. */
export const tokenMockDe = (idRol) => `mock.${CUENTA_POR_ROL[idRol].id_usuario}.${ANIO_LECTIVO}`

const base64url = (objeto) =>
  btoa(JSON.stringify(objeto)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')

/**
 * JWT con la forma del backend. La firma es de relleno: el cliente nunca la
 * verifica (eso es trabajo del servidor), solo lee `exp` y `jti`.
 */
export function jwtDePrueba(payload = {}) {
  return `${base64url({ alg: 'HS256', typ: 'JWT' })}.${base64url(payload)}.firma`
}

/** `exp` en segundos a `minutos` de ahora (negativo = ya pasó). */
export const expEn = (minutos) => Math.floor(Date.now() / 1000) + Math.round(minutos * 60)

/** Error con la forma de axios y del mock: `{ response: { status, data } }`. */
export function errorHttp(status, data = {}, url = '/recurso') {
  const error = new Error(`HTTP ${status}`)
  error.isAxiosError = true
  error.config = { url }
  error.response = { status, data }
  return error
}

/** Fallo de red: axios no trae `response`. */
export function errorDeRed() {
  const error = new Error('Network Error')
  error.isAxiosError = true
  error.config = { url: '/recurso' }
  return error
}

/** Simula estar con o sin red (`navigator.onLine`). Restaurar con `definirConexion(true)`. */
export function definirConexion(enLinea) {
  Object.defineProperty(window.navigator, 'onLine', { value: enLinea, configurable: true })
}
