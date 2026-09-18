// Agregados del mock para las vistas de consolidación (Fases 6 y 7).
//
// Es lo que el BACKEND calcularía con consultas agrupadas sobre las tablas de
// evaluaciones y reportes. Vive separado de `db.js` para que ese archivo siga
// siendo solo la fuente de datos, y de `handlers.js` para que los handlers sigan
// siendo solo el contrato.
//
// Todos los porcentajes son enteros de 0 a 100. `null` significa "no hay base
// para calcularlo", que NO es lo mismo que 0 %: la interfaz lo muestra como "—".
import * as db from './db'

export const esLogro = (nivel) => nivel === 'Logrado' || nivel === 'Destacado'

export const pct = (parte, total) => (total ? Math.round((parte / total) * 100) : null)

const clave = (idAlumno, idPeriodo) => `${idAlumno}-${idPeriodo}`

/** Índice alumno-periodo → evaluación, reconstruido en cada consulta porque el mock admite escrituras. */
function indiceEvaluaciones() {
  const indice = new Map()
  db.EVALUACIONES.forEach((e) => indice.set(clave(e.id_alumno, e.id_periodo), e))
  return indice
}

/** Orden de las categorías de nivel, de menor a mayor. "Pre Inicio" solo existe en Fluidez (§13). */
export const ORDEN_NIVELES = ['Pre Inicio', 'Inicio', 'Proceso', 'Logrado', 'Destacado']

const periodoPorDefecto = (idPeriodo) => Number(idPeriodo) || db.PERIODO_VIGENTE.id_periodo

/** Alumnos activos que cumplen los filtros comunes de las vistas consolidadas. */
export function alumnosFiltrados({ programa, colegio, grado, aula, q, zona } = {}) {
  const colegiosDeZona = zona ? new Set(db.COLEGIOS.filter((c) => c.zona === zona).map((c) => c.id_colegio)) : null
  return db
    .alumnosDe({ programa, colegio, grado, q })
    .filter((a) => a.activo && (!aula || a.aula === aula) && (!colegiosDeZona || colegiosDeZona.has(a.id_colegio)))
}

/** Nivel que se mide: el general, o el de una sola dimensión de la rúbrica. */
function nivelDe(evaluacion, dimension) {
  if (!evaluacion) return null
  if (dimension === 'Fluidez') return evaluacion.fluidez
  if (dimension === 'Comprensión') return evaluacion.comprension
  return evaluacion.nivel_general
}

// ── Indicadores ─────────────────────────────────────────────────────────────

export function indicadores(filtros = {}) {
  const idPeriodo = periodoPorDefecto(filtros.periodo)
  const indice = indiceEvaluaciones()
  const alumnos = alumnosFiltrados(filtros)

  const evaluados = alumnos.filter((a) => indice.has(clave(a.id_alumno, idPeriodo)))
  const conLogro = evaluados.filter((a) => esLogro(nivelDe(indice.get(clave(a.id_alumno, idPeriodo)), filtros.dimension)))

  // "Subió de nivel" compara el nivel Raz-Kids final con el del corte anterior (RN-012: por `orden`).
  const comparables = evaluados.filter((a) => indice.has(clave(a.id_alumno, idPeriodo - 1)))
  const subieron = comparables.filter((a) => {
    const actual = db.ordenDeLetra(indice.get(clave(a.id_alumno, idPeriodo)).nivel_ajustado)
    const previo = db.ordenDeLetra(indice.get(clave(a.id_alumno, idPeriodo - 1)).nivel_ajustado)
    return actual > previo
  })

  return {
    id_periodo: idPeriodo,
    estudiantes: alumnos.length,
    evaluados: evaluados.length,
    pct_logro: pct(conLogro.length, evaluados.length),
    cobertura: pct(evaluados.length, alumnos.length),
    pct_subio: comparables.length ? pct(subieron.length, comparables.length) : null,
    comparables: comparables.length,
  }
}

// ── Distribución por nivel y periodo (100 % apilado) ────────────────────────

export function distribucion(filtros = {}) {
  const indice = indiceEvaluaciones()
  const alumnos = alumnosFiltrados(filtros)
  const presentes = new Set()

  const filas = db.PERIODOS.map((periodo) => {
    const conteos = {}
    let total = 0
    alumnos.forEach((a) => {
      const nivel = nivelDe(indice.get(clave(a.id_alumno, periodo.id_periodo)), filtros.dimension)
      if (!nivel) return
      conteos[nivel] = (conteos[nivel] ?? 0) + 1
      presentes.add(nivel)
      total += 1
    })
    return { id_periodo: periodo.id_periodo, periodo: periodo.nombre, total, conteos }
  })

  return { niveles: ORDEN_NIVELES.filter((n) => presentes.has(n)), filas }
}

