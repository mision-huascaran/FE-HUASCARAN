// La regla que atraviesa todo el dashboard: SIN INFORMACIÓN NO ES CERO.
//
// Es lo que los tres casos de uso repiten en cada flujo alternativo y en cada
// bloque de restricciones: "El sistema no representa la ausencia de información
// como 0 alumnos, 0 %, 0 libros ni un nivel de desempeño. El valor 0 se muestra
// únicamente cuando existe información suficiente para confirmar esa cantidad."
//
// Y no es una preferencia de redacción. Un 0 % de asistencia dicho de un
// colegio que todavía no empezó su periodo es una acusación falsa, y un 0 en
// libros de un mes que aún no ha ocurrido es un incumplimiento inventado. El
// backend ya distingue las dos cosas —manda `null`, `sin_informacion`,
// `sin_datos`, `futuro`, `no_aplica`— y aquí se traduce a lo que se pinta, una
// sola vez, para que ningún bloque lo resuelva a su manera.
//
// Los estados y sus textos salen de la tabla D-3 del contrato del backend
// (`cambiosFront_semana12_v1.md`) cruzada con los literales de los CU.

/** Lo que se escribe cuando el servidor no confirma ninguna cantidad. */
export const SIN_INFORMACION = 'Sin información'

/** El literal de CU033 y CU035 para una consulta que no trajo nada. */
export const SIN_DATOS_SELECCION = 'No hay información disponible para esta selección.'

/** El de CU034, que nombra el módulo del que no hay registros. */
export const SIN_REGISTROS_LECTURA = 'No hay registros de Seguimiento de Lectura para esta selección.'

/** El de CU033 cuando nadie tiene evaluación completa. */
export const SIN_EVALUACIONES_COMPLETAS = 'No hay evaluaciones completas para esta selección.'

/** Error de consulta (CU033, CU034 y CU035 usan el mismo texto). */
export const ERROR_CONSULTA = 'No se pudo cargar la información. Verifica tu conexión e inténtalo nuevamente.'

/** Filtros incompletos, uno por pantalla: lo que cada CU pide decir. */
export const FALTAN_FILTROS = 'Selecciona un año escolar y un periodo académico para consultar los indicadores.'
export const FALTAN_FILTROS_LIBROS = 'Selecciona un año escolar y al menos un colegio.'
export const FALTAN_FILTROS_DIRECTIVO = 'Selecciona un año escolar, un periodo académico y al menos un colegio.'

export const SIN_CALENDARIO =
  'No hay un calendario configurado para todos los colegios seleccionados. Revisa el año escolar o la selección de colegios.'

export const CAMBIOS_SIN_APLICAR = 'Cambios sin aplicar'
export const INFORMACION_NO_ACTUALIZADA = 'Información no actualizada'
export const INFORMACION_INCOMPLETA = 'Información incompleta'
export const TOTAL_PARCIAL = 'Total registrado hasta el momento'
export const SIN_COLEGIOS_AUTORIZADOS = 'No tienes colegios autorizados para consultar.'

/** Errores de la descarga de gráficas (CU033 y CU035, flujo "Descargar gráfica"). */
export const ERROR_DESCARGA = 'No se pudo descargar la gráfica. Inténtalo nuevamente.'

/**
 * Estados que significan "no hay nada confirmado".
 *
 * `futuro` entra aquí a propósito: un mes que todavía no ha transcurrido no es
 * información faltante —los CU lo dicen: "Los meses futuros no se consideran
 * información faltante antes de que transcurran"— pero tampoco tiene valor que
 * pintar, y la línea del gráfico no debe atravesarlo.
 */
const VACIOS = new Set(['sin_informacion', 'sin_datos', 'sin_evaluaciones', 'futuro', 'no_aplica'])

/** Estados que traen un valor de verdad, aunque sea provisional. */
const PROVISIONALES = new Set([
  'provisional',
  'evaluacion_incompleta',
  'registro_incompleto',
  'incompleto',
  'parcial',
])

