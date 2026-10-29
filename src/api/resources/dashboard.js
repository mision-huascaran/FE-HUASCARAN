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
//  4. EL CONTRATO DE CADA RESPUESTA. Cada endpoint tiene su `adaptarX`, que
//     recibe la respuesta TAL COMO LA DEFINE `app/schemas/dashboard.py` del
//     backend y la deja en la forma que lee su pantalla. El simulador devuelve
//     la misma forma que el backend y pasa por el mismo adaptador, así que una
//     diferencia de nombres se ve en las pruebas y no en producción (S23).
//     Regla de los adaptadores: un `null` del servidor sigue siendo `null`
//     —"Sin información" no es 0— y lo que la pantalla no lee también se
//     pasa (`contexto`, `mensaje`, `fuente`...).
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

// ── Adaptadores: del contrato del backend a lo que lee cada pantalla ────────

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

/** "Marzo 2026": el backend manda el mes y el año, el nombre se pone aquí. */
const nombreDeMes = ({ mes, anio }) => `${MESES[mes - 1] ?? mes} ${anio}`

const lista = (valor) => valor ?? []

/** `{colegio: {id, nombre}, ...resto}` → `{id_colegio, nombre, ...resto}`. */
const conColegio = ({ colegio, ...resto }) => ({ ...resto, id_colegio: colegio?.id, nombre: colegio?.nombre })

/** Las tres dimensiones de los resultados, con su nombre visible. */
const NOMBRE_DE_RESULTADO = {
  global: 'Nivel global',
  fluidez: 'Fluidez Lectora',
  comprension: 'Comprensión Lectora',
}

/**
 * La condición de una distribución o de un grupo evaluado, derivada de sus
 * recuentos: sin evaluados no hay nivel que mostrar, y con pendientes lo que
 * se ve es provisional.
 */
const estadoDeEvaluacion = ({ evaluados, pendientes }) => {
  if (!evaluados) return 'sin_evaluaciones'
  return pendientes ? 'evaluacion_incompleta' : 'completo'
}

/** `MesLibros` → la fila que pintan las tablas y el gráfico de barras. */
const mesDeLibros = (mes) => ({ ...mes, nombre: nombreDeMes(mes), cantidad: mes.total })

/** `GET /dashboard/filtros` — el backend usa `id`; las pantallas, el id con nombre. */
export const adaptarFiltros = (r) => ({
  ...r,
  colegios: lista(r.colegios).map((c) => ({ id_colegio: c.id, nombre: c.nombre })),
  anios: lista(r.anios).map((a) => ({
    id_anio_escolar: a.id,
    nombre: a.nombre,
    periodos: lista(a.periodos).map((p) => ({ id_periodo_academico: p.id, numero: p.numero, nombre: p.nombre })),
  })),
  seleccion_inicial: r.seleccion_inicial ?? null,
})

/** `GET /dashboard/distribucion-subprograma` (`DistribucionSubprograma`). */
export const adaptarDistribucion = (r) => ({
  ...r,
  subprogramas: lista(r.subprogramas).map((s) => ({
    id_programa: s.subprograma.id,
    nombre: s.subprograma.nombre,
    cantidad: s.alumnos,
    porcentaje: s.porcentaje,
  })),
  fechas_corte: lista(r.fechas_corte).map(conColegio),
  colegios_sin_informacion: lista(r.colegios_sin_informacion).map(conColegio),
})

/**
 * `GET /dashboard/resultados-aprendizaje` (`ResultadosAprendizaje`).
 *
 * `total_a_evaluar` viene POR SUBPROGRAMA y la pantalla lo escribe en cada
 * dimensión: se copia a las tres. Los evaluados y pendientes, en cambio, son
 * de cada dimensión, porque un alumno puede tener Fluidez y no Comprensión.
 */
export const adaptarResultados = (r) => ({
  ...r,
  colegios_sin_informacion: lista(r.colegios_sin_informacion).map(conColegio),
  programas: lista(r.subprogramas).map((s) => ({
    id_programa: s.subprograma.id,
    nombre: s.subprograma.nombre,
    total_a_evaluar: s.total_a_evaluar,
    dimensiones: lista(s.distribuciones).map((d) => ({
      ...d,
      clave: d.resultado,
      nombre: NOMBRE_DE_RESULTADO[d.resultado] ?? d.resultado,
      a_evaluar: s.total_a_evaluar,
      estado: estadoDeEvaluacion(d),
      niveles: lista(d.niveles).map((n) => ({ nombre: n.nombre, cantidad: n.alumnos, porcentaje: n.porcentaje })),
    })),
  })),
})

