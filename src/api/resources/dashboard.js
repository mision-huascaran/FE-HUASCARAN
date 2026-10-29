// Dashboard del Supervisor y del Directivo (CU033, CU034 y CU035).
//
// ES SOLO EN LÍNEA, y los casos de uso lo dicen con todas las letras: "El
// dashboard requiere conexión a Internet. No dispone de un modo de consulta
// offline". Nada de esto se guarda en IndexedDB ni entra en la cola de
// escrituras: son consultas de solo lectura sobre información **confirmada por
// el servidor**, y los registros que un docente todavía no sincronizó no se
// incorporan hasta que el servidor los acepte.
//
// ───────────────────────────────────────────────────────────────────────────
// LO QUE ESTE ARCHIVO DECIDE, Y POR QUÉ ESTÁ AQUÍ Y NO EN LAS PANTALLAS
//
//  1. CÓMO VIAJAN LOS COLEGIOS. El contrato admite `todos_los_colegios=true`
//     **o** `id_colegios` repetido, nunca los dos a la vez (422). Y una
//     selección vacía NO equivale a "todos": con ella no se consulta.
//  2. EL PERIODO ACADÉMICO ES OBLIGATORIO EN UNOS BLOQUES Y PROHIBIDO EN
//     OTROS. Mandarlo donde no toca es un 422 ("Este indicador es anual: no
//     elijas un periodo académico."), así que cada función declara lo suyo y
//     `parametrosDe` lo recorta. Las pantallas pasan los mismos filtros a
//     todos los bloques sin tener que acordarse de esto.
//  3. LA SERIALIZACIÓN. Axios, por defecto, manda un array como
//     `id_colegios[]=1&id_colegios[]=4`, con corchetes, y el backend espera
//     `id_colegios=1&id_colegios=4`. Eso lo arregla `indexes: null`, y es la
//     clase de detalle que se descubre con un 422 incomprensible.
import { api, resolver, adminContraApiReal } from '../client'
import ENDPOINTS from '../endpoints'
import handlers from '../mock/handlers'

const { dashboard } = ENDPOINTS

/** `?id_colegios=1&id_colegios=4`, sin corchetes (ver nota 3 de la cabecera). */
const SERIALIZAR = { paramsSerializer: { indexes: null } }

/**
 * Los filtros comunes, en la forma que espera el servidor.
 *
 * `periodo`:
 *   'obligatorio' — lo manda siempre (distribución, resultados, comparación de
 *                   resultados y asistencia).
 *   'prohibido'   — lo quita aunque la pantalla lo tenga elegido (libros y
 *                   evolución anual, que son anuales).
 */
export function parametrosDe(filtros = {}, periodo = 'obligatorio') {
  const { idAnioEscolar, idPeriodoAcademico, todosLosColegios, idColegios = [] } = filtros

  const params = { id_anio_escolar: idAnioEscolar || undefined }

  // Lo uno O lo otro. Los dos juntos son 422, y ninguno de los dos también.
  if (todosLosColegios) params.todos_los_colegios = true
  else if (idColegios.length) params.id_colegios = idColegios.map(Number)

  if (periodo === 'obligatorio' && idPeriodoAcademico) {
    params.id_periodo_academico = Number(idPeriodoAcademico)
  }

  return params
}

/**
 * ¿Se puede consultar con estos filtros?
 *
 * Es lo que deshabilita "Aplicar". El año y al menos un colegio hacen falta
 * siempre; el periodo solo en las pantallas que lo piden (CU033 y CU035 sí,
 * CU034 no, porque se organiza por meses del año escolar).
 */
export const filtrosCompletos = (filtros = {}, { exigePeriodo = true } = {}) =>
  Boolean(
    filtros.idAnioEscolar &&
      (filtros.todosLosColegios || (filtros.idColegios?.length ?? 0) > 0) &&
      (!exigePeriodo || filtros.idPeriodoAcademico),
  )

/**
 * Los colegios sin calendario de un 422 `calendario_no_configurado`.
 *
 * El CU prohíbe excluirlos en silencio: hay que decir CUÁLES son, porque la
 * respuesta del Supervisor es ir a configurarles el calendario o sacarlos de
 * la selección.
 */
export const colegiosSinCalendario = (error) =>
  error?.response?.data?.motivo === 'calendario_no_configurado'
    ? (error.response.data.colegios_sin_calendario ?? [])
    : []

const pedir = (mock, real) => resolver({ mock, real, forzarReal: adminContraApiReal })

/**
 * `GET /dashboard/filtros` — colegios autorizados, años con sus PA y la
 * selección inicial.
 *
 * `seleccion_inicial` en `null` significa que el servidor NO pudo determinar
 * una: la fecha de hoy no cae en ningún PA ni PR de los colegios incluidos.
 * No se aproxima nada en el cliente —el CU lo prohíbe expresamente, "sin
 * elegir un calendario por aproximación"—: se piden los filtros a la persona.
 */
export const obtenerFiltrosDashboard = () =>
  pedir(
    () => handlers.dashboard.filtros(),
    () => api.get(dashboard.filtros),
  )

/** CU033 paso 5 — dona y tabla de la distribución por subprograma. Supervisor. */
export const obtenerDistribucionSubprograma = (filtros) =>
  pedir(
    () => handlers.dashboard.distribucionSubprograma(parametrosDe(filtros)),
    () => api.get(dashboard.distribucionSubprograma, { params: parametrosDe(filtros), ...SERIALIZAR }),
  )

/** CU033 paso 6 y CU035 paso 6 — resultados de aprendizaje del PA. */
export const obtenerResultadosAprendizaje = (filtros) =>
  pedir(
    () => handlers.dashboard.resultadosAprendizaje(parametrosDe(filtros)),
    () => api.get(dashboard.resultadosAprendizaje, { params: parametrosDe(filtros), ...SERIALIZAR }),
  )

