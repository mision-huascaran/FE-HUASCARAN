// Simulador del Dashboard (CU033, CU034 y CU035).
//
// DEVUELVE LA FORMA EXACTA DEL BACKEND: los mismos nombres y anidamientos que
// los modelos de `app/schemas/dashboard.py` (BCK-SICEDU), con su `contexto`.
// La respuesta pasa después por el mismo `adaptarX` de
// `api/resources/dashboard.js` que la del servidor real. Antes este archivo
// devolvía la forma que suponían las pantallas, y por eso las pruebas pasaban
// mientras contra el backend los bloques salían vacíos (S23). Si se cambia
// algo aquí, se cambia mirando el schema, no la pantalla.
//
// No busca parecerse a los números reales: busca reproducir los ESTADOS que la
// pantalla tiene que distinguir, que es lo único que no se puede probar con
// datos bonitos. Por eso el simulador siembra a propósito:
//
//   · un colegio con el periodo sin iniciar (Yanama), que no suma y va aparte
//     en `colegios_sin_informacion` —no como 0 alumnos—;
//   · un colegio sin ningún registro de lectura (Tinco), que queda sin
//     promedio y sin posición —no como 0 libros—;
//   · meses `futuro`, que no dibujan punto ni valor;
//   · el mes en curso (`en_curso`), que es un acumulado y no un cierre;
//   · un grupo con evaluaciones pendientes (`evaluacion_incompleta`), cuya
//     posición es provisional, y otro sin ninguna evaluación completa, que
//     va en `sin_evaluaciones`;
//   · una clase con `registro_incompleto` y otra en `clases_sin_registro`.
//
// Si alguno de esos casos deja de llegar, la pantalla que los pinta deja de
// estar probada aunque todo "funcione".
import dayjs from 'dayjs'
import * as db from './db'

const ANIO = db.ANIO_LECTIVO

/** Los PA del calendario del simulador (los mismos ids que `handlers.js`). */
const PERIODOS_ACADEMICOS = [
  { id: 31, numero: 1, nombre: 'Primer periodo', inicio: `${ANIO}-03-02`, fin: `${ANIO}-05-15` },
  { id: 32, numero: 2, nombre: 'Segundo periodo', inicio: `${ANIO}-06-01`, fin: `${ANIO}-07-31` },
  { id: 33, numero: 3, nombre: 'Tercer periodo', inicio: `${ANIO}-08-16`, fin: `${ANIO}-10-31` },
  { id: 34, numero: 4, nombre: 'Cuarto periodo', inicio: `${ANIO}-11-09`, fin: `${ANIO}-11-30` },
]

const ANIOS = [
  { id: 1, nombre: String(ANIO - 1) },
  { id: 2, nombre: String(ANIO) },
  { id: 3, nombre: String(ANIO + 1) },
]

/** Los cuatro niveles de desempeño, en el orden del índice 1 a 4 de CU033. */
const NIVELES = ['Inicio', 'En proceso', 'Logrado', 'Avanzado']
/** La escala del nivel alfabético, que no es la de Inicio a Avanzado. */
const NIVELES_ALFABETICOS = ['Presilábico', 'Silábico', 'Silábico alfabético', 'Alfabético']

/** El que todavía no empezó su periodo: va aparte, no como cero. */
const COLEGIO_SIN_PERIODO = 5
/** El que no tiene ningún registro de lectura: sin promedio y sin posición. */
const COLEGIO_SIN_LECTURA = 9

const hoy = () => dayjs()
const HOY = () => hoy().format('YYYY-MM-DD')

/** `ItemCatalogo` del backend: `{id, nombre}`. */
const item = (id, nombre) => ({ id, nombre })
const itemColegio = (c) => item(c.id_colegio, c.nombre)
const itemGrado = (g) => item(g.id_grado, g.nombre)
const itemPrograma = (p) => item(p.id_programa, p.nombre)
const SECCION = item(1, 'Única')

const unDecimal = (valor) => Number(valor.toFixed(1))
const dosDecimales = (valor) => Number(valor.toFixed(2))

function errorMock(status, detail, motivo, extra = {}) {
  const error = new Error(detail)
  error.response = { status, data: { detail, motivo, ...extra } }
  return error
}

/**
 * Los colegios de la consulta, validando como el backend.
 *
 * Las dos reglas que más se equivocan al integrar: `todos_los_colegios` junto
 * con `id_colegios` es 422, y una selección vacía NO es "todos".
 */
function colegiosDe(params = {}) {
  const pedidos = [].concat(params.id_colegios ?? []).map(Number).filter(Boolean)
  if (params.todos_los_colegios && pedidos.length) {
    throw errorMock(422, 'No combines "Todos los colegios" con una lista de colegios.', 'validacion')
  }
  if (!params.todos_los_colegios && !pedidos.length) {
    throw errorMock(422, 'Selecciona un año escolar y al menos un colegio.', 'validacion', {
      errores: [{ campo: 'id_colegios', mensaje: 'Selecciona un año escolar y al menos un colegio.' }],
    })
  }
  const todos = db.COLEGIOS
  return params.todos_los_colegios ? todos : todos.filter((c) => pedidos.includes(c.id_colegio))
}

