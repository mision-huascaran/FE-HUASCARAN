import { create } from 'zustand'

/**
 * Operaciones que el servidor RECHAZÓ al sincronizar (Asistencias, Lectura,
 * Rúbrica, Registro de Vuelo).
 *
 * Viven fuera de las pantallas porque un envío hecho sin conexión puede
 * rechazarse horas después, con la pantalla ya cerrada: el rechazo tiene que
 * seguir ahí, con su `detail`, hasta que el docente lo resuelva. Uno por
 * registro (`clave`): un rechazo nuevo del mismo alumno sustituye al anterior.
 *
 * Cada uno: `{clave, modulo, nombre, idOperacion, motivo, detail, registro}`.
 */
const CLAVE = 'sicedu.rechazos'

/**
 * D69 — RECARGAR NO BORRA EL "ERROR".
 *
 * Solo en memoria, recargar la página hacía desaparecer el rechazo: la
 * operación ya había salido de la cola y el docente dejaba de ver que su dato
 * no subió. Se respalda en `localStorage`, que el cierre de sesión vacía
 * entero (CU007), así que no pasa a la siguiente persona del navegador.
 */
function leerGuardados() {
  try {
    const guardados = JSON.parse(localStorage.getItem(CLAVE) ?? '[]')
    return Array.isArray(guardados) ? guardados : []
  } catch {
    return []
  }
}

function guardar(rechazos) {
  try {
    if (rechazos.length) localStorage.setItem(CLAVE, JSON.stringify(rechazos))
    else localStorage.removeItem(CLAVE)
  } catch {
    // Sin almacenamiento el rechazo sigue visible mientras la pestaña viva.
  }
  return { rechazos }
}

export const useRechazosStore = create((set) => ({
  rechazos: leerGuardados(),
  agregar: (rechazo) =>
    set((estado) => guardar([...estado.rechazos.filter((r) => r.clave !== rechazo.clave), rechazo])),
  quitar: (clave) => set((estado) => guardar(estado.rechazos.filter((r) => r.clave !== clave))),
  limpiar: () => set(guardar([])),
}))

export default useRechazosStore