// ── Variación de nivel en el año (dona) ─────────────────────────────────────

/**
 * Compara la primera evaluación del año con la del corte elegido.
 *
 * El prompt nombra cuatro categorías (se mantiene / sube 1 / sube 2 / sube 3 o
 * más). Se agrega "Baja" porque hay alumnos que bajan: sin ella la dona
 * escondería una parte de los datos y los porcentajes no sumarían 100.
 */
export function variacion(filtros = {}) {
  const idPeriodo = periodoPorDefecto(filtros.periodo)
  const alumnos = alumnosFiltrados(filtros)
  const categorias = { Baja: 0, 'Se mantiene': 0, 'Sube 1': 0, 'Sube 2': 0, 'Sube 3 o más': 0 }
  let total = 0

  alumnos.forEach((a) => {
    const propias = db.evaluacionesDe(a.id_alumno).filter((e) => e.id_periodo <= idPeriodo)
    if (propias.length < 2) return
    const delta = db.ordenDeLetra(propias.at(-1).nivel_ajustado) - db.ordenDeLetra(propias[0].nivel_ajustado)
    const categoria = delta < 0 ? 'Baja' : delta === 0 ? 'Se mantiene' : delta === 1 ? 'Sube 1' : delta === 2 ? 'Sube 2' : 'Sube 3 o más'
    categorias[categoria] += 1
    total += 1
  })

  return { total, categorias: Object.entries(categorias).map(([nombre, cantidad]) => ({ nombre, cantidad, pct: pct(cantidad, total) })) }
}

// ── Nivel alcanzado frente al esperado por grado ────────────────────────────

export function alcanzadoVsEsperado(filtros = {}) {
  const idPeriodo = periodoPorDefecto(filtros.periodo)
  const indice = indiceEvaluaciones()
  const alumnos = alumnosFiltrados(filtros)

  return db.GRADOS.map((grado) => {
    const ordenes = alumnos
      .filter((a) => a.id_grado === grado.id_grado)
      .map((a) => indice.get(clave(a.id_alumno, idPeriodo)))
      .filter(Boolean)
      .map((e) => db.ordenDeLetra(e.nivel_ajustado))
    const esperado = db.NIVEL_ESPERADO_POR_GRADO.find((e) => e.id_grado === grado.id_grado)
    return {
      id_grado: grado.id_grado,
      grado: grado.nombre,
      n: ordenes.length,
      alcanzado: ordenes.length ? Math.round((ordenes.reduce((s, o) => s + o, 0) / ordenes.length) * 10) / 10 : null,
      esperado: esperado?.orden ?? null,
    }
  })
}

// ── Fluidez frente a Comprensión (nunca promediadas, RN-008) ────────────────

export function fluidezVsComprension(filtros = {}) {
  const idPeriodo = periodoPorDefecto(filtros.periodo)
  const indice = indiceEvaluaciones()
  const evaluaciones = alumnosFiltrados(filtros)
    .map((a) => indice.get(clave(a.id_alumno, idPeriodo)))
    .filter(Boolean)

  const total = evaluaciones.length
  return ORDEN_NIVELES.map((nivel) => ({
    nivel,
    fluidez: pct(evaluaciones.filter((e) => e.fluidez === nivel).length, total),
    comprension: pct(evaluaciones.filter((e) => e.comprension === nivel).length, total),
  })).filter((fila) => fila.fluidez || fila.comprension)
}

// ── Evolución del % de logro por programa ───────────────────────────────────

export function evolucionPorPrograma(filtros = {}) {
  const indice = indiceEvaluaciones()
  return db.PERIODOS.map((periodo) => {
    const fila = { id_periodo: periodo.id_periodo, periodo: periodo.nombre }
    db.PROGRAMAS.forEach((programa) => {
      const evaluaciones = alumnosFiltrados({ ...filtros, programa: programa.id_programa })
        .map((a) => indice.get(clave(a.id_alumno, periodo.id_periodo)))
        .filter(Boolean)
      // Un corte con menos de 5 evaluaciones no dibuja un punto: sería ruido, no tendencia.
      fila[`p${programa.id_programa}`] =
        evaluaciones.length >= 5 ? pct(evaluaciones.filter((e) => esLogro(e.nivel_general)).length, evaluaciones.length) : null
    })
    return fila
  })
}

