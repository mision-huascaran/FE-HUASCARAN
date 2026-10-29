// Seguimiento de docentes del Supervisor (CU020, CU021).
//
// Todo este módulo es SOLO EN LÍNEA y de solo lectura: los CU prohíben
// guardarlo en IndexedDB para no llenar la memoria del navegador con datos
// masivos de auditoría. Sin conexión, la pantalla muestra su estado vacío.
import { api, resolver, adminContraApiReal } from '../client'
import ENDPOINTS from '../endpoints'
import handlers from '../mock/handlers'
import { normalizarPaginado, todasLasPaginas } from './administracion'

const { seguimiento } = ENDPOINTS

/**
 * `GET /seguimiento/docentes` (CU020).
 *
 * El orden lo decide el servidor: primero los que tienen sincronización
 * `pendiente` y después alfabéticamente. Es lo que hace útil la pantalla, así
 * que no se reordena en el cliente.
 */
/**
 * D97 — Los listados de este módulo piden TODAS las páginas: el servidor
 * entrega de 40 en 40 y la tabla pagina en el cliente. Con solo la primera,
 * 41 Docentes se veían como "Mostrando 1 a 40 de 40".
 */
export const listarSeguimiento = async (filtros = {}) => {
  const pedir = (pagina) =>
    resolver({
      mock: () => handlers.sesiones.seguimiento(filtros),
      real: () =>
        api.get(seguimiento.docentes, {
          params: {
            id_colegio: filtros.id_colegio || undefined,
            desde: filtros.desde || undefined,
            hasta: filtros.hasta || undefined,
            sincronizacion: filtros.sincronizacion || undefined,
            // Explícito a propósito: `activo` es un boolean con `default: true`
            // en el contrato, así que omitirlo NO trae a todos, trae solo a los
            // activos. Esta pantalla no ofrece un "Todos", y mandarlo escrito
            // evita que parezca que sí por no enviar nada.
            activo: filtros.estado !== 'inactivo',
            page: pagina || undefined,
          },
        }),
      forzarReal: adminContraApiReal,
    })
  return normalizarPaginado(await todasLasPaginas(pedir, { pagina: filtros.pagina }))
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
  const pedir = (pagina) =>
    resolver({
      mock: () => handlers.sesiones.actividadesDe(idDocente, filtros),
      real: () =>
        api.get(seguimiento.actividadesDe(idDocente), {
          params: {
            desde: filtros.desde || undefined,
            hasta: filtros.hasta || undefined,
            estado: filtros.estado || undefined,
            page: pagina || undefined,
          },
        }),
      forzarReal: adminContraApiReal,
    })
  return normalizarPaginado(await todasLasPaginas(pedir, { pagina: filtros.pagina }))
}

/**
 * Los módulos que un atajo de CU021 puede abrir, con su etiqueta.
 *
 * Es una lista cerrada del contrato: un valor que no esté aquí responde 422
 * `validacion`, así que la pantalla no puede dejar elegir otro.
 */
export const MODULOS_DE_ACTIVIDAD = [
  { clave: 'asistencias', etiqueta: 'Asistencias' },
  { clave: 'lectura', etiqueta: 'Seguimiento de Lectura' },
  { clave: 'rubrica', etiqueta: 'Rúbrica' },
  { clave: 'registro_vuelo', etiqueta: 'Registro de Vuelo' },
  { clave: 'alumnos', etiqueta: 'Alumnos' },
]

/**
 * `GET /seguimiento/docentes/{id}/actividades/{id}/registros` — qué tocó una actividad.
 *
 * SALE DE LA AUDITORÍA DE LA ACTIVIDAD, NO DE LA FECHA, y esa es toda la
 * diferencia: dos actividades del mismo día tocaron cosas distintas, y
 * filtrar por fecha mezclaría el trabajo de una con el de la otra. Es lo que
 * hace que los atajos de CU021 —"Ver Asistencias", "Ver Alumnos"— enseñen lo
 * que esa jornada hizo y no lo que pasó ese día.
 *
 * Solo el Supervisor: el Docente y el Directivo reciben 403.
 */
export const listarRegistrosDeActividad = async (idDocente, idActividad, { modulo, pagina } = {}) => {
  const pedir = (pag) =>
    resolver({
      mock: () => handlers.sesiones.registrosDeActividad(idDocente, idActividad, { modulo, pagina: pag }),
      real: () =>
        api.get(seguimiento.registrosDe(idDocente, idActividad), {
          params: { modulo, page: pag || undefined },
        }),
      forzarReal: adminContraApiReal,
    })
  return normalizarPaginado(await todasLasPaginas(pedir, { pagina }))
}