/** El colegio de un detalle tiene que estar en la selección (422 si no). */
function colegioDeLaSeleccion(colegios, idColegio, campo = 'id_colegio') {
  const colegio = colegios.find((c) => c.id_colegio === Number(idColegio))
  if (!colegio) {
    throw errorMock(422, 'El colegio no está en la selección.', 'validacion', {
      errores: [{ campo, mensaje: 'El colegio no está en la selección.' }],
    })
  }
  return colegio
}

function anioDe(params = {}) {
  const anio = ANIOS.find((a) => a.id === Number(params.id_anio_escolar))
  if (!anio) throw errorMock(422, 'Selecciona un año escolar.', 'validacion')
  return anio
}

function periodoDe(params = {}, { obligatorio = true } = {}) {
  const id = Number(params.id_periodo_academico) || null
  if (!obligatorio) {
    if (id) throw errorMock(422, 'Este indicador es anual: no elijas un periodo académico.', 'validacion')
    return null
  }
  if (!id) {
    throw errorMock(422, 'Selecciona un periodo académico.', 'validacion', {
      errores: [{ campo: 'id_periodo_academico', mensaje: 'Selecciona un periodo académico.' }],
    })
  }
  const periodo = PERIODOS_ACADEMICOS.find((p) => p.id === id)
  if (!periodo) throw errorMock(422, 'El periodo académico no pertenece al año seleccionado.', 'validacion')
  return periodo
}

/** `ContextoDashboard`: qué representa la respuesta. */
function contextoDe(params, colegios, periodo = null) {
  const intervalo = periodo
    ? { desde: periodo.inicio, hasta: periodo.fin }
    : { desde: `${ANIO}-03-01`, hasta: `${ANIO}-12-31` }
  return {
    anio_escolar: anioDe(params),
    periodo: periodo && { id: periodo.id, numero: periodo.numero, nombre: periodo.nombre },
    colegios: colegios.map(itemColegio),
    alcance: params.todos_los_colegios ? 'todos' : colegios.length === 1 ? 'uno' : 'varios',
    fecha_consulta: hoy().toISOString(),
    intervalo,
    parcial: HOY() <= intervalo.hasta,
  }
}

/** Los que sí cuentan, y los que se informan aparte con su motivo. */
function reparto(colegios) {
  return {
    activos: colegios.filter((c) => c.id_colegio !== COLEGIO_SIN_PERIODO),
    sinInformacion: colegios
      .filter((c) => c.id_colegio === COLEGIO_SIN_PERIODO)
      .map((c) => ({ colegio: itemColegio(c), motivo: 'periodo_no_iniciado' })),
  }
}

/** La pertenencia se mira al terminar el PA, o hoy si sigue en curso. */
const fechasDeCorte = (activos, periodo) => {
  const fecha = HOY() <= periodo.fin ? HOY() : periodo.fin
  return activos.map((c) => ({ colegio: itemColegio(c), fecha }))
}

const alumnosDe = (colegios) => {
  const ids = new Set(colegios.map((c) => c.id_colegio))
  return db.ALUMNOS.filter((a) => ids.has(a.id_colegio))
}

/** Reparte los evaluados entre los niveles, estable por semilla. Todos los niveles, también los de 0. */
function distribuirNiveles(evaluados, semilla, nombres = NIVELES) {
  const random = db.crearRandom(semilla)
  const pesos = nombres.map(() => 0.5 + random())
  const suma = pesos.reduce((a, b) => a + b, 0)
  const cantidades = pesos.map((p) => Math.floor((p / suma) * evaluados))
  cantidades[0] += evaluados - cantidades.reduce((a, b) => a + b, 0)
  return nombres.map((nombre, i) => ({
    nombre,
    alumnos: cantidades[i],
    porcentaje: evaluados ? unDecimal((cantidades[i] / evaluados) * 100) : null,
  }))
}

/** Índice 1 a 4 de CU033 sobre los evaluados. */
function indiceDe(niveles) {
  const evaluados = niveles.reduce((a, n) => a + n.alumnos, 0)
  if (!evaluados) return null
  const suma = niveles.reduce((a, n, i) => a + n.alumnos * (i + 1), 0)
  return dosDecimales(suma / evaluados)
}

/** Posiciones con empate compartido y salto (1, 1, 3), en orden alfabético dentro del empate. */
function conPosicion(filas, valorDe, nombreDe) {
  const ordenadas = [...filas].sort(
    (a, b) => valorDe(b) - valorDe(a) || nombreDe(a).localeCompare(nombreDe(b), 'es'),
  )
  let anterior = null
  let posicion = 0
  return ordenadas.map((fila, i) => {
    if (valorDe(fila) !== anterior) {
      posicion = i + 1
      anterior = valorDe(fila)
    }
    return { ...fila, posicion }
  })
}