/** Un colegio, o un colegio y grado, de la comparación de resultados. */
const grupoComparado = ({ colegio, grado, total_a_evaluar: aEvaluar, ...resto }) => ({
  ...resto,
  id_colegio: colegio.id,
  colegio: colegio.nombre,
  id_grado: grado?.id ?? null,
  grado: grado?.nombre ?? null,
  nombre: grado ? `${colegio.nombre} · ${grado.nombre}` : colegio.nombre,
  a_evaluar: aEvaluar ?? null,
})

/**
 * `GET /dashboard/comparacion-resultados` (`ComparacionResultados`).
 *
 * Cada nivel de `distribucion` trae solo su `codigo`; el nombre visible sale
 * de `escala`, que también da las columnas: la escala de Fluidez o del nivel
 * alfabético no es la de Inicio a Avanzado.
 */
export const adaptarComparacionResultados = (r) => {
  const escala = lista(r.escala)
  const nombreDeNivel = (codigo) => escala.find((n) => n.codigo === codigo)?.nombre ?? codigo
  return {
    ...r,
    escala,
    id_programa: r.subprograma?.id,
    programa: r.subprograma?.nombre ?? null,
    grados: lista(r.grados).map((g) => ({ id_grado: g.id, nombre: g.nombre })),
    fechas_corte: lista(r.fechas_corte).map(conColegio),
    colegios_sin_informacion: lista(r.colegios_sin_informacion).map(conColegio),
    grupos: lista(r.ranking).map((g) => ({
      ...grupoComparado(g),
      estado: g.evaluacion_incompleta ? 'evaluacion_incompleta' : 'completo',
      niveles: lista(g.distribucion).map((n) => ({
        codigo: n.codigo,
        nombre: nombreDeNivel(n.codigo),
        cantidad: n.alumnos,
        porcentaje: n.porcentaje,
      })),
    })),
    sin_evaluaciones: lista(r.sin_evaluaciones).map(grupoComparado),
    no_aplica: lista(r.no_aplica).map((g) => ({ ...grupoComparado(g), estado: 'no_aplica' })),
  }
}

/** `GET /dashboard/asistencia` (`AsistenciaDelPeriodo`). */
export const adaptarAsistencia = (r) => ({
  ...r,
  resumen: r.resumen && { ...r.resumen, clases_registro_incompleto: r.resumen.clases_incompletas },
  mensual: lista(r.mensual).map((m) => ({ ...m, nombre: nombreDeMes(m) })),
  colegios: lista(r.por_colegio).map((c) => ({
    ...conColegio(c),
    clases_registro_incompleto: c.clases_incompletas,
  })),
  colegios_sin_informacion: lista(r.colegios_sin_informacion).map(conColegio),
})

/**
 * `GET /dashboard/asistencia/clases` (`AsistenciaPorClase`).
 *
 * Las clases dictadas y las sin registro llegan en listas distintas de cada
 * grupo y así siguen: las sin registro no tienen conteos ni porcentaje, porque
 * no son clases con 0 % sino clases que nadie registró.
 */
export const adaptarClasesDeAsistencia = (r) => {
  const grupos = lista(r.grupos)
  return {
    ...r,
    grupos,
    grados: [...new Map(grupos.map((g) => [g.grado.id, g.grado])).values()],
    clases: grupos.flatMap((g) =>
      lista(g.clases).map((c) => ({ ...c, grado: g.grado, seccion: g.seccion, alumnos: c.lista_historica })),
    ),
    clases_sin_registro: grupos.flatMap((g) =>
      lista(g.clases_sin_registro).map((c) => ({ ...c, grado: g.grado, seccion: g.seccion })),
    ),
  }
}

/** `ResumenLibros` → con `alumnos`, que es el nombre que leen las tarjetas. */
const resumenDeLibros = (resumen) => resumen && { ...resumen, alumnos: resumen.alumnos_incluidos }

