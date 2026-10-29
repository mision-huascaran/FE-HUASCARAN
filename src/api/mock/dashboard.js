// Simulador del Dashboard (CU033, CU034 y CU035).
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
//   · el mes en curso como `en_curso`, que es un acumulado y no un cierre;
//   · un grupo con evaluaciones pendientes (`evaluacion_incompleta`), cuya
//     posición es provisional, y otro sin ninguna evaluación completa, que
//     aparece sin índice;
//   · una clase con `registro_incompleto` y otra `sin_registro`.
//
// Si alguno de esos casos deja de llegar, la pantalla que los pinta deja de
// estar probada aunque todo "funcione".
import dayjs from 'dayjs'
import * as db from './db'

const ANIO = db.ANIO_LECTIVO

/** Los ids de PA del calendario del simulador (los mismos que `handlers.js`). */
const PERIODOS_ACADEMICOS = [
  { id_periodo_academico: 31, numero: 1, nombre: 'Primer periodo', inicio: `${ANIO}-03-02`, fin: `${ANIO}-05-15` },
  { id_periodo_academico: 32, numero: 2, nombre: 'Segundo periodo', inicio: `${ANIO}-06-01`, fin: `${ANIO}-07-31` },
  { id_periodo_academico: 33, numero: 3, nombre: 'Tercer periodo', inicio: `${ANIO}-08-16`, fin: `${ANIO}-10-31` },
  { id_periodo_academico: 34, numero: 4, nombre: 'Cuarto periodo', inicio: `${ANIO}-11-09`, fin: `${ANIO}-11-30` },
]

const ANIOS = [
  { id_anio_escolar: 1, nombre: String(ANIO - 1) },
  { id_anio_escolar: 2, nombre: String(ANIO) },
  { id_anio_escolar: 3, nombre: String(ANIO + 1) },
]

/** Los cuatro niveles de desempeño, en el orden del índice 1 a 4 de CU033. */
const NIVELES = ['Inicio', 'En proceso', 'Logrado', 'Avanzado']

/** El que todavía no empezó su periodo: va aparte, no como cero. */
const COLEGIO_SIN_PERIODO = 5
/** El que no tiene ningún registro de lectura: sin promedio y sin posición. */
const COLEGIO_SIN_LECTURA = 9

const hoy = () => dayjs()

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
  const periodo = PERIODOS_ACADEMICOS.find((p) => p.id_periodo_academico === id)
  if (!periodo) throw errorMock(422, 'El periodo académico no pertenece al año seleccionado.', 'validacion')
  return periodo
}

/** Los que sí cuentan, y los que se informan aparte con su motivo. */
function reparto(colegios) {
  return {
    activos: colegios.filter((c) => c.id_colegio !== COLEGIO_SIN_PERIODO),
    sinInformacion: colegios
      .filter((c) => c.id_colegio === COLEGIO_SIN_PERIODO)
      .map((c) => ({ id_colegio: c.id_colegio, nombre: c.nombre, motivo: 'periodo_no_iniciado' })),
  }
}

const alumnosDe = (colegios) => {
  const ids = new Set(colegios.map((c) => c.id_colegio))
  return db.ALUMNOS.filter((a) => ids.has(a.id_colegio))
}

/** Reparte una cantidad entre los cuatro niveles, estable por semilla. */
function distribuirNiveles(total, semilla) {
  const random = db.crearRandom(semilla)
  const pesos = NIVELES.map(() => 0.5 + random())
  const suma = pesos.reduce((a, b) => a + b, 0)
  const cantidades = pesos.map((p) => Math.floor((p / suma) * total))
  cantidades[0] += total - cantidades.reduce((a, b) => a + b, 0)
  return NIVELES.map((nombre, i) => ({
    nombre,
    cantidad: cantidades[i],
    porcentaje: total ? Number(((cantidades[i] / total) * 100).toFixed(1)) : null,
  }))
}

/** Índice 1 a 4 de CU033: suma de valores entre alumnos con evaluación completa. */
function indiceDe(niveles) {
  const evaluados = niveles.reduce((a, n) => a + n.cantidad, 0)
  if (!evaluados) return null
  const suma = niveles.reduce((a, n, i) => a + n.cantidad * (i + 1), 0)
  return Number((suma / evaluados).toFixed(4))
}