/** Los meses del año escolar, con su año: el calendario puede abarcar dos. */
function mesesDelAnio() {
  return Array.from({ length: 10 }, (_, i) => {
    const fecha = dayjs(`${ANIO}-03-01`).add(i, 'month')
    return { anio: fecha.year(), mes: fecha.month() + 1 }
  })
}

/** Los meses dentro de un PA, que es lo que pide el gráfico de asistencia. */
function mesesDePeriodo(periodo) {
  const fin = dayjs(periodo.fin)
  const meses = []
  let cursor = dayjs(periodo.inicio).startOf('month')
  while (cursor.isBefore(fin) || cursor.isSame(fin, 'month')) {
    meses.push({ anio: cursor.year(), mes: cursor.month() + 1 })
    cursor = cursor.add(1, 'month')
  }
  return meses
}

/** Pasado, en curso o futuro: "no se registró" no es "todavía no ha pasado". */
function tiempoDeMes({ mes, anio }) {
  const ahora = hoy()
  if (anio > ahora.year() || (anio === ahora.year() && mes > ahora.month() + 1)) return 'futuro'
  if (anio === ahora.year() && mes === ahora.month() + 1) return 'en_curso'
  return 'pasado'
}

// ── Los once endpoints ──────────────────────────────────────────────────────

/** `FiltrosDisponibles`. */
export function filtros() {
  // Hoy cae en el PA3 del calendario del simulador, así que la selección
  // inicial es ese. Durante un receso, el PA inmediatamente anterior; si la
  // fecha quedara fuera de todo periodo, `null`: el CU prohíbe aproximar.
  const ahora = HOY()
  const actual = PERIODOS_ACADEMICOS.find((p) => ahora >= p.inicio && ahora <= p.fin)
  const anterior = [...PERIODOS_ACADEMICOS].reverse().find((p) => p.fin < ahora)
  const elegido = actual ?? anterior ?? null

  return {
    colegios: db.COLEGIOS.map(itemColegio),
    anios: ANIOS.map((a) => ({
      ...a,
      periodos: PERIODOS_ACADEMICOS.map(({ id, numero, nombre }) => ({ id, numero, nombre })),
    })),
    seleccion_inicial: elegido ? { id_anio_escolar: 2, id_periodo_academico: elegido.id } : null,
  }
}

/** `DistribucionSubprograma`. */
export function distribucionSubprograma(params) {
  const colegios = colegiosDe(params)
  const periodo = periodoDe(params)
  const { activos, sinInformacion } = reparto(colegios)
  const alumnos = alumnosDe(activos)
  const base = {
    contexto: contextoDe(params, colegios, periodo),
    fechas_corte: fechasDeCorte(activos, periodo),
    colegios_sin_informacion: sinInformacion,
  }

  if (!alumnos.length) {
    return { ...base, total: null, subprogramas: [], sin_datos: true, mensaje: 'No hay información disponible para esta selección.' }
  }

  const total = alumnos.length
  return {
    ...base,
    total,
    subprogramas: db.PROGRAMAS.map((p) => {
      const suyos = alumnos.filter((a) => a.id_programa === p.id_programa).length
      return { subprograma: itemPrograma(p), alumnos: suyos, porcentaje: unDecimal((suyos / total) * 100) }
    }),
    sin_datos: false,
    mensaje: null,
  }
}

/** `ResultadosAprendizaje`. */
export function resultadosAprendizaje(params) {
  const colegios = colegiosDe(params)
  const periodo = periodoDe(params)
  const { activos, sinInformacion } = reparto(colegios)
  const alumnos = alumnosDe(activos)

  const resultados = [
    { resultado: 'global', fuente: 'registro_vuelo' },
    { resultado: 'fluidez', fuente: 'rubrica' },
    { resultado: 'comprension', fuente: 'rubrica' },
  ]

  const subprogramas = db.PROGRAMAS.map((programa) => {
    const totalAEvaluar = alumnos.filter((a) => a.id_programa === programa.id_programa).length
    return {
      subprograma: itemPrograma(programa),
      // Por SUBPROGRAMA: lo mismo para las tres distribuciones.
      total_a_evaluar: totalAEvaluar,
      distribuciones: resultados.map(({ resultado, fuente }, i) => {
        // Pendientes POR DIMENSIÓN: un alumno puede tener Fluidez y seguir
        // pendiente en Comprensión, y CU033 lo dice expresamente.
        const pendientes = Math.min(totalAEvaluar, Math.round(totalAEvaluar * (0.06 + i * 0.05)))
        const evaluados = totalAEvaluar - pendientes
        return {
          resultado,
          fuente,
          niveles: distribuirNiveles(evaluados, programa.id_programa * 10 + i),
          evaluados,
          pendientes,
          base_porcentaje: 'evaluados',
          mensaje: evaluados ? null : 'No hay evaluaciones completas para esta selección.',
        }
      }),
    }
  })

  return {
    contexto: contextoDe(params, colegios, periodo),
    fechas_corte: fechasDeCorte(activos, periodo),
    colegios_sin_informacion: sinInformacion,
    subprogramas,
    sin_datos: alumnos.length === 0,
    mensaje: alumnos.length ? null : 'No hay información disponible para esta selección.',
  }
}

