// Módulo de Inicio: un endpoint por rol (CU010, CU011, CU012).
//
// El backend los publicó en la Tanda 7. Antes esto se componía en el cliente
// con tres o cuatro llamadas sueltas, que con la conectividad de los colegios
// era justo lo que no convenía.
//
// Lo que todavía llega en `null` y hay que pintar como "Sin datos disponibles",
// nunca como 0 ni inventado (§1.5 y §12 del contrato):
//   · Supervisor: `pendientes` e `incompletos` (dependen de las grillas).
//   · Directivo:  `salud_sistema`.
//   · Docente:    los Resúmenes de Acción no vienen todavía.
import { api, resolver, adminContraApiReal } from '../client'
import ENDPOINTS from '../endpoints'
import handlers from '../mock/handlers'

const { inicio } = ENDPOINTS

/**
 * `GET /inicio/docente` (CU010).
 *
 * Campos que manda la pantalla: `actividad_activa` ({id, inicio} o null),
 * `puede_iniciar_actividad` (para habilitar el botón), `sesion_expira`,
 * `asignaciones` por colegio con sus grados, y `totales`.
 *
 * En vacaciones `asignaciones` llega vacío y `puede_iniciar_actividad` en
 * false, pero `actividad_activa` puede seguir trayendo una abierta para que el
 * docente pueda cerrarla.
 */
export const obtenerInicioDocente = () =>
  resolver({
    mock: () => handlers.inicio.docente(),
    real: () => api.get(inicio.docente),
    forzarReal: adminContraApiReal,
  })

/**
 * `GET /inicio/supervisor` (CU011).
 *
 * `alertas` es una lista de `{tipo, mensaje}` con el texto ya redactado. Hoy
 * solo existe `docente_inactivo`, pero llegará otro tipo: hay que pintar
 * CUALQUIER tipo usando su `mensaje`, sin asumir que solo hay uno.
 */
export const obtenerInicioSupervisor = () =>
  resolver({
    mock: () => handlers.inicio.supervisor(),
    real: () => api.get(inicio.supervisor),
    forzarReal: adminContraApiReal,
  })

/** `GET /inicio/directivo` (CU012): exactamente tres tarjetas, sin desgloses. */
export const obtenerInicioDirectivo = () =>
  resolver({
    mock: () => handlers.inicio.directivo(),
    real: () => api.get(inicio.directivo),
    forzarReal: adminContraApiReal,
  })

// Nombres anteriores, para no romper las pantallas que ya los importaban.
export const obtenerResumenSupervisor = obtenerInicioSupervisor
export const obtenerResumenDocente = obtenerInicioDocente
