// Consolidados (P14) y alertas de inconsistencia (P15).
import { api, resolver } from '../client'
import ENDPOINTS from '../endpoints'
import handlers from '../mock/handlers'

const { consolidados, alertas } = ENDPOINTS

/** GET /consolidados/nivel?colegio=&periodo= */
export const obtenerConsolidadoNivel = (filtros = {}) =>
  resolver({
    mock: () => handlers.consolidados.nivel(filtros),
    real: () => api.get(consolidados.nivel, { params: filtros }),
  })

/** GET /consolidados/libros?colegio=&mes= */
export const obtenerConsolidadoLibros = (filtros = {}) =>
  resolver({
    mock: () => handlers.consolidados.libros(filtros),
    real: () => api.get(consolidados.libros, { params: filtros }),
  })

/** GET /alertas/inconsistencias */
export const listarAlertas = (filtros = {}) =>
  resolver({
    mock: () => handlers.alertas.listar(filtros),
    real: () => api.get(alertas.inconsistencias, { params: filtros }),
  })

export const marcarAlertaRevisada = (id) =>
  resolver({
    mock: () => handlers.alertas.marcarRevisada(id),
    real: () => api.patch(alertas.revisar(id), { estado: 'revisada' }),
  })