/** `ComparacionResultados`. */
export function comparacionResultados(params) {
  const colegios = colegiosDe(params)
  const periodo = periodoDe(params)
  const idPrograma = Number(params.id_programa)
  const programa = db.PROGRAMAS.find((p) => p.id_programa === idPrograma)
  if (!programa) {
    throw errorMock(422, 'Selecciona un subprograma.', 'validacion', {
      errores: [{ campo: 'id_programa', mensaje: 'Selecciona un subprograma.' }],
    })
  }
  const gradosPedidos = [].concat(params.id_grados ?? []).map(Number).filter(Boolean)
  if (!params.todos_los_grados && !gradosPedidos.length) {
    throw errorMock(422, 'Selecciona al menos un grado.', 'validacion', {
      errores: [{ campo: 'id_grados', mensaje: 'Selecciona al menos un grado.' }],
    })
  }
  const grados = params.todos_los_grados ? db.GRADOS : db.GRADOS.filter((g) => gradosPedidos.includes(g.id_grado))
  const { activos, sinInformacion } = reparto(colegios)
  const vista = params.vista === 'detalle_grado' ? 'detalle_grado' : 'resumen_colegio'
  const resultado = params.resultado ?? 'global'
  const global = resultado === 'global'
  const nombres = resultado === 'nivel_alfabetico' ? NIVELES_ALFABETICOS : NIVELES

  const ranking = []
  const sinEvaluaciones = []
  const noAplica = []

  /** Un grupo: un colegio entero, o una combinación de colegio y grado. */
  const medir = (colegio, grado) => {
    const suyos = db.ALUMNOS.filter(
      (a) =>
        a.id_colegio === colegio.id_colegio &&
        a.id_programa === idPrograma &&
        grados.some((g) => g.id_grado === a.id_grado) &&
        (!grado || a.id_grado === grado.id_grado),
    )
    const clave = { colegio: itemColegio(colegio), grado: grado ? itemGrado(grado) : null }
    // Un grupo sin ningún alumno del subprograma no es un cero: "No aplica".
    if (!suyos.length) {
      noAplica.push(clave)
      return
    }
    // El colegio 4 se queda sin ninguna evaluación completa: va aparte.
    const totalAEvaluar = suyos.length
    const pendientes =
      colegio.id_colegio === 4 ? totalAEvaluar : Math.round(totalAEvaluar * (colegio.id_colegio % 3 === 0 ? 0.15 : 0))
    const evaluados = totalAEvaluar - pendientes
    if (!evaluados) {
      sinEvaluaciones.push({ ...clave, total_a_evaluar: totalAEvaluar, evaluados, pendientes })
      return
    }
    const niveles = distribuirNiveles(evaluados, colegio.id_colegio * 7 + (grado?.id_grado ?? 0), nombres)
    ranking.push({
      posicion: null,
      provisional: global ? pendientes > 0 : null,
      evaluacion_incompleta: pendientes > 0,
      ...clave,
      indice: global ? indiceDe(niveles) : null,
      total_a_evaluar: totalAEvaluar,
      evaluados,
      pendientes,
      distribucion: niveles.map((n) => ({ codigo: n.nombre, alumnos: n.alumnos, porcentaje: n.porcentaje })),
    })
  }

  activos.forEach((colegio) =>
    vista === 'detalle_grado' ? grados.forEach((grado) => medir(colegio, grado)) : medir(colegio, null),
  )

  const nombreDe = (g) => `${g.colegio.nombre} ${g.grado?.nombre ?? ''}`
  return {
    contexto: contextoDe(params, colegios, periodo),
    fechas_corte: fechasDeCorte(activos, periodo),
    colegios_sin_informacion: sinInformacion,
    subprograma: itemPrograma(programa),
    grados: grados.map(itemGrado),
    vista,
    resultado,
    escala: nombres.map((nombre, i) => ({ codigo: nombre, nombre, valor_indice: global ? i + 1 : null })),
    // "Por dimensión" y "Por nivel alfabético" no llevan índice ni posición:
    // van en orden alfabético.
    ranking: global
      ? conPosicion(ranking, (g) => g.indice, nombreDe)
      : [...ranking].sort((a, b) => nombreDe(a).localeCompare(nombreDe(b), 'es')),
    sin_evaluaciones: sinEvaluaciones,
    no_aplica: noAplica,
  }
}

