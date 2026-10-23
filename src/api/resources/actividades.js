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
 * `idSesion` es el `jti` de la sesión en la que OCURRIÓ la actividad, y solo
 * viaja desde la cola offline. Sin él, una actividad que se sincroniza después
 * de volver a entrar se asocia a la sesión NUEVA, y el servidor comprueba que
 * su `inicio` sea posterior al de esa sesión: no lo es, porque pasó antes, así
 * que responde 422 `inicio_invalido` y el envío se queda atascado en la cola
 * para siempre. Con él, la actividad se registra donde de verdad ocurrió y
 * hereda el cierre de aquella sesión (CU008, CU009).
 *
 * Errores que hay que distinguir por `motivo`:
 *   · `actividad_activa_existente` — hay que finalizar la actual primero.
 *   · `sin_asignaciones`           — el docente no tiene asignaciones vigentes.
 *   · `actividad_id_en_uso`        — ese UUID es de otro docente; generar otro.
 *   · `inicio_invalido`            — el `inicio` no cae dentro de la sesión.
 */
export const iniciarActividad = ({ id, inicio, id_sesion: idSesion } = {}) => {
  const idActividad = id ?? nuevoIdActividad()
  return resolver({
    mock: () => handlers.sesiones.iniciar({ id: idActividad, inicio }),
    // `inicio` es opcional y, si va, debe llevar zona horaria o el backend
    // responde 422: un instante sin zona es ambiguo. Con `id_sesion` de otra
    // sesión deja de ser opcional, pero la cola lo manda siempre.
    real: () =>
      api.post(actividades.crear, {
        id_actividad: idActividad,
        ...(inicio ? { inicio } : {}),
        ...(idSesion ? { id_sesion: idSesion } : {}),
      }),
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
/**
 * Estados de sincronización. Son CUATRO, no dos.
 *
 * `sin_informacion` es el que faltaba y el que más importa: significa que el
 * servidor NO SABE, no que todo esté bien. Antes no existía y quien nunca se
 * había conectado caía en "al día" por descarte: un docente que trabajó una
 * semana sin señal se veía en verde, con el trabajo entero en su tablet y
 * nadie enterado de que estaba en riesgo.
 *
 * Hoy TODOS llegan en `sin_informacion`, porque el servidor todavía no recibe
 * la cola offline. Desde T5 empieza a haber valores reales.
 */
export const ETIQUETA_SINCRONIZACION = {
  sincronizada: 'Sincronizada',
  pendiente: 'Pendiente',
  error: 'Error',
  al_dia: 'Al día',
  sin_informacion: 'Sin información',
}

/**
 * El color de cada estado. `sin_informacion` va en NEUTRO, no en verde: no es
 * una buena noticia ni una mala, es la ausencia de noticia, y pintarla de
 * cualquiera de los dos colores sería afirmar algo que no se sabe.
 */
export const TONO_SINCRONIZACION = {
  sincronizada: 'success',
  al_dia: 'success',
  pendiente: 'warning',
  error: 'danger',
  sin_informacion: 'neutral',
}

/**
 * Lo que explica el estado al pasar el cursor.
 *
 * El verde se malinterpreta solo: "al día" quiere decir "sin pendientes QUE EL
 * SERVIDOR CONOZCA", que no es lo mismo que "sin trabajo en riesgo".
 */
export const AYUDA_SINCRONIZACION = {
  al_dia: 'Sin registros pendientes informados al servidor.',
  pendiente: 'Tiene registros informados que aún no se han guardado.',
  error: 'Un envío fue rechazado y necesita revisión.',
  sin_informacion: 'El servidor no ha recibido información de sincronización de este docente.',
}