// ── Resumen por colegio (cobertura, tabla, ranking, dispersión) ─────────────

export function resumenPorColegio(filtros = {}) {
  const idPeriodo = periodoPorDefecto(filtros.periodo)
  const indice = indiceEvaluaciones()

  return db.COLEGIOS.filter((c) => !filtros.zona || c.zona === filtros.zona).map((colegio) => {
    const alumnos = alumnosFiltrados({ ...filtros, colegio: colegio.id_colegio, zona: undefined })
    const evaluaciones = alumnos.map((a) => indice.get(clave(a.id_alumno, idPeriodo))).filter(Boolean)
    const conteos = {}
    evaluaciones.forEach((e) => {
      const nivel = nivelDe(e, filtros.dimension)
      if (nivel) conteos[nivel] = (conteos[nivel] ?? 0) + 1
    })
    const logro = evaluaciones.filter((e) => esLogro(nivelDe(e, filtros.dimension))).length

    return {
      id_colegio: colegio.id_colegio,
      colegio: colegio.nombre,
      abreviatura: colegio.abreviatura,
      zona: colegio.zona,
      docente: db.docenteDe(colegio.id_colegio, idPeriodo),
      estudiantes: alumnos.length,
      evaluados: evaluaciones.length,
      conteos,
      pct_logro: pct(logro, evaluaciones.length),
      cobertura: pct(evaluaciones.length, alumnos.length),
    }
  })
}

/** Ranking de colegios por % de logro (RF-009). Los que no tienen evaluaciones van al final. */
export function rankingColegios(filtros = {}) {
  return resumenPorColegio(filtros)
    .sort((a, b) => (b.pct_logro ?? -1) - (a.pct_logro ?? -1))
    .map((fila, i) => ({ ...fila, posicion: i + 1 }))
}

/** Ranking de aulas dentro de un colegio (RF-008). */
export function rankingAulas({ colegio, periodo, programa, dimension } = {}) {
  const idPeriodo = periodoPorDefecto(periodo)
  const indice = indiceEvaluaciones()
  const aulas = new Map()

  alumnosFiltrados({ colegio, programa }).forEach((a) => {
    const id = `${a.id_grado}${a.aula}`
    const aula = aulas.get(id) ?? { id_aula: id, id_grado: a.id_grado, aula: a.aula, nombre: `${a.id_grado}.° ${a.aula}`, estudiantes: 0, evaluados: 0, logro: 0 }
    aula.estudiantes += 1
    const evaluacion = indice.get(clave(a.id_alumno, idPeriodo))
    if (evaluacion) {
      aula.evaluados += 1
      if (esLogro(nivelDe(evaluacion, dimension))) aula.logro += 1
    }
    aulas.set(id, aula)
  })

  return [...aulas.values()]
    .map(({ logro, ...aula }) => ({ ...aula, pct_logro: pct(logro, aula.evaluados), cobertura: pct(aula.evaluados, aula.estudiantes) }))
    .sort((a, b) => (b.pct_logro ?? -1) - (a.pct_logro ?? -1))
    .map((fila, i) => ({ ...fila, posicion: i + 1 }))
}

/** Detalle de un colegio (P13): indicadores, distribución por grado, evolución y aulas. */
export function detalleColegio(idColegio, filtros = {}) {
  const colegio = db.COLEGIOS.find((c) => c.id_colegio === Number(idColegio))
  if (!colegio) return null
  const idPeriodo = periodoPorDefecto(filtros.periodo)
  const indice = indiceEvaluaciones()
  const propios = { ...filtros, colegio: colegio.id_colegio }

  const grados = db.GRADOS.map((grado) => {
    const alumnos = alumnosFiltrados({ ...propios, grado: grado.id_grado })
    const evaluaciones = alumnos.map((a) => indice.get(clave(a.id_alumno, idPeriodo))).filter(Boolean)
    const conteos = {}
    evaluaciones.forEach((e) => {
      conteos[e.nivel_general] = (conteos[e.nivel_general] ?? 0) + 1
    })
    return {
      id_grado: grado.id_grado,
      grado: grado.nombre,
      estudiantes: alumnos.length,
      evaluados: evaluaciones.length,
      conteos,
      pct_logro: pct(evaluaciones.filter((e) => esLogro(e.nivel_general)).length, evaluaciones.length),
      cobertura: pct(evaluaciones.length, alumnos.length),
      docente: db.docenteDe(colegio.id_colegio, idPeriodo),
    }
  })

  // Evolución del colegio frente al promedio de los nueve.
  const evolucion = db.PERIODOS.map((periodo) => {
    const logroDe = (lista) => {
      const evs = lista.map((a) => indice.get(clave(a.id_alumno, periodo.id_periodo))).filter(Boolean)
      return evs.length >= 5 ? pct(evs.filter((e) => esLogro(e.nivel_general)).length, evs.length) : null
    }
    return {
      periodo: periodo.nombre,
      colegio: logroDe(alumnosFiltrados(propios)),
      promedio: logroDe(alumnosFiltrados({ ...filtros, colegio: undefined })),
    }
  })

  return {
    colegio,
    indicadores: indicadores(propios),
    grados,
    evolucion,
    aulas: rankingAulas({ ...filtros, colegio: colegio.id_colegio }),
  }
}