/** `ConteoAsistencia` estable por semilla: (P + T) / (P + T + A) × 100. */
function conteoDe(poblacion, semilla, { clases = 8, incompletas = 0, sinRegistro = 0 } = {}) {
  const r = db.crearRandom(semilla)
  const total = Math.max(1, Math.round(poblacion * 8))
  const ausentes = Math.round(total * (0.05 + r() * 0.05))
  const tardanzas = Math.round(total * (0.03 + r() * 0.03))
  const presentes = total - ausentes - tardanzas
  return {
    porcentaje: unDecimal(((presentes + tardanzas) / total) * 100),
    presentes,
    tardanzas,
    ausentes,
    sin_marcar: incompletas ? Math.max(1, Math.round(poblacion * 0.03)) : 0,
    clases_dictadas: clases,
    clases_incompletas: incompletas,
    clases_sin_registro: sinRegistro,
    provisional: incompletas > 0,
  }
}

/** `AsistenciaDelPeriodo`. */
export function asistencia(params) {
  const colegios = colegiosDe(params)
  const periodo = periodoDe(params)
  const { activos, sinInformacion } = reparto(colegios)
  const alumnos = alumnosDe(activos)

  const porColegio = activos.map((c) => {
    const suyos = db.ALUMNOS.filter((a) => a.id_colegio === c.id_colegio)
    return {
      ...conteoDe(suyos.length, db.SEMILLA + c.id_colegio, {
        clases: 8 + (c.id_colegio % 3),
        incompletas: c.id_colegio % 4 === 0 ? 1 : 0,
        sinRegistro: c.id_colegio % 5 === 0 ? 2 : 0,
      }),
      colegio: itemColegio(c),
    }
  })

  const suma = (campo) => porColegio.reduce((a, c) => a + c[campo], 0)
  const presentes = suma('presentes')
  const tardanzas = suma('tardanzas')
  const ausentes = suma('ausentes')
  const completadas = presentes + tardanzas + ausentes
  const resumen = {
    // Sobre el CONJUNTO, nunca el promedio de los porcentajes (CU033).
    porcentaje: completadas ? unDecimal(((presentes + tardanzas) / completadas) * 100) : null,
    presentes,
    tardanzas,
    ausentes,
    sin_marcar: suma('sin_marcar'),
    clases_dictadas: suma('clases_dictadas'),
    clases_incompletas: suma('clases_incompletas'),
    // Las programadas que ya pasaron sin ninguna asistencia: aparte, sin ausencias.
    clases_sin_registro: suma('clases_sin_registro'),
    provisional: porColegio.some((c) => c.provisional),
    asistencias_esperadas: completadas + suma('sin_marcar'),
    asistencias_completadas: completadas,
    mensaje: completadas ? null : 'Sin información',
  }

  return {
    contexto: contextoDe(params, colegios, periodo),
    resumen,
    mensual: mesesDePeriodo(periodo).map((mes) => {
      const tiempo = tiempoDeMes(mes)
      if (tiempo === 'futuro' || !alumnos.length) {
        return { ...mes, estado: tiempo === 'futuro' ? 'futuro' : 'sin_informacion', porcentaje: null }
      }
      const { porcentaje, presentes: p, tardanzas: t, ausentes: a, sin_marcar: s, provisional } = conteoDe(
        alumnos.length / 3,
        db.SEMILLA + mes.mes * 13,
      )
      return {
        ...mes,
        estado: tiempo === 'en_curso' ? 'en_curso' : 'con_datos',
        porcentaje,
        presentes: p,
        tardanzas: t,
        ausentes: a,
        sin_marcar: s,
        provisional,
      }
    }),
    por_colegio: porColegio,
    colegios_sin_informacion: sinInformacion,
  }
}

/** `AsistenciaPorClase`. */
export function asistenciaClases(params) {
  const colegios = colegiosDe(params)
  const periodo = periodoDe(params)
  const colegio = colegioDeLaSeleccion(colegios, params.id_colegio)
  const grados = params.id_grado ? db.GRADOS.filter((g) => g.id_grado === Number(params.id_grado)) : db.GRADOS

  const grupos = grados.map((grado) => {
    const lista = db.ALUMNOS.filter((a) => a.id_colegio === colegio.id_colegio && a.id_grado === grado.id_grado).length
    const fechaDe = (i) => dayjs(periodo.inicio).add(i * 9 + grado.id_grado, 'day').format('YYYY-MM-DD')
    const clases = [0, 1].map((i) => {
      // La segunda clase queda con alumnos sin marcar: "registro_incompleto".
      const sinMarcar = i === 1 ? Math.min(2, lista) : 0
      const ausentes = Math.round(lista * 0.08)
      const tardanzas = Math.round(lista * 0.05)
      const presentes = Math.max(0, lista - ausentes - tardanzas - sinMarcar)
      const conEstado = presentes + tardanzas + ausentes
      return {
        id_clase: colegio.id_colegio * 100 + grado.id_grado * 10 + i,
        fecha: fechaDe(i),
        tipo: 'habitual',
        reprogramada: false,
        lista_historica: lista,
        presentes,
        tardanzas,
        ausentes,
        sin_marcar: sinMarcar,
        porcentaje: conEstado ? unDecimal(((presentes + tardanzas) / conEstado) * 100) : null,
        estado: sinMarcar ? 'registro_incompleto' : 'completa',
      }
    })
    const suma = (campo) => clases.reduce((a, c) => a + c[campo], 0)
    const completadas = suma('presentes') + suma('tardanzas') + suma('ausentes')
    return {
      grado: itemGrado(grado),
      seccion: SECCION,
      resumen: {
        porcentaje: completadas ? unDecimal(((suma('presentes') + suma('tardanzas')) / completadas) * 100) : null,
        presentes: suma('presentes'),
        tardanzas: suma('tardanzas'),
        ausentes: suma('ausentes'),
        sin_marcar: suma('sin_marcar'),
        clases_dictadas: clases.length,
        clases_incompletas: clases.filter((c) => c.estado === 'registro_incompleto').length,
        clases_sin_registro: 1,
        provisional: clases.some((c) => c.estado === 'registro_incompleto'),
      },
      clases,
      // Programada, su fecha ya pasó y nadie la registró: sin conteos.
      clases_sin_registro: [
        { id_clase: null, fecha: fechaDe(2), tipo: 'habitual', reprogramada: false, fecha_original: fechaDe(2) },
      ],
    }
  })

  return { contexto: contextoDe(params, colegios, periodo), grupos }
}

