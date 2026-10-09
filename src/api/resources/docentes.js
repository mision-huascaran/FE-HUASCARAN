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
import { adminContraApiReal, resolver } from '../client'
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
 * Indicadores del panel del docente (tarjetas "Mis estudiantes", "Reporte de
 * esta semana"… y el aviso de la evaluación diagnóstica abierta).
 *
 * TODO BACKEND: todavía no vienen en `GET /inicio/docente` (§12 del
 * contrato). Antes se sacaban del simulador TAMBIÉN contra la API real, así
 * que un Docente con 3 alumnos veía "110 estudiantes" (D13). Ahora, cuando el
 * Inicio va contra el backend, se devuelve `null` y las tarjetas no se pintan:
 * el contrato pide no mostrarlas o dejarlas como placeholder, nunca inventar.
 */
export const obtenerResumenDocente = (idDocente, { periodo, semana }) =>
  resolver({
    mock: () => handlers.docentes.resumen(idDocente, { periodo, semana }),
    real: async () => ({ data: null }),
    forzarReal: adminContraApiReal,
  })
