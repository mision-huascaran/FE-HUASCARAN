// Resuelve cada endpoint contra `db.js` con un retardo de 300ms (§3), para que
// los estados de carga de la interfaz se vean como se verán con el backend real.
//
// Los errores imitan la forma de un error de axios (`error.response.status`), de
// modo que el resto de la aplicación trata igual al mock y a la API.
import * as db from './db'

const RETARDO_MS = 300

function copiar(datos) {
  return typeof structuredClone === 'function' ? structuredClone(datos) : JSON.parse(JSON.stringify(datos))
}

function responder(datos, ms = RETARDO_MS) {
  return new Promise((resolver) => setTimeout(() => resolver(copiar(datos)), ms))
}

function errorHttp(status, detail) {
  const error = new Error(detail)
  error.isAxiosError = true
  error.response = { status, data: { detail } }
  return error
}

/** Token de mentira con la forma `mock.<id_usuario>.<año lectivo>`. */
const armarToken = (idUsuario) => `mock.${idUsuario}.${db.ANIO_LECTIVO}`

function usuarioDeToken(token) {
  const idUsuario = Number(String(token ?? '').split('.')[1])
  return db.USUARIOS.find((u) => u.id_usuario === idUsuario) ?? null
}

/** El usuario que viaja al cliente nunca lleva credenciales. */
const perfilPublico = (usuario) => ({
  id_usuario: usuario.id_usuario,
  id_rol: usuario.id_rol,
  correo: usuario.correo,
  id_docente: usuario.id_docente,
  nombres: usuario.nombres,
  apellidos: usuario.apellidos,
  activo: usuario.activo,
})

/** Guardar tarda un poco más que leer: así se ve el estado "guardando" de P4. */
const RETARDO_ESCRITURA_MS = 450

/** Datos del alumno que acompañan a toda fila de captura o listado. */
function conDatosDeAlumno(alumno) {
  const colegio = db.COLEGIOS.find((c) => c.id_colegio === alumno.id_colegio)
  const ciclo = db.CICLOS.find((c) => c.id_ciclo === alumno.id_ciclo_evaluado)
  return {
    id_alumno: alumno.id_alumno,
    codigo: alumno.codigo,
    nombre: db.nombreCompleto(alumno),
    id_colegio: alumno.id_colegio,
    colegio: colegio?.nombre ?? null,
    id_grado: alumno.id_grado,
    aula: alumno.aula,
    id_programa: alumno.id_programa,
    id_ciclo_evaluado: alumno.id_ciclo_evaluado,
    ciclo_evaluado: ciclo?.nombre ?? null,
    activo: alumno.activo,
  }
}

/**
 * Fila del listado de estudiantes (P10).
 *
 * RN-019 (Ley N.° 29733): aquí solo viajan nombre, código y datos académicos.
 * Ni fecha de nacimiento, ni DNI, ni dirección, ni fotografía.
 */
function fichaDeListado(alumno) {
  const ultima = db.ultimaEvaluacionDe(alumno.id_alumno)
  const periodo = db.PERIODOS.find((p) => p.id_periodo === ultima?.id_periodo)
  const cicloNominal = db.CICLOS.find((c) => c.id_ciclo === alumno.id_ciclo_nominal)
  const esperado = db.NIVEL_ESPERADO_POR_GRADO.find((e) => e.id_grado === alumno.id_grado)

  return {
    ...conDatosDeAlumno(alumno),
    id_ciclo_nominal: alumno.id_ciclo_nominal,
    ciclo_nominal: cicloNominal?.nombre ?? null,
    nivel_actual: ultima?.nivel_ajustado ?? null,
    orden_actual: ultima ? db.ordenDeLetra(ultima.nivel_ajustado) : null,
    nivel_general: ultima?.nivel_general ?? null,
    nivel_esperado: esperado?.letra ?? null,
    orden_esperado: esperado?.orden ?? null,
    ultima_evaluacion: periodo ? { id_periodo: periodo.id_periodo, nombre: periodo.nombre, fecha: ultima.fecha } : null,
    estado_evaluacion: ultima?.estado ?? 'sin-registro',
  }
}

