// Vistas consolidadas: dashboard (P12), colegios y ranking (P13) y panel
// ejecutivo (P17). Ningún endpoint de este archivo existe todavía en el backend.
import { api, resolver } from '../client'
import ENDPOINTS from '../endpoints'
import handlers from '../mock/handlers'

const { dashboard, colegios } = ENDPOINTS

/** Todo el dashboard con un mismo juego de filtros (RF-006). */
export const obtenerDashboard = (filtros = {}) =>
  resolver({
    mock: () => handlers.dashboard.resumen(filtros),
    real: () => api.get(dashboard.resumen, { params: filtros }),
  })

/** GET /dashboard/ranking-colegios?programa=&periodo= (RF-009). */
export const obtenerRankingColegios = (filtros = {}) =>
  resolver({
    mock: () => handlers.dashboard.rankingColegios(filtros),
    real: () => api.get(dashboard.rankingColegios, { params: filtros }),
  })

/** GET /dashboard/ranking-aulas?colegio=&periodo= (RF-008). */
export const obtenerRankingAulas = (filtros = {}) =>
  resolver({
    mock: () => handlers.dashboard.rankingAulas(filtros),
    real: () => api.get(dashboard.rankingAulas, { params: filtros }),
  })

export const obtenerDetalleColegio = (id, filtros = {}) =>
  resolver({
    mock: () => handlers.colegios.detalle(id, filtros),
    real: () => api.get(colegios.detalle(id), { params: filtros }),
  })

export const obtenerPanelEjecutivo = (filtros = {}) =>
  resolver({
    mock: () => handlers.dashboard.ejecutivo(filtros),
    real: () => api.get(dashboard.ejecutivo, { params: filtros }),
  })
