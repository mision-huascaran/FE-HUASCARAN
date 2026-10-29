// Calendario académico (CU027). Las rutas están publicadas desde la tanda 1.
//
// Un calendario reparte el año escolar en OCHO periodos, siempre los mismos y
// en este orden: PA1, el receso posterior a PA1, PA2, su receso, PA3, su
// receso, PA4 y su receso. Más los días no lectivos —feriados y suspensiones—.
//
// DOS ALCANCES. Hay un calendario GENERAL por año escolar y, encima, cada
// colegio puede tener uno PARTICULAR que lo sustituye. Por eso dos colegios
// pueden estar en periodos distintos el mismo día, y por eso el periodo
// aplicable es función de (colegio, fecha) y no un dato global.
//
// CONCURRENCIA DE VERDAD. Editar exige mandar la `version` que se leyó. Si otro
// Supervisor guardó entre medias, el servidor responde 409
// `modificacion_concurrente` en vez de dejar que el segundo pise al primero sin
// enterarse. Hay que guardar la versión al consultar.
//
// Y UN ERROR QUE NO ES UN FALLO: `calendario_incompatible`. Significa que el
// cambio de fechas dejaría registros ya guardados fuera de su periodo o en un
// día no lectivo. Viene con la lista de qué registros son, y eso hay que
// enseñarlo: es una decisión, no un error técnico.
import { api, resolver, adminContraApiReal } from '../client'
import ENDPOINTS from '../endpoints'
import handlers from '../mock/handlers'

const { calendarios } = ENDPOINTS

/** Las ocho filas de la tabla de periodos, en su orden cronológico fijo. */
export const PERIODOS_DEL_ANIO = [
  { tipo: 'PA', numero: 1 },
  { tipo: 'PR', numero: 1 },
  { tipo: 'PA', numero: 2 },
  { tipo: 'PR', numero: 2 },
  { tipo: 'PA', numero: 3 },
  { tipo: 'PR', numero: 3 },
  { tipo: 'PA', numero: 4 },
  { tipo: 'PR', numero: 4 },
]

/** "PA1" o "PR3", que es como los nombra el caso de uso. */
export const nombreDePeriodo = ({ tipo, numero }) => `${tipo}${numero}`

/**
 * Las ocho filas, rellenas con lo que haya llegado.
 *
 * Se arman desde la lista fija y no desde la respuesta: así la tabla tiene
 * siempre sus ocho renglones aunque el servidor devuelva menos, y cada uno
 * cae en su sitio. Un calendario a medias se ve como lo que es —huecos que
 * faltan por rellenar— en vez de como una tabla más corta.
 */
export function ochoPeriodos(periodos) {
  // `= []` por defecto NO cubre `null`, y el contrato admite nulos: un año sin
  // calendario puede devolver `periodos: null` y eso reventaría la pantalla.
  const lista = Array.isArray(periodos) ? periodos : []
  return PERIODOS_DEL_ANIO.map((base) => {
    const suyo = lista.find((p) => p.tipo === base.tipo && Number(p.numero) === base.numero)
    return {
      ...base,
      id_periodo_academico: suyo?.id_periodo_academico ?? null,
      fecha_inicio: suyo?.fecha_inicio ?? '',
      fecha_fin: suyo?.fecha_fin ?? '',
    }
  })
}

/** El año del calendario: por año calendario si llega, si no por id del año escolar. Nunca los dos. */
function filtroDeAnio(anio, idAnioEscolar) {
  if (anio) return { anio: Number(anio) }
  return idAnioEscolar ? { id_anio_escolar: Number(idAnioEscolar) } : {}
}

/**
 * `GET /calendarios` — el que aplica.
 *
 * Sin `idColegio`, el general. Con él, el particular del colegio o, si no
 * tiene, el general: `origen` dice cuál de los dos es, y esa distinción hay
 * que mostrarla o nadie sabe qué está editando.
 */
