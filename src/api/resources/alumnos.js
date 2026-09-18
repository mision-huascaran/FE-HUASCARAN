import { api, resolver } from '../client'
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