// ── Consolidados (P14) ──────────────────────────────────────────────────────

/** Conteo y porcentaje de alumnos por nivel, por grado y programa (pestaña CONSOLIDADO del Excel). */
export function consolidadoNivel(filtros = {}) {
  const idPeriodo = periodoPorDefecto(filtros.periodo)
  const periodo = db.PERIODOS.find((p) => p.id_periodo === idPeriodo)
  const indice = indiceEvaluaciones()
  const alumnos = alumnosFiltrados(filtros)

  const filas = db.PROGRAMAS.flatMap((programa) =>
    db.GRADOS.map((grado) => {
      const evaluaciones = alumnos
        .filter((a) => a.id_programa === programa.id_programa && a.id_grado === grado.id_grado)
        .map((a) => indice.get(clave(a.id_alumno, idPeriodo)))
        .filter(Boolean)
      const conteos = Object.fromEntries(db.NIVEL_GENERAL.map((n) => [n.nombre_nivel, 0]))
      evaluaciones.forEach((e) => {
        conteos[e.nivel_general] = (conteos[e.nivel_general] ?? 0) + 1
      })
      return { id_programa: programa.id_programa, programa: programa.nombre, id_grado: grado.id_grado, grado: grado.nombre, total: evaluaciones.length, conteos }
    }).filter((fila) => fila.total > 0),
  )

  return {
    periodo: periodo?.nombre ?? null,
    // §P14: la nota que distingue un cierre congelado de un cálculo en vivo.
    origen: periodo?.estado === 'cerrado' ? 'snapshot' : 'en-vivo',
    niveles: db.NIVEL_GENERAL.map((n) => n.nombre_nivel),
    filas,
  }
}

const claveMes = (semana) => `${semana.anio}-${String(semana.mes).padStart(2, '0')}`

/** Libros de una fila del reporte semanal: sin asistencia no hay libros (P4). */
const librosDeFila = (fila) => (fila?.asistio ? (fila.libros?.length ?? 0) : 0)
const salaDeFila = (fila) => (fila?.asistio ? Number(fila.lsl ?? 0) : 0)

/** Totales de LSB y LSL por colegio, grado y mes (P14). */
export function consolidadoLibros({ colegio, grado, mes, q } = {}) {
  const claveDelMes = mes || db.MES_ACTUAL
  const semanas = db.SEMANAS.filter((s) => claveMes(s) === claveDelMes)
  const alumnos = alumnosFiltrados({ colegio, grado, q })

  const filas = new Map()
  alumnos.forEach((a) => {
    const id = `${a.id_colegio}-${a.id_grado}`
    const fila = filas.get(id) ?? {
      id,
      id_colegio: a.id_colegio,
      colegio: db.COLEGIOS.find((c) => c.id_colegio === a.id_colegio)?.nombre,
      id_grado: a.id_grado,
      grado: `${a.id_grado}.°`,
      lsb: 0,
      lsl: 0,
    }
    semanas.forEach((s) => {
      const reporte = db.reporteSemanalDe(s.id_semana).get(a.id_alumno)
      fila.lsb += librosDeFila(reporte)
      fila.lsl += salaDeFila(reporte)
    })
    filas.set(id, fila)
  })

  const lista = [...filas.values()].map((f) => ({ ...f, total: f.lsb + f.lsl }))
  const general = lista.reduce((t, f) => ({ lsb: t.lsb + f.lsb, lsl: t.lsl + f.lsl, total: t.total + f.total }), { lsb: 0, lsl: 0, total: 0 })

  return {
    mes: claveDelMes,
    semanas: semanas.length,
    origen: claveDelMes === db.MES_ACTUAL ? 'en-vivo' : 'snapshot',
    filas: lista,
    total_general: general,
  }
}

