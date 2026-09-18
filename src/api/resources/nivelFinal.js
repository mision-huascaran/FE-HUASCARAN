// Nivel final mensual (P9). RF-018: el consolidado se deriva de las rúbricas
// semanales del mes; el docente no lo escribe, solo puede ajustarlo con una
// justificación (RF-023, RN-015).
import { api, resolver } from '../client'
import ENDPOINTS from '../endpoints'
import handlers from '../mock/handlers'

/** GET /nivel-final-mensual?mes=&colegio=&grado= */
export const listarNivelFinal = (filtros = {}) =>
  resolver({
    mock: () => handlers.nivelFinal.listar(filtros),
    real: () => api.get(ENDPOINTS.nivelFinalMensual.listar, { params: filtros }),
  })

/** POST /nivel-final-mensual/{id}/ajuste — { id_nivel_final, justificacion } */
export const ajustarNivelFinal = (payload) =>
  resolver({
    mock: () => handlers.nivelFinal.ajustar(payload),
    real: () => api.post(ENDPOINTS.nivelFinalMensual.ajustar(payload.id_nivel_final), payload),
  })
