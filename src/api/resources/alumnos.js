import { api, resolver, adminContraApiReal } from '../client'
import ENDPOINTS from '../endpoints'
import handlers from '../mock/handlers'

/** GET /alumnos?colegio=&grado=&programa=&q= */
export const listarAlumnos = (filtros = {}) =>
  resolver({
    mock: () => handlers.alumnos.listar(filtros),
    real: () => api.get(ENDPOINTS.alumnos.listar, { params: filtros }),
  })

/**
 * `GET /alumnos/{id}` — cabecera del detalle (CU015) y popup de edición
 * (CU014). Va contra la API real: el listado de Alumnos ya es real y un id
 * suyo no existe en el simulador.
 */
export const obtenerAlumno = (id) =>
  resolver({
    mock: () => handlers.alumnos.detalle(id),
    real: () => api.get(ENDPOINTS.alumnos.detalle(id)),
    forzarReal: adminContraApiReal,
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

/**
 * `GET /alumnos/{id}/lectura` — sus filas en las 5 tablas semanales más
 * recientes del año (P4 §2). Ya no existen `observaciones` ni `libros_lsb`.
 */
export const obtenerLecturaAlumno = (idAlumno) =>
  resolver({
    mock: () => handlers.administracion.lecturaAlumno(idAlumno),
    real: () => api.get(ENDPOINTS.alumnos.lectura(idAlumno)),
    forzarReal: adminContraApiReal,
  })

/**
 * `GET /alumnos/{id}/rubrica` — `{evaluaciones}`: las 5 evaluaciones mensuales
 * más recientes, con NOMBRES de nivel (P4 §3). Desde T9 ya no trae `mensuales`.
 */
export const obtenerRubricaAlumno = (idAlumno) =>
  resolver({
    mock: () => handlers.administracion.rubricaAlumno(idAlumno),
    real: () => api.get(ENDPOINTS.alumnos.rubrica(idAlumno)),
    forzarReal: adminContraApiReal,
  })

/**
 * `GET /alumnos/{id}/registro-vuelo` — siempre los 4 PA del año, con su
 * decisión vigente en cualquier grupo (P5 §1, regla V1).
 */
export const obtenerRegistroVueloAlumno = (idAlumno) =>
  resolver({
    mock: () => handlers.administracion.registroVueloAlumno(idAlumno),
    real: () => api.get(ENDPOINTS.alumnos.registroVuelo(idAlumno)),
    forzarReal: adminContraApiReal,
  })