/** Encabezado e indicadores de la ficha del estudiante (P11). */
function fichaDeAlumno(alumno) {
  const base = fichaDeListado(alumno)
  const evaluaciones = db.evaluacionesDe(alumno.id_alumno)
  const anterior = evaluaciones.at(-2) ?? null
  const ultima = evaluaciones.at(-1) ?? null

  const semanasDelMes = db.SEMANAS.filter(
    (s) => `${s.anio}-${String(s.mes).padStart(2, '0')}` === db.MES_ACTUAL,
  )
  const reportesDelMes = semanasDelMes
    .map((s) => db.reporteSemanalDe(s.id_semana).get(alumno.id_alumno))
    .filter(Boolean)

  const lsb = reportesDelMes.reduce((n, r) => n + (r.libros?.length ?? 0), 0)
  const lsl = reportesDelMes.reduce((n, r) => n + Number(r.lsl ?? 0), 0)
  const asistencias = reportesDelMes.filter((r) => r.asistio).length

  return {
    ...base,
    programa: db.PROGRAMAS.find((p) => p.id_programa === alumno.id_programa)?.nombre ?? null,
    grado_nombre: db.GRADOS.find((g) => g.id_grado === alumno.id_grado)?.nombre ?? null,
    // RN-014: el nivel de Raz-Kids y el del docente conviven como campos distintos.
    variacion: {
      anterior: anterior?.nivel_ajustado ?? null,
      orden_anterior: anterior ? db.ordenDeLetra(anterior.nivel_ajustado) : null,
      actual: ultima?.nivel_ajustado ?? null,
      orden_actual: ultima ? db.ordenDeLetra(ultima.nivel_ajustado) : null,
    },
    mes_actual: {
      mes: db.MES_ACTUAL,
      lsb,
      lsl,
      total_libros: lsb + lsl,
      semanas_registradas: reportesDelMes.length,
      semanas_mes: semanasDelMes.length,
      asistencias,
    },
  }
}

/** Series y tablas de la ficha del estudiante (P11). */
function historialDeAlumno(alumno) {
  const esperado = db.NIVEL_ESPERADO_POR_GRADO.find((e) => e.id_grado === alumno.id_grado)

  // RF-011: evolución entre los cuatro cortes, con el nivel esperado de referencia.
  const evolucion = db.PERIODOS.map((periodo) => {
    const ev = db.evaluacionesDe(alumno.id_alumno).find((e) => e.id_periodo === periodo.id_periodo)
    return {
      id_periodo: periodo.id_periodo,
      periodo: periodo.nombre,
      orden_prueba: ev ? db.ordenDeLetra(ev.nivel_prueba) : null,
      orden_ajustado: ev ? db.ordenDeLetra(ev.nivel_ajustado) : null,
      orden_esperado: esperado?.orden ?? null,
      letra_prueba: ev?.nivel_prueba ?? null,
      letra_ajustado: ev?.nivel_ajustado ?? null,
    }
  })

  const semanasDelMes = db.SEMANAS.filter(
    (s) => `${s.anio}-${String(s.mes).padStart(2, '0')}` === db.MES_ACTUAL,
  )

  const nombreNivel = (id) => db.NIVELES_RUBRICA.find((n) => n.id_nivel_rubrica === id)?.nombre_nivel ?? null

  const rubricaMensual = semanasDelMes.map((semana) => {
    const fila = db.rubricaSemanalDe(semana.id_semana).get(alumno.id_alumno)
    return {
      id_semana: semana.id_semana,
      numero: semana.numero,
      fluidez: fila ? nombreNivel(fila.id_nivel_fluidez) : null,
      comprension: fila ? nombreNivel(fila.id_nivel_comprension) : null,
    }
  })

  // RF-016: LSB con título y puntaje, LSL solo cantidad, total calculado.
  const libros = db.SEMANAS.slice(-8)
    .map((semana) => {
      const fila = db.reporteSemanalDe(semana.id_semana).get(alumno.id_alumno)
      if (!fila) return null
      return {
        id_semana: semana.id_semana,
        numero: semana.numero,
        inicio: semana.inicio,
        fin: semana.fin,
        asistio: fila.asistio,
        libros: fila.libros ?? [],
        lsl: Number(fila.lsl ?? 0),
        observacion: fila.observacion ?? '',
      }
    })
    .filter(Boolean)

  const evaluaciones = db.evaluacionesDe(alumno.id_alumno).map((ev) => ({
    ...ev,
    periodo: db.PERIODOS.find((p) => p.id_periodo === ev.id_periodo)?.nombre ?? null,
    ciclo_evaluado: db.CICLOS.find((c) => c.id_ciclo === alumno.id_ciclo_evaluado)?.nombre ?? null,
  }))

  return { evolucion, rubrica_mensual: rubricaMensual, libros, evaluaciones, nivel_esperado: esperado ?? null }
}

