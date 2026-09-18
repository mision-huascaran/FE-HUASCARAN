// Evaluaciones diagnósticas — el "registro de vuelo" (P6 y P7).
//
// Los cuatro cortes del año (abril, julio, octubre, diciembre) viajan como una
// sola fila por alumno: es lo que necesita la tabla comparativa del histórico y
// evita cuatro consultas por estudiante.
import { api, resolver } from '../client'
import ENDPOINTS from '../endpoints'
import handlers from '../mock/handlers'

/** GET /evaluacion-diagnostica?periodo=&colegio=&grado= */
export const listarEvaluaciones = (filtros = {}) =>
  resolver({
    mock: () => handlers.evaluaciones.listar(filtros),
    real: () => api.get(ENDPOINTS.evaluacionDiagnostica.listar, { params: filtros }),
  })

/**
 * Alta o actualización de una evaluación.
 *
 * La clave de idempotencia es `alumno-periodo`: un alumno tiene como mucho una
 * evaluación por corte, así que un reintento actualiza la fila en vez de crear
 * otra (RN-010, RNF-001).
 */
export const guardarEvaluacion = (payload) =>
  resolver({
    mock: () => handlers.evaluaciones.guardar(payload),
    real: () =>
      payload.id_evaluacion
        ? api.put(ENDPOINTS.evaluacionDiagnostica.actualizar(payload.id_evaluacion), payload)
        : api.post(ENDPOINTS.evaluacionDiagnostica.crear, payload, {
            headers: { 'Idempotency-Key': `${payload.id_alumno}-${payload.id_periodo}` },
          }),
  })