/** Posiciones con empate compartido y salto (1, 1, 3), como pide CU033. */
function conPosicion(filas, campo = 'indice') {
  const ordenadas = [...filas].sort((a, b) => {
    if (a[campo] == null) return 1
    if (b[campo] == null) return -1
    if (b[campo] !== a[campo]) return b[campo] - a[campo]
    return a.nombre.localeCompare(b.nombre, 'es')
  })
  let anterior = null
  let posicion = 0
  return ordenadas.map((fila, i) => {
    if (fila[campo] !== anterior) {
      posicion = i + 1
      anterior = fila[campo]
    }
    return { ...fila, posicion: fila[campo] == null ? null : posicion }
  })
}

/** Los meses del año escolar, con su año: el calendario abarca dos. */
function mesesDelAnio() {
  return Array.from({ length: 10 }, (_, i) => {
    const fecha = dayjs(`${ANIO}-03-01`).add(i, 'month')
    return { mes: fecha.month() + 1, anio: fecha.year(), nombre: fecha.format('MMMM') }
  })
}

/** Los meses dentro de un PA, que es lo que pide el gráfico de asistencia. */
function mesesDePeriodo(periodo) {
  const fin = dayjs(periodo.fin)
  const meses = []
  let cursor = dayjs(periodo.inicio).startOf('month')
  while (cursor.isBefore(fin) || cursor.isSame(fin, 'month')) {
    meses.push({ mes: cursor.month() + 1, anio: cursor.year(), nombre: cursor.format('MMMM') })
    cursor = cursor.add(1, 'month')
  }
  return meses
}

/**
 * El estado temporal de un mes: pasado, en curso o futuro.
 *
 * Es la diferencia entre "no se registró" y "todavía no ha pasado", que es
 * justo lo que los CU prohíben confundir.
 */
function estadoDeMes({ mes, anio }) {
  const ahora = hoy()
  if (anio > ahora.year() || (anio === ahora.year() && mes > ahora.month() + 1)) return 'futuro'
  if (anio === ahora.year() && mes === ahora.month() + 1) return 'en_curso'
  return 'completo'
}

const MESES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
const nombreDeMes = ({ mes, anio }) => `${MESES_ES[mes - 1]} ${anio}`

// ── Los once bloques ────────────────────────────────────────────────────────

export function filtros() {
  // Hoy cae en el PA3 del calendario del simulador, así que la selección
  // inicial es ese. Si la fecha quedara fuera de todo periodo, `null`: el CU
  // prohíbe aproximar y la pantalla pide los filtros.
  const ahora = hoy().format('YYYY-MM-DD')
  const actual = PERIODOS_ACADEMICOS.find((p) => ahora >= p.inicio && ahora <= p.fin)
  // Durante un receso, el PA inmediatamente anterior (CU033).
  const anterior = [...PERIODOS_ACADEMICOS].reverse().find((p) => p.fin < ahora)
  const elegido = actual ?? anterior ?? null

  return {
    colegios: db.COLEGIOS.map((c) => ({ id_colegio: c.id_colegio, nombre: c.nombre })),
    anios: ANIOS.map((a) => ({
      ...a,
      periodos: PERIODOS_ACADEMICOS.map(({ id_periodo_academico, numero, nombre }) => ({
        id_periodo_academico,
        numero,
        nombre,
      })),
    })),
    seleccion_inicial: elegido
      ? {
          id_anio_escolar: 2,
          id_periodo_academico: elegido.id_periodo_academico,
          todos_los_colegios: true,
        }
      : null,
  }
}