/** `GET /dashboard/libros` (`LibrosDelAnio`). */
export const adaptarLibros = (r) => ({
  ...r,
  consultado_hasta: r.contexto?.fecha_consulta ?? null,
  resumen: resumenDeLibros(r.resumen),
  meses: lista(r.meses).map(mesDeLibros),
  colegios: lista(r.colegios).map((c) => ({
    ...conColegio(c),
    alumnos: c.alumnos_incluidos,
    meses: lista(c.meses).map(mesDeLibros),
  })),
  sin_informacion: lista(r.colegios_sin_informacion).map((c) => ({
    ...conColegio(c),
    alumnos: c.alumnos_incluidos,
  })),
})

/** Un grado del detalle de libros, con sus alumnos y sus meses. */
const gradoDeLibros = ({ grado, alumnos, ...resto }) => ({
  ...resto,
  id_grado: grado.id,
  nombre: grado.nombre,
  alumnos: lista(alumnos).map(({ alumno, meses, ...suyo }) => ({
    ...suyo,
    id_alumno: alumno.id,
    nombre: alumno.nombre,
    meses: lista(meses).map(mesDeLibros),
  })),
})

/** `GET /dashboard/libros/colegios/{id}` (`LibrosDelColegio`). */
export const adaptarLibrosDeColegio = (r) => ({
  ...r,
  colegio: r.colegio && { id_colegio: r.colegio.id, nombre: r.colegio.nombre },
  resumen: resumenDeLibros(r.resumen),
  meses: lista(r.meses).map(mesDeLibros),
  grados: lista(r.grados).map(gradoDeLibros),
  sin_informacion: lista(r.grados_sin_informacion).map(gradoDeLibros),
})

/**
 * `GET /dashboard/libros/desglose` (`DesgloseLibros`).
 *
 * `lsl` y `total` pueden ser `null` (no registrado) y así se quedan; `lsn` es
 * 1 o 0. "No realizada" es un estado de la tabla, no una cantidad.
 */
export const adaptarDesgloseDeLibros = (r) => ({
  ...r,
  alumno: r.alumno && { id_alumno: r.alumno.id, nombre: r.alumno.nombre },
  items: lista(r.registros).map((x) => ({
    ...x,
    clase: x.clase_referencia,
    subprograma: x.subprograma?.nombre ?? null,
    id_programa: x.subprograma?.id ?? null,
    colegio: x.colegio?.nombre ?? null,
    grado: x.grado?.nombre ?? null,
    seccion: x.seccion?.nombre ?? null,
    libros_subir_nivel: x.lsn,
    libros_seleccion_libre: x.lsl,
    no_realizada: x.estado_tabla === 'no_realizada',
  })),
})

/**
 * `GET /dashboard/evolucion-anual` (`EvolucionAnual`).
 *
 * OJO: en el backend `anios[].colegios` es una LISTA (alumnos por colegio) y
 * el número de colegios es `colegios_atendidos`. Leer `colegios` como número
 * no da error, da un valor equivocado; por eso la lista sale con otro nombre
 * (`cobertura_por_colegio`) y aquí no queda ningún `colegios`.
 */
export const adaptarEvolucion = (r) => ({
  ...r,
  anios: lista(r.anios).map(({ anio_escolar: anio, colegios, libros, ...resto }) => ({
    ...resto,
    id_anio_escolar: anio.id,
    nombre: anio.nombre,
    libros: libros?.total ?? null,
    estado_libros: libros?.estado ?? null,
    cobertura_por_colegio: lista(colegios).map(conColegio),
  })),
})

/** `GET /dashboard/comparacion-colegios` (`ComparacionColegios`). */
export const adaptarComparacionColegios = (r) => ({
  ...r,
  colegios: lista(r.ranking).map(conColegio),
  sin_informacion: lista(r.sin_informacion).map(conColegio),
})

// ── Las llamadas ─────────────────────────────────────────────────────────────

/** Mock o real, y la respuesta pasa por su adaptador en los dos casos. */
const pedir = (mock, real, adaptar) =>
  resolver({ mock, real, forzarReal: adminContraApiReal }).then((respuesta) => adaptar(respuesta ?? {}))

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
    adaptarFiltros,
  )

/** CU033 paso 5 — dona y tabla de la distribución por subprograma. Supervisor. */
export const obtenerDistribucionSubprograma = (filtros) =>
  pedir(
    () => handlers.dashboard.distribucionSubprograma(parametrosDe(filtros)),
    () => api.get(dashboard.distribucionSubprograma, { params: parametrosDe(filtros), ...SERIALIZAR }),
    adaptarDistribucion,
  )