/** Fila del histórico del registro de vuelo: un alumno, sus cuatro cortes (P6). */
function filaHistorico(alumno, idPeriodo) {
  const evaluaciones = db.evaluacionesDe(alumno.id_alumno)
  const esperado = db.NIVEL_ESPERADO_POR_GRADO.find((e) => e.id_grado === alumno.id_grado)
  const porPeriodo = Object.fromEntries(evaluaciones.map((e) => [e.id_periodo, e]))
  const delPeriodo = idPeriodo ? (porPeriodo[Number(idPeriodo)] ?? null) : (evaluaciones.at(-1) ?? null)

  return {
    ...conDatosDeAlumno(alumno),
    grado_nombre: db.GRADOS.find((g) => g.id_grado === alumno.id_grado)?.nombre ?? null,
    nivel_esperado: esperado ?? null,
    // Los cuatro cortes, para las columnas Abril · Julio · Octubre · Diciembre.
    por_periodo: Object.fromEntries(
      db.PERIODOS.map((p) => {
        const ev = porPeriodo[p.id_periodo]
        return [
          p.id_periodo,
          ev
            ? {
                id_evaluacion: ev.id_evaluacion,
                letra: ev.nivel_ajustado,
                orden: db.ordenDeLetra(ev.nivel_ajustado),
                estado: ev.estado,
                ajustado: ev.ajustado_por_docente,
              }
            : null,
        ]
      }),
    ),
    evaluacion: delPeriodo,
    // Secuencia cronológica, para tendencia y "Últimos 3". La comparación la
    // hace el cliente por `orden` (RN-012), nunca por la letra como texto.
    secuencia: evaluaciones.map((e) => ({
      id_periodo: e.id_periodo,
      letra: e.nivel_ajustado,
      orden: db.ordenDeLetra(e.nivel_ajustado),
    })),
  }
}

function asignacionesConColegio(idDocente, idPeriodo) {
  return db.asignacionesDe(idDocente, idPeriodo).map((asignacion) => {
    const colegio = db.COLEGIOS.find((c) => c.id_colegio === asignacion.id_colegio)
    return {
      id_asignacion: asignacion.id_asignacion,
      id_periodo: asignacion.id_periodo,
      id_colegio: asignacion.id_colegio,
      colegio: colegio?.nombre ?? null,
      zona: colegio?.zona ?? null,
      grados: asignacion.grados,
    }
  })
}

/**
 * Indicadores del panel del docente (P3).
 *
 * TODO: "Ajustes por revisar" se cuenta aquí como las evaluaciones del periodo
 * vigente cuya sugerencia el docente todavía no confirma. El documento nombra el
 * indicador pero no lo define; hay que confirmarlo con Misión Huascarán.
 */
function resumenDelDocente(idDocente, idPeriodo, idSemana) {
  const asignaciones = asignacionesConColegio(idDocente, idPeriodo)
  const reportes = db.reporteSemanalDe(idSemana)
  const rubricas = db.rubricaSemanalDe(idSemana)
  const evaluaciones = db.EVALUACIONES.filter((e) => e.id_periodo === Number(idPeriodo))

  const detalle = asignaciones.flatMap((asignacion) =>
    asignacion.grados.map((idGrado) => {
      const alumnos = db.alumnosDe({ colegio: asignacion.id_colegio, grado: idGrado })
      return {
        id_colegio: asignacion.id_colegio,
        colegio: asignacion.colegio,
        zona: asignacion.zona,
        id_grado: idGrado,
        total: alumnos.length,
        registrados: alumnos.filter((a) => reportes.has(a.id_alumno)).length,
        sin_rubrica: alumnos.filter((a) => !rubricas.has(a.id_alumno)).length,
      }
    }),
  )

  const misAlumnos = asignaciones.flatMap((a) => db.alumnosDe({ colegio: a.id_colegio }))
  const periodo = db.PERIODOS.find((p) => p.id_periodo === Number(idPeriodo))
  const conEvaluacion = misAlumnos.filter((a) => evaluaciones.some((e) => e.id_alumno === a.id_alumno))

  return {
    id_periodo: Number(idPeriodo),
    id_semana: Number(idSemana),
    mis_estudiantes: misAlumnos.length,
    reporte_semana: {
      registrados: misAlumnos.filter((a) => reportes.has(a.id_alumno)).length,
      total: misAlumnos.length,
    },
    pendientes_rubrica: misAlumnos.filter((a) => !rubricas.has(a.id_alumno)).length,
    ajustes_por_revisar: evaluaciones.filter(
      (e) => e.estado === 'pendiente' && misAlumnos.some((a) => a.id_alumno === e.id_alumno),
    ).length,
    // RN-010: aviso cuando el corte diagnóstico está abierto y falta registrarlo.
    evaluacion_abierta:
      periodo?.estado === 'abierto'
        ? { id_periodo: periodo.id_periodo, nombre: periodo.nombre, registrados: conEvaluacion.length, total: misAlumnos.length }
        : null,
    asignaciones: detalle,
  }
}

