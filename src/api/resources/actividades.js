// Actividades de trabajo del Docente (CU009, CU010 y CU017 a CU019).
//
// En la interfaz la pantalla se llama "Sesiones", pero en la API son
// ACTIVIDADES, y conviene no mezclarlas: la sesión autenticada dura 8 horas y
// la abre el login; una actividad la abre el docente con un botón y pueden
// caber varias dentro de la misma sesión, nunca dos a la vez. El "ID de sesión"
// que nombran los CU es el `id` de la actividad.
import { api, resolver, adminContraApiReal } from '../client'
import ENDPOINTS from '../endpoints'
import handlers from '../mock/handlers'
import { normalizarPaginado } from './administracion'

const { actividades } = ENDPOINTS

/**
 * `crypto.randomUUID` no existe en navegadores viejos ni en algunos jsdom.
 * El id lo genera el CLIENTE a propósito: así un reintento tras un corte de red
 * no crea una segunda actividad (201 la primera vez, 200 las siguientes).
 */
export function nuevoIdActividad() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

/**
 * `POST /actividades`.
 *
 * Errores que hay que distinguir por `motivo`:
 *   · `actividad_activa_existente` — hay que finalizar la actual primero.
 *   · `sin_asignaciones`           — el docente no tiene asignaciones vigentes.
 *   · `actividad_id_en_uso`        — ese UUID es de otro docente; generar otro.
 */
export const iniciarActividad = ({ id, inicio } = {}) => {
  const idActividad = id ?? nuevoIdActividad()
  return resolver({
    mock: () => handlers.sesiones.iniciar({ id: idActividad, inicio }),
    // `inicio` es opcional y, si va, debe llevar zona horaria o el backend
    // responde 422: un instante sin zona es ambiguo.
    real: () => api.post(actividades.crear, { id_actividad: idActividad, ...(inicio ? { inicio } : {}) }),
    forzarReal: adminContraApiReal,
  })
}

/**
 * `POST /actividades/{id}/finalizar`. Sin `fin` usa la hora actual.
 *
 * Repetirlo responde 200 sin cambios, así que un doble clic no rompe nada.
 * NO cierra la sesión: después se puede iniciar otra actividad.
 */
export const finalizarActividad = (id, { fin } = {}) =>
  resolver({
    mock: () => handlers.sesiones.finalizar(id, { fin }),
    real: () => api.post(actividades.finalizar(id), fin ? { fin } : {}),
    forzarReal: adminContraApiReal,
  })

/**
 * `GET /actividades` — solo las del docente autenticado (CU017, CU018).
 *
 * Omitir un filtro equivale a "Todos". Un rango de fechas invertido responde
 * 422 con `motivo: "rango_fechas_invalido"`.
 */
export const listarActividades = async (filtros = {}) => {
  const datos = await resolver({
    mock: () => handlers.sesiones.listar(filtros),
    real: () =>
      api.get(actividades.listar, {
        params: {
          desde: filtros.desde || undefined,
          hasta: filtros.hasta || undefined,
          estado: filtros.estado || undefined,
          sincronizacion: filtros.sincronizacion || undefined,
          tipo_cierre: filtros.tipo_cierre || undefined,
          page: filtros.pagina || undefined,
        },
      }),
    forzarReal: adminContraApiReal,
  })
  return normalizarPaginado(datos)
}

/**
 * `GET /actividades/{id}` (CU019). Solo en línea: sin conexión la pantalla
 * muestra su estado vacío y no tira de la memoria local.
 *
 * Una actividad ajena o inexistente responde 404 `actividad_no_encontrada`.
 */
export const obtenerActividad = (id) =>
  resolver({
    mock: () => handlers.sesiones.detalle(id),
    real: () => api.get(actividades.detalle(id)),
    forzarReal: adminContraApiReal,
  })

/**
 * Etiqueta visible del tipo de cierre.
 *
 * Hoy el backend manda el texto completo, pero avisó de que pasará a códigos
 * (`manual`, `forzado_cierre_sesion`, `expiracion_sesion`). La traducción vive
 * SOLO aquí para que ese cambio sea de una línea.
 */
const ETIQUETA_CIERRE = {
  manual: 'Manual por finalización de actividad',
  forzado_cierre_sesion: 'Forzado por cierre de sesión',
  expiracion_sesion: 'Automático por expiración de sesión',
}

export const etiquetaTipoCierre = (valor) => {
  if (!valor) return 'No aplica'
  return ETIQUETA_CIERRE[valor] ?? valor
}

/** Etiquetas de los estados, que viajan en `snake_case` (§1.5 del contrato). */
export const ETIQUETA_ESTADO = { en_curso: 'En curso', finalizada: 'Finalizada' }
export const ETIQUETA_SINCRONIZACION = {
  sincronizada: 'Sincronizada',
  pendiente: 'Pendiente',
  error: 'Error',
  al_dia: 'Al día',
}
