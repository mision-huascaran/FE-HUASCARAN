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

export const listarColegiosAdmin = () =>
  resolver({ mock: () => handlers.administracion.colegios(), real: () => api.get(administracion.colegios) })

export const listarAlumnosAdmin = () =>
  resolver({ mock: () => handlers.administracion.alumnos(), real: () => api.get(administracion.alumnos) })

export const listarUsuariosAdmin = () =>
  resolver({ mock: () => handlers.administracion.usuarios(), real: () => api.get(administracion.usuarios) })

export const crearColegio = (payload) =>
  resolver({
    mock: () => handlers.administracion.crearColegio(payload),
    real: () => api.post(administracion.colegios, payload),
  })

export const crearAlumno = (payload) =>
  resolver({
    mock: () => handlers.administracion.crearAlumno(payload),
    real: () => api.post(administracion.alumnos, payload),
  })

export const crearUsuario = (payload) =>
  resolver({
    mock: () => handlers.administracion.crearUsuario(payload),
    real: () => api.post(administracion.usuarios, payload),
  })

export const actualizarUsuario = (id, payload) =>
  resolver({
    mock: () => handlers.administracion.actualizarUsuario(id, payload),
    real: () => api.put(`${administracion.usuarios}/${id}`, payload),
  })

export const desactivarUsuario = (id) =>
  resolver({
    mock: () => handlers.administracion.desactivarUsuario(id),
    real: () => api.patch(`${administracion.usuarios}/${id}/desactivar`),
  })

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