export function distribucionSubprograma(params) {
  const colegios = colegiosDe(params)
  const periodo = periodoDe(params)
  const { activos, sinInformacion } = reparto(colegios)
  const alumnos = alumnosDe(activos)

  if (!alumnos.length) {
    return { sin_datos: true, total: null, subprogramas: [], fechas_corte: [], colegios_sin_informacion: sinInformacion }
  }

  // CU033: la pertenencia se mira al terminar el PA, o a la fecha de consulta
  // si está en curso. Esa fecha se muestra junto al indicador.
  const enCurso = hoy().format('YYYY-MM-DD') <= periodo.fin
  const corte = enCurso ? hoy().format('YYYY-MM-DD') : periodo.fin

  const total = alumnos.length
  return {
    total,
    en_curso: enCurso,
    estado: 'con_datos',
    subprogramas: db.PROGRAMAS.map((p) => {
      const cantidad = alumnos.filter((a) => a.id_programa === p.id_programa).length
      return {
        id_programa: p.id_programa,
        nombre: p.nombre,
        cantidad,
        porcentaje: Number(((cantidad / total) * 100).toFixed(1)),
      }
    }),
    fechas_corte: activos.map((c) => ({ id_colegio: c.id_colegio, nombre: c.nombre, fecha: corte })),
    colegios_sin_informacion: sinInformacion,
  }
}

export function resultadosAprendizaje(params) {
  const colegios = colegiosDe(params)
  const periodo = periodoDe(params)
  const { activos, sinInformacion } = reparto(colegios)
  const alumnos = alumnosDe(activos)

  const dimensiones = [
    { clave: 'global', nombre: 'Nivel global' },
    { clave: 'fluidez', nombre: 'Fluidez Lectora' },
    { clave: 'comprension', nombre: 'Comprensión Lectora' },
  ]

  const programas = db.PROGRAMAS.map((programa) => {
    const suyos = alumnos.filter((a) => a.id_programa === programa.id_programa)
    return {
      id_programa: programa.id_programa,
      nombre: programa.nombre,
      dimensiones: dimensiones.map((dimension, i) => {
        const aEvaluar = suyos.length
        // Pendientes POR DIMENSIÓN: un alumno puede tener Fluidez y seguir
        // pendiente en Comprensión, y CU033 lo dice expresamente.
        const pendientes = Math.min(aEvaluar, Math.round(aEvaluar * (0.06 + i * 0.05)))
        const evaluados = aEvaluar - pendientes
        return {
          clave: dimension.clave,
          nombre: dimension.nombre,
          a_evaluar: aEvaluar,
          evaluados,
          pendientes,
          estado: evaluados ? (pendientes ? 'evaluacion_incompleta' : 'completo') : 'sin_evaluaciones',
          niveles: evaluados ? distribuirNiveles(evaluados, programa.id_programa * 10 + i) : [],
        }
      }),
    }
  })

  return {
    periodo: { id_periodo_academico: periodo.id_periodo_academico, nombre: periodo.nombre },
    programas,
    colegios_sin_informacion: sinInformacion,
  }
}