export const obtenerCalendario = async ({ anio, idAnioEscolar, idColegio } = {}) => {
  const datos = await resolver({
    mock: () => handlers.calendarios.obtener({ anio, idAnioEscolar, idColegio }),
    real: () =>
      api.get(calendarios.listar, {
        params: {
          /**
           * `anio` es el AÑO CALENDARIO (2027), no el id del año escolar.
           *
           * Lo añadió la tanda C junto con el selector de solo año: elegir un
           * año no crea nada, y si no existe se responde 404
           * `calendario_no_configurado` para poder ofrecer "Crear calendario".
           * Mandar los dos a la vez es un 422, así que `anio` manda cuando
           * está.
           */
          ...filtroDeAnio(anio, idAnioEscolar),
          ...(idColegio ? { id_colegio: Number(idColegio) } : {}),
        },
      }),
    forzarReal: adminContraApiReal,
  })
  return datos ? { ...datos, periodos: ochoPeriodos(datos.periodos) } : datos
}

/** `POST /calendarios` — crear el general de un año escolar. */
/**
 * Los nombres de los ocho periodos, como los escribe CU027.
 *
 * "Receso posterior al cuarto periodo", no "PR4": es lo que se muestra junto a
 * los filtros para decir en qué periodo estamos hoy, y ahí el código no
 * significa nada para quien lo lee.
 */
export const NOMBRE_LARGO_PERIODO = {
  PA1: 'Primer periodo',
  PA2: 'Segundo periodo',
  PA3: 'Tercer periodo',
  PA4: 'Cuarto periodo',
  PR1: 'Receso posterior al primer periodo',
  PR2: 'Receso posterior al segundo periodo',
  PR3: 'Receso posterior al tercer periodo',
  PR4: 'Receso posterior al cuarto periodo',
}

/** "Receso posterior al cuarto periodo: 21/12/2026 al 15/02/2027". */
export function textoDePeriodoActual(periodo) {
  if (!periodo) return 'Sin periodo aplicable a la fecha actual'
  const nombre = NOMBRE_LARGO_PERIODO[nombreDePeriodo(periodo)] ?? nombreDePeriodo(periodo)
  const corta = (iso) => (iso ? iso.split('-').reverse().join('/') : '—')
  return `${nombre}: ${corta(periodo.fecha_inicio)} al ${corta(periodo.fecha_fin)}`
}

/** ¿Esta fila de la tabla es el periodo en el que estamos hoy? */
export const esPeriodoActual = (fila, periodoActual) =>
  Boolean(periodoActual) &&
  fila.tipo === periodoActual.tipo &&
  Number(fila.numero) === Number(periodoActual.numero)

export const crearCalendarioGeneral = (cuerpo) =>
  resolver({
    mock: () => handlers.calendarios.crearGeneral(cuerpo),
    real: () => api.post(calendarios.crear, cuerpo),
    forzarReal: adminContraApiReal,
  })

/** `POST /calendarios/particulares` — fechas propias de un colegio. */
export const crearCalendarioParticular = (cuerpo) =>
  resolver({
    mock: () => handlers.calendarios.crearParticular(cuerpo),
    real: () => api.post(calendarios.crearParticular, cuerpo),
    forzarReal: adminContraApiReal,
  })

/**
 * `PUT /calendarios/{id}` — editar.
 *
 * PUT y no PATCH porque se manda la configuración COMPLETA: lo que no venga en
 * `dias_no_lectivos` se elimina. Mandar solo lo cambiado borraría el resto.
 */
export const actualizarCalendario = (idCalendario, cuerpo) =>
  resolver({
    mock: () => handlers.calendarios.actualizar(idCalendario, cuerpo),
    real: () => api.put(calendarios.actualizar(idCalendario), cuerpo),
    forzarReal: adminContraApiReal,
  })

/**
 * `POST /calendarios/{id}/usar-general` — un colegio vuelve al general.
 *
 * El particular no se borra: queda como historial, y después se puede volver a
 * crear otro.
 */
export const volverAlGeneral = (idCalendario, version) =>
  resolver({
    mock: () => handlers.calendarios.usarGeneral(idCalendario, version),
    real: () => api.post(calendarios.usarGeneral(idCalendario), version ? { version } : {}),
    forzarReal: adminContraApiReal,
  })