/**
 * CU033 paso 7 — comparación de resultados. Supervisor.
 *
 * Tiene filtros PROPIOS que solo afectan a su bloque: el subprograma
 * (obligatorio), los grados (todos o una lista), la vista y el resultado.
 */
export const obtenerComparacionResultados = (filtros, propios = {}) => {
  const { idPrograma, todosLosGrados, idGrados = [], vista = 'resumen_colegio', resultado = 'global' } = propios
  const params = { ...parametrosDe(filtros), id_programa: idPrograma || undefined, vista, resultado }
  if (todosLosGrados) params.todos_los_grados = true
  else if (idGrados.length) params.id_grados = idGrados.map(Number)

  return pedir(
    () => handlers.dashboard.comparacionResultados(params),
    () => api.get(dashboard.comparacionResultados, { params, ...SERIALIZAR }),
  )
}

/** CU033 paso 8 y CU035 paso 7 — asistencia del PA: resumen, mensual y por colegio. */
export const obtenerAsistenciaDashboard = (filtros) =>
  pedir(
    () => handlers.dashboard.asistencia(parametrosDe(filtros)),
    () => api.get(dashboard.asistencia, { params: parametrosDe(filtros), ...SERIALIZAR }),
  )

/**
 * CU033 paso 8 (detalle) — una fila por clase, con su fecha efectiva. Supervisor.
 *
 * Se consulta para UN colegio, grado y sección: es el detalle que se abre al
 * pulsar una fila del resumen, no un listado general.
 */
export const obtenerClasesDeAsistencia = (filtros, { idColegio, idGrado, idSeccion } = {}) => {
  const params = {
    ...parametrosDe({ ...filtros, todosLosColegios: false, idColegios: [idColegio] }),
    id_grado: idGrado || undefined,
    id_seccion: idSeccion || undefined,
  }
  return pedir(
    () => handlers.dashboard.asistenciaClases(params),
    () => api.get(dashboard.asistenciaClases, { params, ...SERIALIZAR }),
  )
}

/**
 * CU034 y CU035 paso 5 — consolidado de libros. ES ANUAL: el periodo
 * académico no viaja, porque el consolidado se organiza por MESES del año
 * escolar y mandarlo sería un 422.
 */
export const obtenerLibros = (filtros) =>
  pedir(
    () => handlers.dashboard.libros(parametrosDe(filtros, 'prohibido')),
    () => api.get(dashboard.libros, { params: parametrosDe(filtros, 'prohibido'), ...SERIALIZAR }),
  )

/** CU034 paso 6 — un colegio por grado y alumno. Supervisor (trae nombres). */
export const obtenerLibrosDeColegio = (idColegio, filtros, { idGrado } = {}) => {
  const params = { id_anio_escolar: filtros?.idAnioEscolar || undefined, id_grado: idGrado || undefined }
  return pedir(
    () => handlers.dashboard.librosDeColegio(idColegio, params),
    () => api.get(dashboard.librosDeColegio(idColegio), { params, ...SERIALIZAR }),
  )
}

/**
 * CU034 paso 8 — de qué registros sale una cantidad mensual de un alumno.
 *
 * Cada elemento trae su `id_lectura_semanal`, con el que se abre el
 * Seguimiento de Lectura en consulta.
 */
export const obtenerDesgloseDeLibros = ({ idAlumno, mes, anio, idAnioEscolar } = {}) => {
  const params = {
    id_alumno: idAlumno || undefined,
    mes: mes || undefined,
    anio: anio || undefined,
    id_anio_escolar: idAnioEscolar || undefined,
  }
  return pedir(
    () => handlers.dashboard.librosDesglose(params),
    () => api.get(dashboard.librosDesglose, { params, ...SERIALIZAR }),
  )
}

/** CU033 paso 9 y CU035 paso 8 — evolución anual. También anual: sin periodo. */
export const obtenerEvolucionAnual = (filtros) =>
  pedir(
    () => handlers.dashboard.evolucionAnual(parametrosDe(filtros, 'prohibido')),
    () => api.get(dashboard.evolucionAnual, { params: parametrosDe(filtros, 'prohibido'), ...SERIALIZAR }),
  )

/**
 * Los cuatro indicadores de la comparación entre colegios (CU035 paso 9), y
 * si cada uno lleva periodo académico o no.
 *
 * `promedio_libros` es ANUAL —es el de CU034— y mandarle un periodo es un
 * 422; los otros tres son del PA y omitirlo es otro 422. Por eso la regla vive
 * en la misma tabla que la etiqueta y no en un `if` de la pantalla.
 */
export const INDICADORES_COMPARACION = [
  { clave: 'nivel_global_alfabetizacion', etiqueta: 'Nivel global de Alfabetización', periodo: 'obligatorio' },
  { clave: 'nivel_global_comprension', etiqueta: 'Nivel global de Comprensión Lectora', periodo: 'obligatorio' },
  { clave: 'asistencia', etiqueta: 'Asistencia', periodo: 'obligatorio' },
  { clave: 'promedio_libros', etiqueta: 'Promedio de libros leídos por alumno', periodo: 'prohibido' },
]

export const obtenerComparacionColegios = (filtros, indicador = 'nivel_global_alfabetizacion') => {
  const regla = INDICADORES_COMPARACION.find((i) => i.clave === indicador)?.periodo ?? 'obligatorio'
  const params = { ...parametrosDe(filtros, regla), indicador }
  return pedir(
    () => handlers.dashboard.comparacionColegios(params),
    () => api.get(dashboard.comparacionColegios, { params, ...SERIALIZAR }),
  )
}
