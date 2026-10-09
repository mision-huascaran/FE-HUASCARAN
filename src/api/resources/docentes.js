// Datos del docente para las pantallas de aula.
//
// CAMBIÓ EL ORIGEN. `GET /docentes/{id}/asignaciones` ya no existe: las
// asignaciones del usuario actual salen del TOKEN, con `GET /me/asignaciones`.
// El backend fue explícito al respecto ("No uses endpoints por id de docente
// para esto"), y tiene sentido: pedirlas por id permitiría a cualquiera
// preguntar por las de otro, y el alcance dejaría de estar en un solo sitio.
//
// Se conserva la firma `(idDocente, periodo)` porque la usan tres pantallas,
// pero los argumentos ya no viajan: el servidor sabe quién pregunta.
import { resolver } from '../client'
import handlers from '../mock/handlers'
import { listarMisAsignaciones } from './administracion'

/**
 * Colegios y grados que el docente tiene asignados (RN-003).
 *
 * Cada colegio trae sus `grados`, y cada grado su `cantidad_alumnos`, sus
 * `ciclos` y sus `subprogramas`.
 */
export const obtenerAsignaciones = () => listarMisAsignaciones()

/**
 * Indicadores del panel del docente.
 *
 * TODO BACKEND: los Resúmenes de Acción de CU010 ("Has evaluado X de Y",
 * "Tienes N registros sin sincronizar") todavía no vienen en
 * `GET /inicio/docente`. Hasta entonces esto se resuelve con el simulador.
 */
export const obtenerResumenDocente = (idDocente, { periodo, semana }) =>
  resolver({
    mock: () => handlers.docentes.resumen(idDocente, { periodo, semana }),
    real: () => handlers.docentes.resumen(idDocente, { periodo, semana }),
  })
