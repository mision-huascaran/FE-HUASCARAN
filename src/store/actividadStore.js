// Sesión de ACTIVIDADES — no confundir con la de autenticación (D4).
//
// Son dos cosas distintas:
//   · sesión de autenticación = el JWT, dura 8 h, la abre el login.
//   · sesión de actividades   = la abre el docente con un botón, y es lo que
//     habilita la edición de las grillas del aula.
//
// Sin actividades iniciadas las grillas se ven pero no se editan. Cerrar sesión
// o vencer el JWT cierra también las actividades.
//
// El id lo genera el NAVEGADOR (UUID), no el servidor: así se puede iniciar sin
// red, que es justo el caso del aula. El inicio y el cierre se encolan como
// cualquier otro cambio.
import dayjs from 'dayjs'
import { create } from 'zustand'

/** Vigencia máxima de una actividad, igual que la del JWT (CU007). */
export const HORAS_DE_VIGENCIA = 8

/**
 * Hora de fin de una actividad. Se calcula a partir del inicio y por eso NO se
 * reinicia al recargar, cambiar de módulo, perder la conexión ni recuperarla:
 * es lo que CU010 exige mostrar como texto estático, sin cronómetro regresivo.
 */
export const horaFinDe = (inicio) => dayjs(inicio).add(HORAS_DE_VIGENCIA, 'hour')

const CLAVE = 'sicedu.actividad'

/** `crypto.randomUUID` no existe en navegadores viejos ni en algunos jsdom. */
function uuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

/** Se restaura al recargar: una recarga no debe cerrar las actividades. */
function leerGuardada() {
  try {
    const crudo = sessionStorage.getItem(CLAVE)
    return crudo ? JSON.parse(crudo) : null
  } catch {
    return null
  }
}

function guardar(sesion) {
  try {
    if (sesion) sessionStorage.setItem(CLAVE, JSON.stringify(sesion))
    else sessionStorage.removeItem(CLAVE)
  } catch {
    // Modo privado o almacenamiento bloqueado: se sigue con la sesión en memoria.
  }
}

const useActividadStore = create((set, get) => ({
  sesion: leerGuardada(),

  /** ¿Puede editar las grillas del aula ahora mismo? */
  get activa() {
    return Boolean(get().sesion)
  },

  iniciar: ({ idDocente } = {}) => {
    const sesion = {
      id: uuid(),
      id_docente: idDocente ?? null,
      inicio: new Date().toISOString(),
      fin: null,
    }
    guardar(sesion)
    set({ sesion })
    return sesion
  },

  cerrar: () => {
    const { sesion } = get()
    if (!sesion) return null
    const cerrada = { ...sesion, fin: new Date().toISOString() }
    guardar(null)
    set({ sesion: null })
    return cerrada
  },

  /** Al cerrar sesión o vencer el JWT: las actividades se cierran con ella. */
  limpiar: () => {
    guardar(null)
    set({ sesion: null })
  },
}))

/** ¿Hay actividades iniciadas? Lo usan las grillas para habilitar la edición. */
export const hayActividadesIniciadas = () => Boolean(useActividadStore.getState().sesion)

export default useActividadStore
