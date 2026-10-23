import { create } from 'zustand'

/**
 * Operaciones que el servidor RECHAZÓ al sincronizar (Lectura, Rúbrica,
 * Registro de Vuelo).
 *
 * Viven fuera de las pantallas porque un envío hecho sin conexión puede
 * rechazarse horas después, con la pantalla ya cerrada: el rechazo tiene que
 * seguir ahí, con su `detail`, hasta que el docente lo resuelva. Uno por
 * registro (`clave`): un rechazo nuevo del mismo alumno sustituye al anterior.
 *
 * Cada uno: `{clave, modulo, nombre, idOperacion, motivo, detail, registro}`.
 */
export const useRechazosStore = create((set) => ({
  rechazos: [],
  agregar: (rechazo) =>
    set((estado) => ({ rechazos: [...estado.rechazos.filter((r) => r.clave !== rechazo.clave), rechazo] })),
  quitar: (clave) => set((estado) => ({ rechazos: estado.rechazos.filter((r) => r.clave !== clave) })),
  limpiar: () => set({ rechazos: [] }),
}))

export default useRechazosStore
