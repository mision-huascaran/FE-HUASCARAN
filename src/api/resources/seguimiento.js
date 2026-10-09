// Seguimiento de docentes del Supervisor (CU020, CU021).
//
// Todo este módulo es SOLO EN LÍNEA y de solo lectura: los CU prohíben
// guardarlo en IndexedDB para no llenar la memoria del navegador con datos
// masivos de auditoría. Sin conexión, la pantalla muestra su estado vacío.
import { api, resolver, adminContraApiReal } from '../client'
import ENDPOINTS from '../endpoints'
import handlers from '../mock/handlers'
import { normalizarPaginado } from './administracion'

const { seguimiento } = ENDPOINTS

/**
 * `GET /seguimiento/docentes` (CU020).
 *
 * El orden lo decide el servidor: primero los que tienen sincronización
 * `pendiente` y después alfabéticamente. Es lo que hace útil la pantalla, así
 * que no se reordena en el cliente.
 */
export const listarSeguimiento = async (filtros = {}) => {
  const datos = await resolver({
    mock: () => handlers.sesiones.seguimiento(filtros),
    real: () =>
      api.get(seguimiento.docentes, {
        params: {
          id_colegio: filtros.id_colegio || undefined,
          desde: filtros.desde || undefined,
          hasta: filtros.hasta || undefined,
          sincronizacion: filtros.sincronizacion || undefined,
          // Por defecto solo los activos; `false` para ver los desactivados.
          activo: filtros.estado === 'inactivo' ? false : undefined,
          page: filtros.pagina || undefined,
        },
      }),
    forzarReal: adminContraApiReal,
  })
  return normalizarPaginado(datos)
}

/** Cabecera del detalle: la misma forma que una fila del listado. */
export const obtenerDocenteSeguimiento = (idDocente) =>
  resolver({
    mock: () => handlers.sesiones.seguimientoDocente(idDocente),
    real: () => api.get(seguimiento.docente(idDocente)),
    forzarReal: adminContraApiReal,
  })

/**
 * Bitácora del docente (CU021): el mismo `Paginado` de actividades y los
 * mismos filtros que el listado propio del Docente.
 */
export const listarActividadesDe = async (idDocente, filtros = {}) => {
  const datos = await resolver({
    mock: () => handlers.sesiones.actividadesDe(idDocente, filtros),
    real: () =>
      api.get(seguimiento.actividadesDe(idDocente), {
        params: {
          desde: filtros.desde || undefined,
          hasta: filtros.hasta || undefined,
          estado: filtros.estado || undefined,
          page: filtros.pagina || undefined,
        },
      }),
    forzarReal: adminContraApiReal,
  })
  return normalizarPaginado(datos)
}
