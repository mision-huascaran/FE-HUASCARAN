// Administración (P16): docentes y asignaciones. Los catálogos se leen con los
// hooks de `useCatalogos` y NO tienen escritura: la rúbrica es un instrumento
// oficial de Misión Huascarán (RF-025, RN-016).
import { api, resolver } from '../client'
import ENDPOINTS from '../endpoints'
import handlers from '../mock/handlers'

const { administracion } = ENDPOINTS

export const listarDocentes = () =>
  resolver({ mock: () => handlers.administracion.docentes(), real: () => api.get(administracion.docentes) })

export const listarAsignaciones = () =>
  resolver({ mock: () => handlers.administracion.asignaciones(), real: () => api.get(administracion.asignaciones) })

export const crearAsignacion = (payload) =>
  resolver({
    mock: () => handlers.administracion.crearAsignacion(payload),
    real: () => api.post(administracion.asignaciones, payload),
  })

export const eliminarAsignacion = (id) =>
  resolver({
    mock: () => handlers.administracion.eliminarAsignacion(id),
    real: () => api.delete(administracion.asignacion(id)),
  })