/**
 * ¿Este bloque o fila está sin información?
 *
 * Mira el estado Y el valor: un `null` sin estado también es ausencia, y es
 * como llegan varios campos del contrato (`porcentaje: null`, `total: null`).
 */
export function sinInformacion(dato, campo = 'valor') {
  if (dato == null) return true
  if (dato.sin_datos === true) return true
  if (VACIOS.has(dato.estado)) return true
  return dato[campo] == null
}

/** ¿Hay que advertir que lo que se ve está a medias? */
export const esProvisional = (dato) =>
  Boolean(dato && (dato.provisional === true || dato.parcial === true || PROVISIONALES.has(dato.estado)))

/** ¿Es un acumulado hasta hoy y no un cierre? */
export const enCurso = (dato) => Boolean(dato && (dato.en_curso === true || dato.estado === 'en_curso'))

/** ¿Un mes o un año que todavía no ha llegado? Sin punto y sin cero. */
export const esFuturo = (dato) => dato?.estado === 'futuro'

/**
 * Etiqueta corta de un estado, para el `Badge` que acompaña al valor.
 * `null` cuando no hay nada que advertir: lo normal no se rotula.
 */
export function etiquetaDeEstado(dato) {
  if (!dato) return null
  if (dato.estado === 'no_aplica') return 'No aplica'
  if (dato.estado === 'registro_incompleto') return 'Registro incompleto'
  if (dato.estado === 'evaluacion_incompleta') return 'Evaluación incompleta'
  if (enCurso(dato)) return 'En curso'
  if (dato.parcial === true || dato.estado === 'parcial') return 'Parcial'
  if (esProvisional(dato)) return INFORMACION_INCOMPLETA
  return null
}

/**
 * EL FORMATO NO REDONDEA PARA ORDENAR, SOLO PARA MOSTRAR.
 *
 * Los CU son explícitos: el orden lo decide el servidor con el valor sin
 * redondear, y "el valor visible se presenta con dos decimales". Por eso aquí
 * nunca se reordena ni se recalcula nada: solo se escribe.
 */
export const formatearPorcentaje = (valor) =>
  valor == null ? SIN_INFORMACION : `${Number(valor).toFixed(1)} %`

export const formatearIndice = (valor) => (valor == null ? SIN_INFORMACION : Number(valor).toFixed(2))

export const formatearCantidad = (valor) =>
  valor == null ? SIN_INFORMACION : new Intl.NumberFormat('es-PE').format(valor)

/**
 * El valor de una celda, respetando la regla de arriba.
 *
 * `formato` es el que se aplica cuando el dato SÍ está confirmado. Un 0
 * confirmado pasa por aquí y se escribe "0", que es lo que se quiere: 0 con
 * información es un dato, y hay que poder distinguirlo del hueco.
 */
export function celda(dato, campo = 'valor', formato = formatearCantidad) {
  if (sinInformacion(dato, campo)) return SIN_INFORMACION
  return formato(dato[campo])
}

/**
 * Título de un bloque con su alcance, tal como lo piden los CU: "en todos los
 * colegios", "en [nombre]" o "en los [N] colegios seleccionados".
 *
 * No es adorno: los tres casos de uso insisten en que cada bloque diga a qué
 * colegios corresponde, porque el mismo número significa cosas distintas si es
 * de uno o de nueve.
 */
export function alcanceEnTexto({ todosLosColegios, idColegios = [], colegios = [] } = {}) {
  if (todosLosColegios) return 'en todos los colegios'
  if (idColegios.length === 1) {
    const nombre = colegios.find((c) => String(c.id_colegio) === String(idColegios[0]))?.nombre
    return nombre ? `en ${nombre}` : 'en el colegio seleccionado'
  }
  return `en los ${idColegios.length} colegios seleccionados`
}

/** Nombre visible del periodo. Nunca "PA2": los CU lo prohíben expresamente. */
export const nombreDePeriodo = (periodo) => periodo?.nombre ?? null