/** CU033 paso 6 y CU035 paso 6 — resultados de aprendizaje del PA. */
export const obtenerResultadosAprendizaje = (filtros) =>
  pedir(
    () => handlers.dashboard.resultadosAprendizaje(parametrosDe(filtros)),
    () => api.get(dashboard.resultadosAprendizaje, { params: parametrosDe(filtros), ...SERIALIZAR }),
    adaptarResultados,
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
    adaptarComparacionResultados,
  )
}

/** CU033 paso 8 y CU035 paso 7 — asistencia del PA: resumen, mensual y por colegio. */
export const obtenerAsistenciaDashboard = (filtros) =>
  pedir(
    () => handlers.dashboard.asistencia(parametrosDe(filtros)),
    () => api.get(dashboard.asistencia, { params: parametrosDe(filtros), ...SERIALIZAR }),
    adaptarAsistencia,
  )

/**
 * CU033 paso 8 (detalle) — una fila por clase, con su fecha efectiva. Supervisor.
 *
 * Se consulta para UN colegio, grado y sección: es el detalle que se abre al
 * pulsar una fila del resumen, no un listado general. Va con la selección de
 * colegios de la consulta aplicada (el colegio tiene que estar en ella) y
 * `id_colegio` aparte.
 */
export const obtenerClasesDeAsistencia = (filtros, { idColegio, idGrado, idSeccion } = {}) => {
  const params = {
    ...parametrosDe(filtros),
    id_colegio: idColegio || undefined,
    id_grado: idGrado || undefined,
    id_seccion: idSeccion || undefined,
  }
  return pedir(
    () => handlers.dashboard.asistenciaClases(params),
    () => api.get(dashboard.asistenciaClases, { params, ...SERIALIZAR }),
    adaptarClasesDeAsistencia,
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
    adaptarLibros,
  )

/**
 * CU034 paso 6 — un colegio por grado y alumno. Supervisor (trae nombres).
 *
 * Valida la MISMA selección de colegios que `/dashboard/libros` (el colegio
 * tiene que estar en ella), así que lleva los filtros aplicados enteros. El
 * backend no filtra por grado: si se pide uno, se filtra aquí sobre `grados`.
 */
export const obtenerLibrosDeColegio = async (idColegio, filtros, { idGrado } = {}) => {
  const params = parametrosDe(filtros, 'prohibido')
  const datos = await pedir(
    () => handlers.dashboard.librosDeColegio(idColegio, params),
    () => api.get(dashboard.librosDeColegio(idColegio), { params, ...SERIALIZAR }),
    adaptarLibrosDeColegio,
  )
  if (!idGrado) return datos
  const delGrado = (g) => String(g.id_grado) === String(idGrado)
  return { ...datos, grados: datos.grados.filter(delGrado), sin_informacion: datos.sin_informacion.filter(delGrado) }
}

/**
 * CU034 paso 8 — de qué registros sale una cantidad mensual de un alumno.
 *
 * Con los filtros de la consulta APLICADA: el backend busca al alumno en los
 * colegios seleccionados, igual que `/dashboard/libros`. Cada elemento trae su
 * `id_lectura_semanal`, con el que se abre el Seguimiento de Lectura en
 * consulta.
 */
export const obtenerDesgloseDeLibros = (filtros, { idAlumno, mes, anio } = {}) => {
  const params = {
    ...parametrosDe(filtros, 'prohibido'),
    id_alumno: idAlumno || undefined,
    mes: mes || undefined,
    anio: anio || undefined,
  }
  return pedir(
    () => handlers.dashboard.librosDesglose(params),
    () => api.get(dashboard.librosDesglose, { params, ...SERIALIZAR }),
    adaptarDesgloseDeLibros,
  )
}

/** CU033 paso 9 y CU035 paso 8 — evolución anual. También anual: sin periodo. */
export const obtenerEvolucionAnual = (filtros) =>
  pedir(
    () => handlers.dashboard.evolucionAnual(parametrosDe(filtros, 'prohibido')),
    () => api.get(dashboard.evolucionAnual, { params: parametrosDe(filtros, 'prohibido'), ...SERIALIZAR }),
    adaptarEvolucion,
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
    adaptarComparacionColegios,
  )
}