/** Libros de un alumno en un mes: estable, con su hueco de "sin información". */
function libroDeAlumno(idAlumno, mes) {
  const tiempo = tiempoDeMes(mes)
  if (tiempo === 'futuro') return { ...mes, estado: 'futuro', total: null, en_curso: false }
  // Un mes de cada siete queda sin registros: "Sin información", que no es un cero.
  if ((idAlumno + mes.mes) % 7 === 0) return { ...mes, estado: 'sin_informacion', total: null, en_curso: false }
  const random = db.crearRandom(idAlumno * 31 + mes.mes)
  return { ...mes, estado: 'completo', total: Math.round(random() * 3), en_curso: tiempo === 'en_curso' }
}

/** Un conjunto de meses de varios alumnos, sumado: incompleto si a alguno le falta. */
function sumarMeses(porAlumno, meses) {
  return meses.map((mes, i) => {
    const tiempo = tiempoDeMes(mes)
    if (tiempo === 'futuro') return { ...mes, estado: 'futuro', total: null, en_curso: false }
    const delMes = porAlumno.map((m) => m[i])
    const conDatos = delMes.filter((m) => m.total != null)
    if (!conDatos.length) return { ...mes, estado: 'sin_informacion', total: null, en_curso: false }
    return {
      ...mes,
      estado: conDatos.length < delMes.length ? 'incompleto' : 'completo',
      total: conDatos.reduce((a, m) => a + m.total, 0),
      en_curso: tiempo === 'en_curso',
    }
  })
}

/** El total y el estado de un conjunto de meses. */
function totalDe(meses) {
  const conDatos = meses.filter((m) => m.total != null)
  if (!conDatos.length) return { total: null, estado: 'sin_informacion' }
  const incompleto = meses.some((m) => m.estado === 'incompleto' || m.estado === 'sin_informacion')
  return { total: conDatos.reduce((a, m) => a + m.total, 0), estado: incompleto ? 'incompleto' : 'completo' }
}

/** Un colegio con sus alumnos y meses (Tinco, sin ningún registro). */
function librosDelColegio(colegio, meses) {
  const alumnos = db.ALUMNOS.filter((a) => a.id_colegio === colegio.id_colegio)
  const porAlumno = alumnos.map((a) =>
    colegio.id_colegio === COLEGIO_SIN_LECTURA
      ? meses.map((m) => ({ ...m, estado: tiempoDeMes(m) === 'futuro' ? 'futuro' : 'sin_informacion', total: null, en_curso: false }))
      : meses.map((m) => libroDeAlumno(a.id_alumno, m)),
  )
  return { alumnos, porAlumno, meses: sumarMeses(porAlumno, meses) }
}

/** `ResumenLibros`. */
function resumenLibros(total, estado, alumnosIncluidos) {
  const conPromedio = total != null && alumnosIncluidos > 0
  return {
    total,
    estado,
    provisional: estado === 'incompleto',
    alumnos_incluidos: alumnosIncluidos,
    promedio: conPromedio ? dosDecimales(total / alumnosIncluidos) : null,
    etiqueta: estado === 'incompleto' ? 'Total registrado hasta el momento' : null,
  }
}