export function comparacionResultados(params) {
  const colegios = colegiosDe(params)
  periodoDe(params)
  const idPrograma = Number(params.id_programa)
  if (!idPrograma) {
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

  /** Un grupo: un colegio entero, o una combinación de colegio y grado. */
  const grupoDe = (colegio, grado) => {
    const suyos = db.ALUMNOS.filter(
      (a) =>
        a.id_colegio === colegio.id_colegio &&
        a.id_programa === idPrograma &&
        grados.some((g) => g.id_grado === a.id_grado) &&
        (!grado || a.id_grado === grado.id_grado),
    )
    const aEvaluar = suyos.length
    // Un grupo sin ningún alumno del subprograma no es un cero: es "No
    // aplica", porque ahí ese subprograma no está configurado.
    if (!aEvaluar) {
      return {
        id_colegio: colegio.id_colegio,
        colegio: colegio.nombre,
        id_grado: grado?.id_grado ?? null,
        grado: grado?.nombre ?? null,
        nombre: grado ? `${colegio.nombre} · ${grado.nombre}` : colegio.nombre,
        estado: 'no_aplica',
        indice: null,
        a_evaluar: 0,
        evaluados: 0,
        pendientes: 0,
        niveles: [],
      }
    }
    // El colegio 4 se queda sin ninguna evaluación completa: ese grupo va
    // aparte, sin índice ni posición.
    const todoPendiente = colegio.id_colegio === 4
    const pendientes = todoPendiente ? aEvaluar : Math.round(aEvaluar * (colegio.id_colegio % 3 === 0 ? 0.15 : 0))
    const evaluados = aEvaluar - pendientes
    const niveles = evaluados ? distribuirNiveles(evaluados, colegio.id_colegio * 7 + (grado?.id_grado ?? 0)) : []
    return {
      id_colegio: colegio.id_colegio,
      colegio: colegio.nombre,
      id_grado: grado?.id_grado ?? null,
      grado: grado?.nombre ?? null,
      nombre: grado ? `${colegio.nombre} · ${grado.nombre}` : colegio.nombre,
      estado: evaluados ? (pendientes ? 'evaluacion_incompleta' : 'completo') : 'sin_evaluaciones',
      provisional: pendientes > 0 && evaluados > 0,
      indice: resultado === 'global' ? indiceDe(niveles) : null,
      a_evaluar: aEvaluar,
      evaluados,
      pendientes,
      niveles,
    }
  }

  const todos = activos.flatMap((colegio) =>
    vista === 'detalle_grado' ? grados.map((grado) => grupoDe(colegio, grado)) : [grupoDe(colegio, null)],
  )

  const comparables = todos.filter((g) => g.estado === 'completo' || g.estado === 'evaluacion_incompleta')

  return {
    vista,
    resultado,
    id_programa: idPrograma,
    programa: db.PROGRAMAS.find((p) => p.id_programa === idPrograma)?.nombre ?? null,
    grados: grados.map((g) => ({ id_grado: g.id_grado, nombre: g.nombre })),
    // "Por dimensión" y "Por nivel alfabético" no llevan índice: CU033 prohíbe
    // aplicarles la escala de 1 a 4 del nivel global.
    grupos: resultado === 'global' ? conPosicion(comparables) : comparables.map((g) => ({ ...g, posicion: null })),
    sin_evaluaciones: todos.filter((g) => g.estado === 'sin_evaluaciones'),
    no_aplica: todos.filter((g) => g.estado === 'no_aplica'),
    colegios_sin_informacion: sinInformacion,
  }
}

export function asistencia(params) {
  const colegios = colegiosDe(params)
  const periodo = periodoDe(params)
  const { activos, sinInformacion } = reparto(colegios)
  const alumnos = alumnosDe(activos)

  if (!alumnos.length) {
    return { resumen: { estado: 'sin_informacion', porcentaje: null }, mensual: [], colegios: [], colegios_sin_informacion: sinInformacion }
  }

  const random = db.crearRandom(db.SEMILLA + periodo.id_periodo_academico)
  const marcasDe = (poblacion, semilla) => {
    const r = db.crearRandom(semilla)
    const total = Math.max(1, Math.round(poblacion * 8))
    const ausentes = Math.round(total * (0.05 + r() * 0.05))
    const tardanzas = Math.round(total * (0.03 + r() * 0.03))
    const presentes = total - ausentes - tardanzas
    // (Presentes + Tardanzas) ÷ (Presentes + Tardanzas + Ausentes) × 100.
    // Nunca el promedio de los porcentajes: CU033 lo prohíbe en negrita.
    const porcentaje = Number((((presentes + tardanzas) / total) * 100).toFixed(1))
    return { presentes, tardanzas, ausentes, porcentaje, sin_marcar: Math.round(poblacion * 0.03) }
  }

  const porColegio = conPosicion(
    activos.map((c) => {
      const suyos = db.ALUMNOS.filter((a) => a.id_colegio === c.id_colegio)
      const marcas = marcasDe(suyos.length, db.SEMILLA + c.id_colegio)
      return {
        id_colegio: c.id_colegio,
        nombre: c.nombre,
        ...marcas,
        clases_dictadas: 8 + (c.id_colegio % 3),
        clases_registro_incompleto: c.id_colegio % 4 === 0 ? 1 : 0,
        clases_sin_registro: c.id_colegio % 5 === 0 ? 2 : 0,
        estado: c.id_colegio % 4 === 0 ? 'registro_incompleto' : 'con_datos',
        provisional: c.id_colegio % 4 === 0,
      }
    }),
    'porcentaje',
  )

  const global = marcasDe(alumnos.length, db.SEMILLA)

  return {
    periodo: { id_periodo_academico: periodo.id_periodo_academico, nombre: periodo.nombre },
    resumen: {
      ...global,
      estado: 'con_datos',
      clases_dictadas: porColegio.reduce((a, c) => a + c.clases_dictadas, 0),
      clases_registro_incompleto: porColegio.reduce((a, c) => a + c.clases_registro_incompleto, 0),
      // Las programadas que ya pasaron y no tienen ninguna asistencia: se
      // advierten aparte y NO generan ausencias.
      clases_sin_registro: porColegio.reduce((a, c) => a + c.clases_sin_registro, 0),
      provisional: porColegio.some((c) => c.provisional),
    },
    mensual: mesesDePeriodo(periodo).map((mes) => {
      const estado = estadoDeMes(mes)
      if (estado === 'futuro') return { ...mes, nombre: nombreDeMes(mes), estado, porcentaje: null }
      const marcas = marcasDe(alumnos.length / 3, db.SEMILLA + mes.mes * 13)
      return {
        ...mes,
        nombre: nombreDeMes(mes),
        estado,
        en_curso: estado === 'en_curso',
        ...marcas,
      }
    }),
    colegios: porColegio,
    colegios_sin_informacion: sinInformacion,
    // Una semilla consumida para que el reparto no dependa del orden de las
    // llamadas: el simulador tiene que dar lo mismo en cada recarga.
    _semilla: random(),
  }
}

export function asistenciaClases(params) {
  const colegios = colegiosDe(params)
  const periodo = periodoDe(params)
  const colegio = colegios[0]
  const grados = params.id_grado ? db.GRADOS.filter((g) => g.id_grado === Number(params.id_grado)) : db.GRADOS

  const items = grados.flatMap((grado) =>
    Array.from({ length: 3 }, (_, i) => {
      const fecha = dayjs(periodo.inicio).add(i * 9 + grado.id_grado, 'day')
      const alumnos = db.ALUMNOS.filter(
        (a) => a.id_colegio === colegio.id_colegio && a.id_grado === grado.id_grado,
      ).length
      // La tercera clase de cada grado va "Sin registro": programada, su fecha
      // ya pasó y no tiene ninguna asistencia confirmada. No se considera
      // dictada ni genera ausencias.
      if (i === 2) {
        return {
          id_clase: null,
          fecha: fecha.format('YYYY-MM-DD'),
          grado: { id: grado.id_grado, nombre: grado.nombre },
          seccion: { id: 1, nombre: 'Única' },
          alumnos,
          estado: 'sin_registro',
          porcentaje: null,
        }
      }
      const sinMarcar = i === 1 ? 2 : 0
      const ausentes = Math.max(0, Math.round(alumnos * 0.08))
      const tardanzas = Math.max(0, Math.round(alumnos * 0.05))
      const presentes = Math.max(0, alumnos - ausentes - tardanzas - sinMarcar)
      const conEstado = presentes + tardanzas + ausentes
      return {
        id_clase: colegio.id_colegio * 100 + grado.id_grado * 10 + i,
        fecha: fecha.format('YYYY-MM-DD'),
        grado: { id: grado.id_grado, nombre: grado.nombre },
        seccion: { id: 1, nombre: 'Única' },
        alumnos,
        presentes,
        tardanzas,
        ausentes,
        sin_marcar: sinMarcar,
        porcentaje: conEstado ? Number((((presentes + tardanzas) / conEstado) * 100).toFixed(1)) : null,
        estado: sinMarcar ? 'registro_incompleto' : 'completo',
        provisional: sinMarcar > 0,
      }
    }),
  )

  return {
    colegio: { id_colegio: colegio.id_colegio, nombre: colegio.nombre },
    periodo: { id_periodo_academico: periodo.id_periodo_academico, nombre: periodo.nombre },
    items,
  }
}

/** Libros de un alumno en un mes, estable y con su hueco de "sin información". */
function librosDe(idAlumno, mes) {
  const random = db.crearRandom(idAlumno * 31 + mes.mes)
  const estado = estadoDeMes(mes)
  if (estado === 'futuro') return { cantidad: null, estado }
  // Un mes de cada siete queda sin registro esperado: "Información incompleta",
  // que no es un cero.
  if ((idAlumno + mes.mes) % 7 === 0) return { cantidad: null, estado: 'incompleto' }
  const cantidad = Math.round(random() * 3)
  return { cantidad, estado: estado === 'en_curso' ? 'en_curso' : 'completo' }
}

export function libros(params) {
  const colegios = colegiosDe(params)
  periodoDe(params, { obligatorio: false })
  const meses = mesesDelAnio()

  const filas = colegios.map((colegio) => {
    const suyos = db.ALUMNOS.filter((a) => a.id_colegio === colegio.id_colegio)
    // Tinco no tiene ningún registro: sin promedio y sin posición, nunca 0.
    if (colegio.id_colegio === COLEGIO_SIN_LECTURA) {
      return {
        id_colegio: colegio.id_colegio,
        nombre: colegio.nombre,
        meses: meses.map((m) => ({ ...m, nombre: nombreDeMes(m), cantidad: null, estado: 'sin_informacion' })),
        total: null,
        alumnos: null,
        promedio: null,
        estado: 'sin_informacion',
      }
    }
    const porMes = meses.map((mes) => {
      const cantidad = suyos.reduce((suma, alumno) => {
        const dato = librosDe(alumno.id_alumno, mes)
        return dato.cantidad == null ? suma : suma + dato.cantidad
      }, 0)
      const incompleto = suyos.some((alumno) => librosDe(alumno.id_alumno, mes).estado === 'incompleto')
      const estado = estadoDeMes(mes)
      return {
        ...mes,
        nombre: nombreDeMes(mes),
        cantidad: estado === 'futuro' ? null : cantidad,
        estado: estado === 'futuro' ? 'futuro' : incompleto ? 'incompleto' : estado === 'en_curso' ? 'en_curso' : 'completo',
      }
    })
    const total = porMes.reduce((a, m) => a + (m.cantidad ?? 0), 0)
    const incompleto = porMes.some((m) => m.estado === 'incompleto')
    return {
      id_colegio: colegio.id_colegio,
      nombre: colegio.nombre,
      meses: porMes,
      total,
      alumnos: suyos.length,
      // Dos decimales para mostrar; el orden usa el valor sin redondear.
      promedio: suyos.length ? Number((total / suyos.length).toFixed(4)) : null,
      estado: incompleto ? 'incompleto' : 'completo',
      provisional: incompleto,
      etiqueta: incompleto ? 'Total registrado hasta el momento' : null,
    }
  })

  const conDatos = filas.filter((f) => f.promedio != null)
  const total = conDatos.reduce((a, f) => a + f.total, 0)
  const alumnos = conDatos.reduce((a, f) => a + f.alumnos, 0)
  const incompleto = conDatos.some((f) => f.provisional)

  return {
    anio_escolar: ANIOS.find((a) => a.id_anio_escolar === Number(params.id_anio_escolar)) ?? ANIOS[1],
    consultado_hasta: hoy().format('YYYY-MM-DD'),
    resumen: conDatos.length
      ? {
          total,
          alumnos,
          promedio: alumnos ? Number((total / alumnos).toFixed(4)) : null,
          estado: incompleto ? 'incompleto' : 'completo',
          provisional: incompleto,
          etiqueta: incompleto ? 'Total registrado hasta el momento' : null,
        }
      : { total: null, alumnos: null, promedio: null, estado: 'sin_informacion' },
    meses: mesesDelAnio().map((mes) => {
      const estado = estadoDeMes(mes)
      const cantidad = conDatos.reduce((a, f) => {
        const suyo = f.meses.find((m) => m.mes === mes.mes && m.anio === mes.anio)
        return a + (suyo?.cantidad ?? 0)
      }, 0)
      return {
        ...mes,
        nombre: nombreDeMes(mes),
        cantidad: estado === 'futuro' ? null : cantidad,
        estado: estado === 'futuro' ? 'futuro' : estado === 'en_curso' ? 'en_curso' : 'completo',
      }
    }),
    colegios: conPosicion(conDatos, 'promedio'),
    sin_informacion: filas.filter((f) => f.promedio == null),
  }
}

export function librosDeColegio(idColegio, params = {}) {
  const colegio = db.COLEGIOS.find((c) => c.id_colegio === Number(idColegio))
  if (!colegio) throw errorMock(404, 'El colegio no existe', 'no_encontrado')
  const meses = mesesDelAnio()
  const grados = params.id_grado ? db.GRADOS.filter((g) => g.id_grado === Number(params.id_grado)) : db.GRADOS

  const porGrado = grados.map((grado) => {
    const suyos = db.ALUMNOS.filter((a) => a.id_colegio === colegio.id_colegio && a.id_grado === grado.id_grado)
    const alumnos = suyos.map((alumno) => {
      const porMes = meses.map((mes) => ({ ...mes, nombre: nombreDeMes(mes), ...librosDe(alumno.id_alumno, mes) }))
      const total = porMes.reduce((a, m) => a + (m.cantidad ?? 0), 0)
      return {
        id_alumno: alumno.id_alumno,
        // Apellidos primero, como el resto de las tablas del sistema.
        nombre: db.nombreCompleto(alumno),
        meses: porMes,
        total,
        estado: porMes.some((m) => m.estado === 'incompleto') ? 'incompleto' : 'completo',
      }
    })
    const total = alumnos.reduce((a, al) => a + al.total, 0)
    const incompleto = alumnos.some((al) => al.estado === 'incompleto')
    return {
      id_grado: grado.id_grado,
      nombre: grado.nombre,
      total,
      alumnos_incluidos: alumnos.length,
      promedio: alumnos.length ? Number((total / alumnos.length).toFixed(4)) : null,
      estado: alumnos.length ? (incompleto ? 'incompleto' : 'completo') : 'sin_informacion',
      provisional: incompleto,
      alumnos,
    }
  })

  const conDatos = porGrado.filter((g) => g.promedio != null)
  const total = conDatos.reduce((a, g) => a + g.total, 0)
  const alumnos = conDatos.reduce((a, g) => a + g.alumnos_incluidos, 0)

  return {
    colegio: { id_colegio: colegio.id_colegio, nombre: colegio.nombre },
    anio_escolar: ANIOS.find((a) => a.id_anio_escolar === Number(params.id_anio_escolar)) ?? ANIOS[1],
    resumen: conDatos.length
      ? {
          total,
          alumnos,
          promedio: alumnos ? Number((total / alumnos).toFixed(4)) : null,
          estado: conDatos.some((g) => g.provisional) ? 'incompleto' : 'completo',
          provisional: conDatos.some((g) => g.provisional),
        }
      : { total: null, alumnos: null, promedio: null, estado: 'sin_informacion' },
    meses: meses.map((mes) => {
      const estado = estadoDeMes(mes)
      const cantidad = conDatos.reduce(
        (a, g) => a + g.alumnos.reduce((s, al) => s + (al.meses.find((m) => m.mes === mes.mes)?.cantidad ?? 0), 0),
        0,
      )
      return {
        ...mes,
        nombre: nombreDeMes(mes),
        cantidad: estado === 'futuro' ? null : cantidad,
        estado: estado === 'futuro' ? 'futuro' : estado === 'en_curso' ? 'en_curso' : 'completo',
      }
    }),
    grados: conPosicion(conDatos, 'promedio'),
    sin_informacion: porGrado.filter((g) => g.promedio == null),
  }
}

export function librosDesglose(params = {}) {
  const idAlumno = Number(params.id_alumno)
  const alumno = db.ALUMNOS.find((a) => a.id_alumno === idAlumno)
  if (!alumno) throw errorMock(404, ' El alumno no existe'.trim(), 'no_encontrado')
  const mes = { mes: Number(params.mes), anio: Number(params.anio) || ANIO }
  const dato = librosDe(idAlumno, mes)

  if (dato.cantidad == null) {
    return { total: null, estado: dato.estado, items: [] }
  }

  // Dos semanas de referencia, y una declarada "No realizada": aporta 0
  // mientras la declaración siga vigente, y eso NO es ausencia de información.
  const random = db.crearRandom(idAlumno * 17 + mes.mes)
  const subirNivel = Math.round(dato.cantidad * 0.6)
  return {
    total: dato.cantidad,
    estado: dato.estado,
    items: [
      {
        id_lectura_semanal: idAlumno * 100 + mes.mes,
        clase: { id_clase: idAlumno * 10 + mes.mes, fecha: `${mes.anio}-${String(mes.mes).padStart(2, '0')}-10` },
        subprograma: db.PROGRAMAS.find((p) => p.id_programa === alumno.id_programa)?.nombre ?? null,
        libros_subir_nivel: subirNivel,
        libros_seleccion_libre: dato.cantidad - subirNivel,
        no_realizada: false,
      },
      {
        id_lectura_semanal: idAlumno * 100 + mes.mes + 1,
        clase: { id_clase: idAlumno * 10 + mes.mes + 1, fecha: `${mes.anio}-${String(mes.mes).padStart(2, '0')}-24` },
        subprograma: db.PROGRAMAS.find((p) => p.id_programa === alumno.id_programa)?.nombre ?? null,
        libros_subir_nivel: 0,
        libros_seleccion_libre: 0,
        no_realizada: random() < 0.5,
      },
    ],
  }
}

export function evolucionAnual(params) {
  const colegios = colegiosDe(params)
  periodoDe(params, { obligatorio: false })
  const hasta = Number(params.id_anio_escolar) || 2

  // Solo años CON información: un año sin datos no se dibuja como cero. El
  // año 1 del simulador no tiene nada, así que directamente no aparece.
  const anios = ANIOS.filter((a) => a.id_anio_escolar <= hasta && a.id_anio_escolar >= 2)

  return {
    anios: anios.map((anio) => {
      const enCurso = anio.id_anio_escolar === 2
      const alumnos = alumnosDe(colegios).length
      return {
        id_anio_escolar: anio.id_anio_escolar,
        nombre: anio.nombre,
        alumnos,
        colegios: colegios.length,
        libros: Math.round(alumnos * 1.4),
        parcial: enCurso,
        estado: enCurso ? 'parcial' : 'completo',
      }
    }),
    mensaje: anios.length < 2 ? 'No hay información de otros años para mostrar la evolución.' : null,
  }
}

export function comparacionColegios(params = {}) {
  const colegios = colegiosDe(params)
  const indicador = params.indicador ?? 'nivel_global_alfabetizacion'
  const anual = indicador === 'promedio_libros'
  periodoDe(params, { obligatorio: !anual })
  const { activos, sinInformacion } = reparto(colegios)

  const valorDe = (colegio) => {
    if (colegio.id_colegio === COLEGIO_SIN_LECTURA && anual) return null
    const random = db.crearRandom(colegio.id_colegio * 23 + indicador.length)
    if (indicador === 'asistencia') return Number((85 + random() * 12).toFixed(1))
    if (anual) return Number((0.8 + random() * 2).toFixed(4))
    return Number((1 + random() * 3).toFixed(4))
  }

  const filas = activos.map((c) => ({
    id_colegio: c.id_colegio,
    nombre: c.nombre,
    valor: valorDe(c),
    provisional: c.id_colegio % 4 === 0,
    estado: valorDe(c) == null ? 'sin_informacion' : c.id_colegio % 4 === 0 ? 'provisional' : 'con_datos',
  }))

  const conDatos = filas.filter((f) => f.valor != null)
  let mensaje = null
  if (activos.length < 2) mensaje = 'Selecciona al menos dos colegios para compararlos.'
  else if (conDatos.length < 2) {
    mensaje = 'No hay información suficiente de otros colegios para establecer una comparación.'
  }

  return {
    indicador,
    // Con un solo colegio comparable NO se asigna posición: el CU lo dice y es
    // lo que distingue "primero de nueve" de "el único que tiene datos".
    colegios: conDatos.length > 1 ? conPosicion(conDatos, 'valor') : conDatos.map((f) => ({ ...f, posicion: null })),
    sin_informacion: filas.filter((f) => f.valor == null),
    colegios_sin_informacion: sinInformacion,
    mensaje,
  }
}