/** Una fila de la grilla de captura semanal (P4), con sus columnas de referencia. */
function filaSemanal(alumno, guardada, idSemana) {
  return {
    ...conDatosDeAlumno(alumno),
    id_semana: Number(idSemana),
    id_reporte: guardada?.id_reporte ?? null,
    asistio: guardada?.asistio ?? null,
    lsl: guardada?.lsl ?? 0,
    libros: guardada?.libros ?? [],
    observacion: guardada?.observacion ?? '',
    referencia: db.referenciaDe(alumno),
    actualizado_en: guardada?.actualizado_en ?? null,
  }
}

function filaRubrica(alumno, guardada, idSemana) {
  return {
    ...conDatosDeAlumno(alumno),
    id_semana: Number(idSemana),
    id_rubrica: guardada?.id_rubrica ?? null,
    id_nivel_fluidez: guardada?.id_nivel_fluidez ?? null,
    id_nivel_comprension: guardada?.id_nivel_comprension ?? null,
    actualizado_en: guardada?.actualizado_en ?? null,
  }
}

/** Sin asistencia no hay nada que registrar: así está modelado en la base (P4). */
function normalizarReporte(payload) {
  const asistio = Boolean(payload.asistio)
  return {
    id_alumno: payload.id_alumno,
    id_semana: Number(payload.id_semana),
    asistio,
    lsl: asistio ? Number(payload.lsl ?? 0) : 0,
    libros: asistio ? (payload.libros ?? []) : [],
    observacion: asistio ? (payload.observacion ?? '') : '',
  }
}