/** `LibrosDelAnio`. */
export function libros(params) {
  const colegios = colegiosDe(params)
  periodoDe(params, { obligatorio: false })
  const meses = mesesDelAnio()

  const filas = colegios.map((colegio) => {
    const suyo = librosDelColegio(colegio, meses)
    const { total, estado } = totalDe(suyo.meses)
    return { colegio, suyo, total, estado, alumnosIncluidos: suyo.alumnos.length }
  })

  const conPromedio = filas.filter((f) => f.total != null && f.alumnosIncluidos > 0)
  const mesesTotales = sumarMeses(conPromedio.map((f) => f.suyo.meses), meses)
  const { total, estado } = totalDe(mesesTotales)
  const alumnosIncluidos = conPromedio.reduce((a, f) => a + f.alumnosIncluidos, 0)

  const ranking = conPromedio.map((f) => ({
    posicion: null,
    provisional: f.estado === 'incompleto',
    colegio: itemColegio(f.colegio),
    total: f.total,
    estado: f.estado,
    alumnos_incluidos: f.alumnosIncluidos,
    promedio: dosDecimales(f.total / f.alumnosIncluidos),
    meses: f.suyo.meses,
  }))

  return {
    contexto: contextoDe(params, colegios),
    resumen: resumenLibros(total, estado, alumnosIncluidos),
    meses: mesesTotales,
    colegios: conPosicion(ranking, (c) => c.promedio, (c) => c.colegio.nombre),
    colegios_sin_informacion: filas
      .filter((f) => !conPromedio.includes(f))
      .map((f) => ({
        colegio: itemColegio(f.colegio),
        alumnos_incluidos: f.alumnosIncluidos,
        motivo: f.alumnosIncluidos ? 'sin_informacion' : 'sin_alumnos',
      })),
  }
}

/** `LibrosDelColegio`. */
export function librosDeColegio(idColegio, params = {}) {
  const colegios = colegiosDe(params)
  periodoDe(params, { obligatorio: false })
  const colegio = colegioDeLaSeleccion(colegios, idColegio)
  const meses = mesesDelAnio()
  const suyo = librosDelColegio(colegio, meses)

  const grados = db.GRADOS.map((grado) => {
    const indices = suyo.alumnos.map((a, i) => (a.id_grado === grado.id_grado ? i : -1)).filter((i) => i >= 0)
    const mesesDelGrado = sumarMeses(indices.map((i) => suyo.porAlumno[i]), meses)
    const { total, estado } = totalDe(mesesDelGrado)
    const alumnosIncluidos = indices.length
    const conPromedio = total != null && alumnosIncluidos > 0
    return {
      posicion: null,
      provisional: estado === 'incompleto',
      grado: itemGrado(grado),
      total,
      estado,
      alumnos_incluidos: alumnosIncluidos,
      promedio: conPromedio ? dosDecimales(total / alumnosIncluidos) : null,
      alumnos: indices.map((i) => {
        const alumno = suyo.alumnos[i]
        const propios = suyo.porAlumno[i]
        // Apellidos primero, como el resto de las tablas del sistema.
        return { alumno: item(alumno.id_alumno, db.nombreCompleto(alumno)), ...totalDe(propios), meses: propios }
      }),
    }
  })

  const conPromedio = grados.filter((g) => g.promedio != null)
  const { total, estado } = totalDe(suyo.meses)

  return {
    contexto: contextoDe(params, colegios),
    colegio: itemColegio(colegio),
    resumen: resumenLibros(total, estado, total == null ? 0 : suyo.alumnos.length),
    meses: suyo.meses,
    grados: conPosicion(conPromedio, (g) => g.promedio, (g) => g.grado.nombre),
    grados_sin_informacion: grados.filter((g) => g.promedio == null),
  }
}

/** `DesgloseLibros`. */
export function librosDesglose(params = {}) {
  const colegios = colegiosDe(params)
  periodoDe(params, { obligatorio: false })
  const idAlumno = Number(params.id_alumno)
  const alumno = db.ALUMNOS.find((a) => a.id_alumno === idAlumno)
  if (!alumno || !colegios.some((c) => c.id_colegio === alumno.id_colegio)) {
    throw errorMock(422, 'El alumno no perteneció a ningún colegio seleccionado.', 'validacion', {
      errores: [{ campo: 'id_alumno', mensaje: 'El alumno no perteneció a ningún colegio seleccionado.' }],
    })
  }
  const mes = { anio: Number(params.anio) || ANIO, mes: Number(params.mes) }
  const dato =
    alumno.id_colegio === COLEGIO_SIN_LECTURA ? { total: null } : libroDeAlumno(idAlumno, mes)
  const base = {
    contexto: contextoDe(params, colegios),
    alumno: item(alumno.id_alumno, db.nombreCompleto(alumno)),
    anio: mes.anio,
    mes: mes.mes,
    total: dato.total,
  }
  if (dato.total == null) return { ...base, registros: [] }

  const colegio = db.COLEGIOS.find((c) => c.id_colegio === alumno.id_colegio)
  const grado = db.GRADOS.find((g) => g.id_grado === alumno.id_grado)
  const programa = db.PROGRAMAS.find((p) => p.id_programa === alumno.id_programa)
  const fila = (n, dia, extra) => ({
    id_lectura_semanal: idAlumno * 100 + mes.mes + n,
    clase_referencia: {
      id_clase: idAlumno * 10 + mes.mes + n,
      fecha: `${mes.anio}-${String(mes.mes).padStart(2, '0')}-${dia}`,
    },
    subprograma: itemPrograma(programa),
    colegio: itemColegio(colegio),
    grado: itemGrado(grado),
    seccion: SECCION,
    ...extra,
  })

  // La segunda semana: o "No realizada" (aporta 0 mientras la declaración siga
  // vigente, y eso NO es ausencia de información) o sin cantidades (null).
  const noRealizada = db.crearRandom(idAlumno * 17 + mes.mes)() < 0.5
  const lsn = dato.total > 0 ? 1 : 0
  return {
    ...base,
    registros: [
      fila(0, '10', { estado_tabla: 'normal', lsn, lsl: dato.total - lsn, total: dato.total }),
      fila(
        1,
        '24',
        noRealizada
          ? { estado_tabla: 'no_realizada', lsn: 0, lsl: 0, total: 0 }
          : { estado_tabla: 'normal', lsn: 0, lsl: null, total: null },
      ),
    ],
  }
}

