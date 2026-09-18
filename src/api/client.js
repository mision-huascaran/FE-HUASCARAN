// Instancia única de axios y conmutador del modo mock (§3).
//
// El resto de la aplicación nunca sabe si los datos vienen de la API o del mock:
// solo los archivos de `resources/` usan `resolver()`.
import axios from 'axios'
import useSessionStore, { obtenerToken } from '../store/sessionStore'

export const usarMock = String(import.meta.env.VITE_USE_MOCK ?? 'true') === 'true'

/**
 * Autenticación contra la API real aunque el resto siga resolviéndose en mock.
 *
 * Es el modo de integración de hoy: el backend ya tiene `POST /login`,
 * `GET /me` y `POST /logout` funcionando, pero ningún endpoint de negocio
 * (APIS_BACKEND.md). Sin esta distinción habría que elegir entre una sesión de
 * mentira o una aplicación que no pasa del inicio de sesión.
 *
 * Cuando el backend publique el negocio, esto sobra: basta `VITE_USE_MOCK=false`.
 */
export const authContraApiReal =
  !usarMock || String(import.meta.env.VITE_AUTH_REAL ?? 'false') === 'true'

/**
 * Dirección base de la API.
 *
 * En desarrollo es `/api`, una ruta relativa que atiende el proxy de
 * `vite.config.js`: el backend no tiene CORS y una llamada directa a
 * `127.0.0.1:8000` desde el navegador queda bloqueada. En producción la API
 * vive bajo el mismo dominio con el mismo prefijo (§11), así que el valor no
 * cambia de forma.
 */
export const baseURL = import.meta.env.VITE_API_BASE_URL ?? '/api'

// RNF-003: en producción la API solo se consume por TLS.
if (import.meta.env.PROD && !usarMock && !baseURL.startsWith('https://')) {
  console.warn('[SICEDU] VITE_API_BASE_URL debe usar https en producción (RNF-003).')
}

/**
 * Una sola línea en consola, solo en desarrollo, para saber de un vistazo de
 * dónde salen los datos. Es la pregunta que uno se hace al pulsar "Ingresar" y
 * no ver nada: la aplicación no escribe en consola en ningún otro punto.
 *
 * RNF-003 / §12: aquí solo se informa la CONFIGURACIÓN. Ningún dato de alumno,
 * ningún token y ninguna credencial se registran nunca en la consola.
 */
if (import.meta.env.DEV) {
  const origen = usarMock
    ? authContraApiReal
      ? 'sesión contra la API real · negocio desde el mock'
      : 'todo desde el mock (sin backend)'
    : 'todo contra la API real'
  // Excepción única y deliberada a `no-console`: solo en desarrollo y solo con
  // configuración. La regla sigue activa para el resto del código, que es lo que
  // protege el §12 ("no hay console.log con datos de alumnos").
  // eslint-disable-next-line no-console
  console.info(`%cSICEDU%c ${origen} · API en ${baseURL}`, 'font-weight:bold;color:#1D4ED8', 'color:inherit')
}

export const api = axios.create({
  baseURL,
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
    // RNF-003: las respuestas con datos de alumnos no se guardan en caché HTTP.
    'Cache-Control': 'no-store',
  },
})

api.interceptors.request.use((config) => {
  const token = obtenerToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (respuesta) => respuesta,
  (error) => {
    // Token vencido o inválido: se cierra la sesión y el guardado de ruta hace
    // el resto. No se reintenta: reintentar con un token muerto es inútil.
    if (error?.response?.status === 401 && !error.config?.url?.includes('/login')) {
      useSessionStore.getState().cerrarSesion()
    }
    return Promise.reject(error)
  },
)

/**
 * Punto único donde se decide mock o API real.
 * `resolver({ mock: () => handlers.x(), real: () => api.get(...) })`
 *
 * `forzarReal` permite que un dominio concreto vaya contra la API aunque el
 * resto siga en mock. Hoy solo lo usa `resources/auth.js`, que es lo único que
 * el backend tiene publicado.
 */
export async function resolver({ mock, real, forzarReal = false }) {
  if (usarMock && !forzarReal) return mock()
  const respuesta = await real()
  return respuesta?.data
}

/** Código de estado de un error de axios (o del mock), o null si fue de red. */
export const estadoDe = (error) => error?.response?.status ?? null

/**
 * Convierte un error de la API en un texto que se pueda pintar.
 *
 * FastAPI devuelve `detail` de DOS formas distintas y hay que distinguirlas:
 *
 *   422  `detail` es un ARRAY de errores de validación, cada uno con `loc`,
 *        `msg` y `type`. Pintarlo tal cual reventaría React ("Objects are not
 *        valid as a React child") o mostraría [object Object].
 *   4xx/5xx lanzados con `HTTPException`: `detail` es un STRING.
 *
 * Sin respuesta del servidor es un fallo de red: eso no es un error de datos y
 * se nombra como lo que es, porque con la disponibilidad del 70 % de RN-017
 * pasa a menudo y el docente necesita saber que su dato quedó en la cola local.
 */
export function mensajeDeError(error, porDefecto = 'Intente nuevamente.') {
  if (!error) return porDefecto

  const detalle = error?.response?.data?.detail

  // 422 de validación: se juntan los mensajes, nombrando el campo cuando se puede.
  if (Array.isArray(detalle)) {
    const mensajes = detalle
      .map((item) => {
        const campo = Array.isArray(item?.loc) ? item.loc.filter((p) => p !== 'body').join('.') : null
        return campo ? `${campo}: ${item?.msg ?? 'dato inválido'}` : (item?.msg ?? null)
      })
      .filter(Boolean)
    return mensajes.length ? mensajes.join(' · ') : porDefecto
  }

  if (typeof detalle === 'string' && detalle.trim()) return detalle

  if (!error.response) return 'Sin conexión con el servidor. El dato quedó guardado en este dispositivo.'

  return porDefecto
}

export default api