export const handlers = {
  auth: {
    async login({ correo, password }) {
      const usuario = db.USUARIOS.find((u) => u.correo.toLowerCase() === String(correo ?? '').trim().toLowerCase())
      // P1: un 401 nunca revela cuál de los dos campos falló.
      if (!usuario || password !== db.CLAVE_DEMO) throw errorHttp(401, 'Credenciales inválidas')
      return responder({ access_token: armarToken(usuario.id_usuario), token_type: 'bearer' })
    },

    async me(token) {
      const usuario = usuarioDeToken(token)
      if (!usuario) throw errorHttp(401, 'No autenticado')
      return responder(perfilPublico(usuario), 150)
    },

    async logout() {
      // JWT stateless: el cierre real es borrar el token en el cliente (§3).
      return responder({ ok: true }, 80)
    },
  },

  catalogos: {
    colegios: () => responder(db.COLEGIOS),
    grados: () => responder(db.GRADOS),
    programas: () => responder(db.PROGRAMAS),
    ciclos: () => responder(db.CICLOS),
    nivelesRazkids: () => responder(db.NIVELES_RAZKIDS),
    nivelesRubrica: ({ programa } = {}) =>
      responder(
        programa ? db.NIVELES_RUBRICA.filter((n) => n.id_programa === Number(programa)) : db.NIVELES_RUBRICA,
      ),
    nivelGeneral: () => responder(db.NIVEL_GENERAL),
    esperadoPorGrado: () => responder(db.NIVEL_ESPERADO_POR_GRADO),
    periodos: () => responder(db.PERIODOS),
    semanas: () => responder(db.SEMANAS),
  },

  alumnos: {
    listar: (filtros = {}) => responder(db.alumnosDe(filtros).map(fichaDeListado)),
    detalle: (id) => {
      const alumno = db.ALUMNOS.find((a) => a.id_alumno === Number(id))
      if (!alumno) throw errorHttp(404, 'El alumno no existe')
      return responder(fichaDeAlumno(alumno))
    },
    historial: (id) => {
      const alumno = db.ALUMNOS.find((a) => a.id_alumno === Number(id))
      if (!alumno) throw errorHttp(404, 'El alumno no existe')
      return responder(historialDeAlumno(alumno))
    },
  },

  evaluaciones: {
    /** Histórico del registro de vuelo: una fila por alumno con sus cuatro cortes (P6). */
    listar: (filtros = {}) =>
      responder(db.alumnosDe(filtros).map((alumno) => filaHistorico(alumno, filtros.periodo))),

    guardar: async (payload) => {
      const alumno = db.ALUMNOS.find((a) => a.id_alumno === Number(payload.id_alumno))
      if (!alumno) throw errorHttp(404, 'El alumno no existe')

      const periodo = db.PERIODOS.find((p) => p.id_periodo === Number(payload.id_periodo))
      if (!periodo) throw errorHttp(422, 'El periodo de evaluación no existe')
      // RN-010: solo el corte vigente admite escritura; los anteriores están cerrados.
      if (periodo.estado === 'cerrado' && !payload.justificacion) {
        throw errorHttp(422, 'Los periodos cerrados requieren una justificación para corregirse')
      }
      // RN-008: las dos dimensiones de la rúbrica van siempre juntas.
      if (!payload.fluidez || !payload.comprension) {
        throw errorHttp(422, 'Ambas dimensiones son obligatorias')
      }
      // RN-015: cambiar el nivel sugerido exige justificación escrita.
      const cambiaSugerencia = payload.nivel_ajustado && payload.nivel_ajustado !== payload.nivel_sugerido
      if (cambiaSugerencia && !String(payload.justificacion ?? '').trim()) {
        throw errorHttp(422, 'La justificación es obligatoria al modificar el nivel sugerido')
      }

      const guardada = db.guardarEvaluacion(payload)
      return responder({ ...guardada, alumno: conDatosDeAlumno(alumno) }, RETARDO_ESCRITURA_MS)
    },
  },

  nivelFinal: {
    /** Consolidado mensual derivado de las rúbricas semanales (P9, RF-018). */
    listar: ({ mes, colegio, grado, programa, estado } = {}) => {
      const consolidado = db.nivelFinalDeMes(mes)
      const filas = db
        .alumnosDe({ colegio, grado, programa })
        .map((alumno) => {
          const fila = consolidado.get(alumno.id_alumno)
          return fila ? { ...conDatosDeAlumno(alumno), ...fila } : null
        })
        .filter(Boolean)

      if (estado === 'ajustados') return responder(filas.filter((f) => f.ajustado))
      if (estado === 'sin-ajustar') return responder(filas.filter((f) => !f.ajustado))
      return responder(filas)
    },

    ajustar: async (payload) => {
      // RN-015: la justificación es obligatoria y el servidor también la exige.
      if (!String(payload.justificacion ?? '').trim()) {
        throw errorHttp(422, 'La justificación es obligatoria')
      }
      const guardada = db.ajustarNivelFinal(payload)
      if (!guardada) throw errorHttp(404, 'No hay consolidado para ese alumno en el mes')
      return responder(guardada, RETARDO_ESCRITURA_MS)
    },
  },

  docentes: {
    asignaciones: (idDocente, { periodo } = {}) => responder(asignacionesConColegio(idDocente, periodo)),
    resumen: (idDocente, { periodo, semana } = {}) => responder(resumenDelDocente(idDocente, periodo, semana)),
  },

  semanal: {
    listar: ({ semana, colegio, grado } = {}) => {
      const guardadas = db.reporteSemanalDe(semana)
      return responder(
        db.alumnosDe({ colegio, grado }).map((alumno) => filaSemanal(alumno, guardadas.get(alumno.id_alumno), semana)),
      )
    },
    guardar: async (payload) => {
      const alumno = db.ALUMNOS.find((a) => a.id_alumno === payload.id_alumno)
      if (!alumno) throw errorHttp(404, 'El alumno no existe')
      const guardada = db.guardarReporteSemanal(normalizarReporte(payload))
      return responder(filaSemanal(alumno, guardada, payload.id_semana), RETARDO_ESCRITURA_MS)
    },
  },

  rubrica: {
    listar: ({ semana, colegio, grado } = {}) => {
      const guardadas = db.rubricaSemanalDe(semana)
      return responder(
        db.alumnosDe({ colegio, grado }).map((alumno) => filaRubrica(alumno, guardadas.get(alumno.id_alumno), semana)),
      )
    },
    guardar: async (payload) => {
      const alumno = db.ALUMNOS.find((a) => a.id_alumno === payload.id_alumno)
      if (!alumno) throw errorHttp(404, 'El alumno no existe')
      // RN-008: Fluidez y Comprensión viajan siempre juntas.
      if (!payload.id_nivel_fluidez || !payload.id_nivel_comprension) {
        throw errorHttp(422, 'Ambas dimensiones son obligatorias')
      }
      const guardada = db.guardarRubricaSemanal(payload)
      return responder(filaRubrica(alumno, guardada, payload.id_semana), RETARDO_ESCRITURA_MS)
    },
  },
}

export default handlers