/** `EvolucionAnual`. */
export function evolucionAnual(params) {
  const colegios = colegiosDe(params)
  periodoDe(params, { obligatorio: false })
  const hasta = anioDe(params).id

  // Solo años CON alumnos atendidos: un año sin datos no se dibuja como cero.
  // El año 1 del simulador no tiene nada, así que directamente no aparece.
  const anios = ANIOS.filter((a) => a.id <= hasta && a.id >= 2)
  const atendidos = colegios
    .map((c) => ({ colegio: itemColegio(c), alumnos_atendidos: alumnosDe([c]).length }))
    .filter((c) => c.alumnos_atendidos > 0)

  return {
    contexto: contextoDe(params, colegios),
    anios: anios.map((anio) => {
      const alumnos = alumnosDe(colegios).length
      return {
        anio_escolar: anio,
        parcial: anio.id === 2,
        alumnos_atendidos: alumnos,
        colegios_atendidos: atendidos.length,
        libros: { total: Math.round(alumnos * 1.4), estado: anio.id === 2 ? 'incompleto' : 'completo' },
        // Una LISTA, no el número de colegios: ese es `colegios_atendidos`.
        colegios: atendidos,
      }
    }),
    mensaje: anios.length < 2 ? 'No hay información de otros años para mostrar la evolución.' : null,
  }
}

const POBLACIONES = {
  nivel_global_alfabetizacion: 'alumnos evaluados',
  nivel_global_comprension: 'alumnos evaluados',
  asistencia: 'asistencias registradas',
  promedio_libros: 'alumnos incluidos',
}

/** `ComparacionColegios`. */
export function comparacionColegios(params = {}) {
  const colegios = colegiosDe(params)
  const indicador = params.indicador ?? 'nivel_global_alfabetizacion'
  const anual = indicador === 'promedio_libros'
  const periodo = periodoDe(params, { obligatorio: !anual })
  // El de libros es del año: ahí Yanama sí cuenta, porque su año sí empezó.
  const { activos, sinInformacion } = anual ? { activos: colegios, sinInformacion: [] } : reparto(colegios)

  const medidos = []
  const sinDatos = [...sinInformacion]
  activos.forEach((c) => {
    if (anual && c.id_colegio === COLEGIO_SIN_LECTURA) {
      sinDatos.push({ colegio: itemColegio(c), motivo: 'sin_informacion' })
      return
    }
    const random = db.crearRandom(c.id_colegio * 23 + indicador.length)
    const provisional = c.id_colegio % 4 === 0
    let valor = dosDecimales(1 + random() * 3)
    if (indicador === 'asistencia') valor = unDecimal(85 + random() * 12)
    else if (anual) valor = dosDecimales(0.8 + random() * 2)
    let advertencias = []
    if (provisional) {
      if (indicador === 'asistencia') advertencias = ['registro_incompleto']
      else advertencias = [anual ? 'informacion_incompleta' : 'evaluacion_incompleta']
    }
    medidos.push({
      posicion: null,
      provisional,
      colegio: itemColegio(c),
      valor,
      poblacion: { descripcion: POBLACIONES[indicador], cantidad: alumnosDe([c]).length },
      advertencias,
    })
  })

  let mensaje = null
  if (colegios.length < 2) mensaje = 'Selecciona al menos dos colegios para compararlos.'
  else if (medidos.length < 2) mensaje = 'No hay información suficiente de otros colegios para establecer una comparación.'

  return {
    contexto: contextoDe(params, colegios, periodo),
    indicador,
    intervalo: anual ? 'anio' : 'periodo',
    // Con un solo colegio comparable NO se asigna posición: el CU lo dice y es
    // lo que distingue "primero de nueve" de "el único que tiene datos".
    ranking: medidos.length > 1 ? conPosicion(medidos, (c) => c.valor, (c) => c.colegio.nombre) : medidos,
    sin_informacion: sinDatos,
    mensaje,
  }
}
