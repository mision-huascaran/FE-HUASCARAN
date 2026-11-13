import { create } from 'zustand'
import { idUsuarioDe, tokenCaducado } from '../auth/jwt'

/**
 * Sesión activa.
 *
 * RNF-003: el token vive en memoria y se respalda en `sessionStorage`, NUNCA en
 * `localStorage`, de modo que no sobrevive al cierre del navegador.
 */
const CLAVE_TOKEN = 'sicedu.token'

function leerTokenInicial() {
  try {
    const token = sessionStorage.getItem(CLAVE_TOKEN)
    // El JWT dura 8 horas: al recargar puede estar vencido. Restaurarlo solo
    // serviría para que la primera petición muriera con un 401.
    if (token && tokenCaducado(token)) {
      sessionStorage.removeItem(CLAVE_TOKEN)
      return null
    }
    return token
  } catch {
    // Navegación privada o almacenamiento bloqueado: la sesión vive solo en memoria.
    return null
  }
}

export const useSessionStore = create((set, get) => ({
  token: leerTokenInicial(),
  usuario: null,
  cargando: true,

  setToken: (token) => {
    try {
      if (token) sessionStorage.setItem(CLAVE_TOKEN, token)
      else sessionStorage.removeItem(CLAVE_TOKEN)
    } catch {
      // Sin almacenamiento disponible el token sigue siendo válido en memoria.
    }
    set({ token })
  },

  motivoCierre: null,

  /**
   * `GET /me` falló por algo que NO es la autenticación (D52).
   *
   * Un error de red o un 5xx no significan que la sesión haya terminado:
   * significan que el servidor no contesta. Antes los dos caminos acababan
   * igual —borrar la sesión y mandar al login—, así que con el backend caído
   * la aplicación echaba al usuario y le hacía creer que su sesión expiró.
   *
   * Con esto, el token se conserva y la pantalla puede decir la verdad y
   * ofrecer reintentar.
   */
  servidorInalcanzable: false,
  setServidorInalcanzable: (valor) => set({ servidorInalcanzable: valor, cargando: false }),

  setUsuario: (usuario) => set({ usuario, servidorInalcanzable: false }),
  setCargando: (cargando) => set({ cargando }),

  /**
   * D109 — Cómo terminó la última sesión de esta pestaña.
   *
   *   · `null`: no terminó ninguna (se abrió un enlace sin sesión).
   *   · `{ idUsuario: null }`: se cerró a mano. No queda pantalla de vuelta.
   *   · `{ idUsuario }`: se cortó sola (expiró, el servidor la rechazó). Solo
   *     esa MISMA cuenta vuelve a la pantalla en la que estaba.
   *
   * Vive en memoria: `localStorage` no es sitio para datos de la persona
   * (D115) y el cierre de sesión lo vacía entero.
   */
  salida: null,

  /**
   * @param motivo 'expiracion' cuando se cumplieron las 8 horas (CU007), para
   *   poder decirlo en el login. Vive aquí y no en `AuthProvider` porque quien
   *   lo detecta es el interceptor de axios, que está fuera de React.
   * @param opciones.manual el usuario pulsó "Cerrar sesión": no queda pantalla
   *   a la que volver (D109).
   */
  cerrarSesion: (motivo = null, { manual = false } = {}) => {
    // Antes del `set`: después ya no hay perfil. Si el perfil no llegó (un 401
    // de `/me` al recargar), la cuenta se lee del token.
    const { usuario, token } = get()
    const idUsuario = usuario?.id_usuario ?? idUsuarioDe(token) ?? null
    try {
      sessionStorage.removeItem(CLAVE_TOKEN)
      // D4: la sesión de ACTIVIDADES muere con la de autenticación, tanto al
      // cerrar sesión como al vencer el JWT. No se puede seguir editando las
      // grillas del aula con un token muerto. La COLA no se toca: los cambios
      // pendientes sobreviven y se envían tras el siguiente login (CU005).
      sessionStorage.removeItem('sicedu.actividad')
    } catch {
      // nada que limpiar
    }
    set({
      token: null,
      usuario: null,
      cargando: false,
      motivoCierre: motivo,
      servidorInalcanzable: false,
      salida: { idUsuario: manual ? null : idUsuario },
    })
  },

  limpiarMotivoCierre: () => set({ motivoCierre: null }),

  /** id_rol del usuario autenticado, o null. */
  rol: () => get().usuario?.id_rol ?? null,
}))

/** Acceso al token fuera de React (interceptores de axios). */
export function obtenerToken() {
  return useSessionStore.getState().token
}

export default useSessionStore