// ── Alertas de inconsistencia (P15, RF-014) ─────────────────────────────────
//
// TODO RF-014: el documento no define cuándo un valor "no cuadra". Aquí se toma
// la regla más literal: el total de libros del mes según el reporte semanal
// difiere del consolidado mensual guardado. El consolidado del mock replica el
// semanal salvo en unos pocos casos deterministas, que son los que alertan.

const revisadas = new Set()

export function alertasInconsistencias({ colegio } = {}) {
  // Solo meses cerrados: el mes en curso todavía se está registrando.
  const meses = db.MESES_CON_SEMANAS.filter((m) => m !== db.MES_ACTUAL).slice(-2)
  const alertas = []

  meses.forEach((mes) => {
    const random = db.crearRandom(db.SEMILLA + Number(mes.replace('-', '')))
    const semanas = db.SEMANAS.filter((s) => claveMes(s) === mes)

    alumnosFiltrados({ colegio }).forEach((a) => {
      const semanal = semanas.reduce((suma, s) => {
        const fila = db.reporteSemanalDe(s.id_semana).get(a.id_alumno)
        return suma + librosDeFila(fila) + salaDeFila(fila)
      }, 0)
      const descuadra = random() < 0.03
      const ajuste = descuadra ? (random() < 0.5 ? -1 : 1) * (1 + Math.floor(random() * 3)) : 0
      if (!descuadra) return

      const id = `${a.id_alumno}-${mes}`
      alertas.push({
        id_alerta: id,
        id_alumno: a.id_alumno,
        alumno: db.nombreCompleto(a),
        codigo: a.codigo,
        id_colegio: a.id_colegio,
        colegio: db.COLEGIOS.find((c) => c.id_colegio === a.id_colegio)?.nombre,
        mes,
        valor_semanal: semanal,
        valor_consolidado: Math.max(0, semanal + ajuste),
        diferencia: Math.max(0, semanal + ajuste) - semanal,
        estado: revisadas.has(id) ? 'revisada' : 'pendiente',
      })
    })
  })

  return alertas.filter((a) => a.diferencia !== 0)
}

export function marcarAlertaRevisada(idAlerta) {
  revisadas.add(String(idAlerta))
  return { id_alerta: idAlerta, estado: 'revisada' }
}

// ── Panel ejecutivo (P17) ───────────────────────────────────────────────────

/**
 * TODO: el umbral de "colegio con datos al día" no está definido. Se toma que al
 * menos el 85 % de sus alumnos tenga registro en la última semana cerrada (la en
 * curso siempre está a medio llenar y castigaría a todos por igual).
 */
const UMBRAL_AL_DIA = 85

export function panelEjecutivo(filtros = {}) {
  const idPeriodo = periodoPorDefecto(filtros.periodo)
  const actual = indicadores({ ...filtros, periodo: idPeriodo })
  const anterior = idPeriodo > 1 ? indicadores({ ...filtros, periodo: idPeriodo - 1 }) : null
  const alumnos = alumnosFiltrados(filtros)

  const semanaCerrada = db.SEMANAS.at(-2) ?? db.SEMANAS.at(-1)
  const reportesCerrada = db.reporteSemanalDe(semanaCerrada.id_semana)
  const colegiosAlDia = db.COLEGIOS.filter((c) => {
    const propios = alumnos.filter((a) => a.id_colegio === c.id_colegio)
    return propios.length && pct(propios.filter((a) => reportesCerrada.has(a.id_alumno)).length, propios.length) >= UMBRAL_AL_DIA
  }).length

  let libros = 0
  let registros = 0
  let asistencias = 0
  db.SEMANAS.forEach((s) => {
    const reportes = db.reporteSemanalDe(s.id_semana)
    alumnos.forEach((a) => {
      const fila = reportes.get(a.id_alumno)
      if (!fila) return
      registros += 1
      if (fila.asistio) asistencias += 1
      libros += librosDeFila(fila) + salaDeFila(fila)
    })
  })

  return {
    id_periodo: idPeriodo,
    estudiantes: actual.estudiantes,
    pct_logro: actual.pct_logro,
    // Puntos porcentuales frente al corte anterior.
    avance_pp: anterior?.pct_logro != null && actual.pct_logro != null ? actual.pct_logro - anterior.pct_logro : null,
    colegios_al_dia: colegiosAlDia,
    total_colegios: db.COLEGIOS.length,
    umbral_al_dia: UMBRAL_AL_DIA,
    libros_anio: libros,
    asistencia_promedio: pct(asistencias, registros),
  }
}
