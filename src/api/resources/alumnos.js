import { api, resolver, adminContraApiReal } from '../client'
import ENDPOINTS from '../endpoints'
import handlers from '../mock/handlers'

/** GET /alumnos?colegio=&grado=&programa=&q= */
export const listarAlumnos = (filtros = {}) =>
  resolver({
    mock: () => handlers.alumnos.listar(filtros),
    real: () => api.get(ENDPOINTS.alumnos.listar, { params: filtros }),
  })

/** GET /alumnos/{id} — encabezado e indicadores de la ficha (P11). */
export const obtenerAlumno = (id) =>
  resolver({
    mock: () => handlers.alumnos.detalle(id),
    real: () => api.get(ENDPOINTS.alumnos.detalle(id)),
  })

/** GET /alumnos/{id}/historial — series, libros y evaluaciones de la ficha (P11). */
export const obtenerHistorialAlumno = (id) =>
  resolver({
    mock: () => handlers.alumnos.historial(id),
    real: () => api.get(ENDPOINTS.alumnos.historial(id)),
  })

/**
 * `GET /alumnos/{id}/resumen` — las TRES tarjetas de CU015 (pestaña Resumen).
 *
 * Cambió de forma: `nivel_actual` desapareció y ahora es `nivel_colocado`, un
 * objeto `{letra, id_nivel_rk, numero_periodo, nivel_descriptivo}` o `null`.
 * `nivel_descriptivo` lo calcula el servidor con la matriz por grado de CU015
 * (una "J" no significa lo mismo en 1.º que en 6.º), así que NO se traduce
 * aquí: se muestra lo que manda.
 *
 * `libros_leidos_anio` y `asistencia_porcentaje` ya no llegan en `null`: son 0
 * cuando no hay datos, y un 0 sí se puede pintar.
 */
export const obtenerResumenAlumno = (idAlumno) =>
  resolver({
    mock: () => handlers.administracion.resumenAlumno(idAlumno),
    real: () => api.get(ENDPOINTS.alumnos.resumen(idAlumno)),
    forzarReal: adminContraApiReal,
  })
