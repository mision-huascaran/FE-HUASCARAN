// Resuelve cada endpoint contra `db.js` con un retardo de 300ms (§3), para que
// los estados de carga de la interfaz se vean como se verán con el backend real.
//
// Los errores imitan la forma de un error de axios (`error.response.status`), de
// modo que el resto de la aplicación trata igual al mock y a la API.
import * as db from './db'
import * as agregados from './consolidados'
import { esCorreoValido } from '../../lib/validacion'

const RETARDO_MS = 300

function copiar(datos) {
  return structuredClone(datos)
}

function responder(datos, ms = RETARDO_MS) {
  return new Promise((resolver) => setTimeout(() => resolver(copiar(datos)), ms))
}

// Grillas de asistencia creadas durante la sesión. Viven aquí y no en `db`,
// que se importa de solo lectura.
/**
 * Error con la MISMA forma que el de axios, para que las pantallas puedan
 * ramificar por `motivo` igual que contra el backend real.
 */
function errorMock(status, detail, motivo) {
  const error = new Error(detail)
  error.response = { status, data: { detail, motivo } }
  return error
}

const ACTIVIDADES_MOCK = {}
const GRILLAS_ASISTENCIA = {}
const GRILLAS_SEMANALES = {}

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
 * Pendiente: "Ajustes por revisar" se cuenta aquí como las evaluaciones del periodo
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
  /** Grillas semanales de Rúbrica y Seguimiento de Lectura (T32). */
  grillas: {
    /**
     * Una grilla existe si alguien la creó en esta sesión, o si la semana ya
     * tiene registros sembrados: en los datos de prueba hay 18 semanas con
     * capturas, y esas no deben pedir que se "cree" nada.
     */
    existe: async ({ tipo, idSemana, idColegio, idGrado }) => {
      if (GRILLAS_SEMANALES[`${tipo}-${idSemana}-${idColegio}-${idGrado}`]) return responder(true)
      return responder(db.reporteSemanalDe(Number(idSemana)).size > 0)
    },

    crear: async ({ tipo, idSemana, idColegio, idGrado, idSeccion }) => {
      const clave = `${tipo}-${idSemana}-${idColegio}-${idGrado}`
      GRILLAS_SEMANALES[clave] = { clave, tipo, id_semana: idSemana, id_seccion: idSeccion ?? null }
      return responder(GRILLAS_SEMANALES[clave], RETARDO_ESCRITURA_MS)
    },

    /**
     * Ausentes del módulo Asistencia. Si para esa semana no hay ninguna grilla
     * de asistencia todavía, devuelve una lista vacía: nadie consta ausente,
     * que no es lo mismo que que todos asistieran.
     */
    ausentes: async () => {
      const ids = Object.values(GRILLAS_ASISTENCIA)
        .flatMap((g) => g.filas ?? [])
        .filter((f) => f.presente === false)
        .map((f) => f.id_alumno)
      return responder([...new Set(ids)])
    },
  },

  /** Resúmenes del Módulo de Inicio (CU010, CU011, CU012). */
  inicio: {
    /** CU012: exactamente tres tarjetas. `salud_sistema` en null a proposito. */
    directivo: () =>
      responder({
        beneficiarios_activos: db.ALUMNOS.filter((a) => a.activo !== false).length,
        colegios_operando: db.COLEGIOS.length,
        salud_sistema: null,
      }),

    supervisor: async () =>
      responder({
        colegios: db.COLEGIOS.length,
        docentesActivos: db.USUARIOS.filter((u) => u.id_rol === 1 && u.activo !== false).length,
        docentesConActividad: 1,
        registrosPendientes: 3,
        // Los umbrales (4 días, una semana) los decide el servidor: aquí llegan
        // ya redactados para no codificar reglas de negocio en la interfaz.
        alertas: [
          { id: 'a1', mensaje: 'El docente Carlos lleva 4 días sin iniciar actividad.' },
          { id: 'a2', mensaje: 'La escuela Shilla no tiene registros esta semana.' },
        ],
      }),

    /**
     * Misma forma que `GET /inicio/docente` del backend real.
     *
     * Divergir aquí sale caro: la pantalla funcionaba con el simulador y
     * reventaba contra el servidor, que es el peor orden posible para
     * enterarse. Los Resúmenes de Acción NO se devuelven, igual que el
     * backend, porque dependen de las grillas y todavía no existen.
     */
    docente: async (idDocente = 1) => {
      const asignaciones = db.ASIGNACIONES.filter((a) => a.id_docente === Number(idDocente))
      const idsColegio = [...new Set(asignaciones.map((a) => a.id_colegio))]
      const alumnos = idsColegio.flatMap((id) => db.alumnosDe({ colegio: id }))

      return responder({
        actividad_activa: null,
        puede_iniciar_actividad: asignaciones.length > 0,
        sesion_expira: null,
        asignaciones: idsColegio.map((id) => ({
          colegio: { id, nombre: db.COLEGIOS.find((c) => c.id_colegio === id)?.nombre },
          // RN-003: la asignación es por colegio completo, con sus seis grados.
          grados: db.GRADOS.map((g) => ({
            id: g.id_grado,
            nombre: g.nombre,
            cantidad_alumnos: db.alumnosDe({ colegio: id, grado: g.id_grado }).length,
            ciclos: ['III'],
            subprogramas: ['Alfabetización'],
          })),
        })),
        totales: {
          ciclos: ['III', 'IV'],
          subprogramas: ['Alfabetización'],
          cantidad_alumnos: alumnos.length,
        },
      })
    },
  },

  /** Asistencia por FECHA (T30). Distinta de la asistencia semanal de lectura. */
  asistencia: {
    /** Devuelve null si todavía no existe grilla para esa fecha. */
    grilla: async ({ idColegio, idGrado, fecha }) => {
      const clave = `${idColegio}-${idGrado}-${fecha}`
      return responder(GRILLAS_ASISTENCIA[clave] ?? null)
    },

    crearGrilla: async ({ idColegio, idGrado, idSeccion, fecha }) => {
      const clave = `${idColegio}-${idGrado}-${fecha}`
      // Las filas nacen vacías: no se copian de otra fecha a propósito.
      const filas = db
        .alumnosDe({ colegio: Number(idColegio), grado: Number(idGrado) })
        .map((a) => ({
          id_alumno: a.id_alumno,
          nombre: a.nombre,
          codigo: a.codigo,
          presente: null,
          observacion: '',
        }))
      GRILLAS_ASISTENCIA[clave] = { clave, fecha, id_seccion: idSeccion ?? null, filas }
      return responder(GRILLAS_ASISTENCIA[clave], RETARDO_ESCRITURA_MS)
    },

    guardar: async ({ clave, filas }) => {
      if (!GRILLAS_ASISTENCIA[clave]) throw errorHttp(404, 'No existe la grilla de asistencia')
      GRILLAS_ASISTENCIA[clave].filas = filas
      return responder(GRILLAS_ASISTENCIA[clave], RETARDO_ESCRITURA_MS)
    },
  },

  /** Sesiones de ACTIVIDADES (el botón del docente), no las de autenticación. */
  sesiones: {
    /**
     * Inicio y fin de una actividad. El id lo trae el cliente, asi que repetir
     * la llamada con el mismo id devuelve lo mismo en vez de duplicar.
     */
    iniciar: ({ id, inicio }) => {
      const abierta = {
        id,
        inicio: inicio ?? new Date().toISOString(),
        fin: null,
        estado: 'en_curso',
        tipo_cierre: null,
        sesion_expira: null,
      }
      ACTIVIDADES_MOCK[id] = abierta
      return responder(abierta)
    },

    finalizar: (id, { fin } = {}) => {
      const previa = ACTIVIDADES_MOCK[id] ?? { id, inicio: new Date().toISOString() }
      const cerrada = {
        ...previa,
        fin: fin ?? new Date().toISOString(),
        estado: 'finalizada',
        tipo_cierre: 'Manual por finalizacion de actividad',
      }
      ACTIVIDADES_MOCK[id] = cerrada
      return responder(cerrada)
    },

    /** CU020: primero los pendientes, luego alfabetico. Hoy todos al dia. */
    seguimiento: () =>
      responder({
        items: db.DOCENTES.map((d) => ({
          id_docente: d.id_docente,
          nombres: d.nombre?.split(' ')[0] ?? d.nombre,
          apellidos: d.nombre?.split(' ').slice(1).join(' ') ?? '',
          activo: d.activo !== false,
          colegios: [],
          ultima_conexion: null,
          sincronizacion: 'al_dia',
          registros_pendientes: 0,
        })),
        total: db.DOCENTES.length,
        pagina: 1,
        paginas: 1,
        por_pagina: 10,
      }),

    seguimientoDocente: (idDocente) => {
      const d = db.DOCENTES.find((x) => Number(x.id_docente) === Number(idDocente))
      if (!d) return Promise.reject(errorMock(404, 'El detalle solicitado no se encuentra disponible.', 'docente_no_encontrado'))
      return responder({
        id_docente: d.id_docente,
        nombres: d.nombre?.split(' ')[0] ?? d.nombre,
        apellidos: d.nombre?.split(' ').slice(1).join(' ') ?? '',
        activo: d.activo !== false,
        colegios: [],
        ultima_conexion: null,
        sincronizacion: 'al_dia',
        registros_pendientes: 0,
      })
    },

    actividadesDe: () => responder({ items: [], total: 0, pagina: 1, paginas: 1, por_pagina: 10 }),

    listar: async ({ todas = false, idDocente, idColegio, fecha } = {}) => {
      const base = [
        { id: 'a3f1b2c4', id_docente: 1, docente: 'Rosa Elena Cárdenas Villanueva', id_colegio: 1, colegio: 'I.E. 86021 Ranrahirca', inicio: '2026-10-05T08:05:00', fin: '2026-10-05T11:40:00', estado: 'cerrada', cambios: 23 },
        { id: '9d2e7f10', id_docente: 1, docente: 'Rosa Elena Cárdenas Villanueva', id_colegio: 2, colegio: 'I.E. 86024 Mancos', inicio: '2026-10-06T08:10:00', fin: null, estado: 'abierta', cambios: 7 },
        { id: '55c08ab1', id_docente: 2, docente: 'Luis Ramos', id_colegio: 3, colegio: 'I.E. 86031 Shupluy', inicio: '2026-10-05T09:00:00', fin: '2026-10-05T12:15:00', estado: 'pendiente', cambios: 12 },
      ]
      let filtradas = todas ? base : base.filter((s) => s.id_docente === 1)
      if (idDocente) filtradas = filtradas.filter((s) => String(s.id_docente) === String(idDocente))
      if (idColegio) filtradas = filtradas.filter((s) => String(s.id_colegio) === String(idColegio))
      if (fecha) filtradas = filtradas.filter((s) => s.inicio.slice(0, 10) === fecha)
      return responder(filtradas)
    },

    detalle: async (id) =>
      responder({
        id,
        cambios: [
          { id_cambio: `${id}-1`, entidad: 'Rúbrica — Pérez Quispe, Ana', campo: 'Fluidez', valor_anterior: 'Inicio', valor_nuevo: 'Proceso', fecha_cliente: '2026-10-05T09:12:00', fecha_servidor: '2026-10-05T11:41:00', diferido: true },
          { id_cambio: `${id}-2`, entidad: 'Asistencia — Ramírez López, Carlos', campo: 'Presente', valor_anterior: null, valor_nuevo: 'Ausente', fecha_cliente: '2026-10-05T09:20:00', fecha_servidor: '2026-10-05T11:41:00', diferido: true },
          { id_cambio: `${id}-3`, entidad: 'Seguimiento de Lectura — Pérez Quispe, Ana', campo: 'Libros de sala', valor_anterior: '2', valor_nuevo: '3', fecha_servidor: '2026-10-05T10:05:00', diferido: false },
        ],
      }),
  },

  auth: {
    /**
     * `POST /password/recuperar`. Responde 200 SIEMPRE, exista el correo o no:
     * si distinguiera, cualquiera podría probar direcciones para averiguar
     * quién tiene cuenta. El mock replica ese silencio a propósito.
     */
    async recuperarPassword({ correo }) {
      if (!esCorreoValido(correo)) throw errorHttp(422, 'El correo no es válido')
      return responder({ detail: 'Si el correo está registrado, enviamos un código de verificación' })
    },

    /** `POST /password/restablecer`. El código del mock es siempre `AB12CD`. */
    async restablecerPassword({ correo, codigo }) {
      if (!esCorreoValido(correo)) throw errorHttp(422, 'El correo no es válido')
      if (String(codigo ?? '').trim().toUpperCase() !== 'AB12CD') {
        throw errorHttp(400, 'El código no es válido o ya caducó')
      }
      return responder({ detail: 'Contraseña actualizada' }, RETARDO_ESCRITURA_MS)
    },

    async login({ correo, password }) {
      const usuario = db.USUARIOS.find((u) => u.correo.toLowerCase() === String(correo ?? '').trim().toLowerCase())
      // P1: un 401 nunca revela cuál de los dos campos falló.
      if (!usuario || password !== db.CLAVE_DEMO) throw errorHttp(401, 'Correo o contraseña incorrectos.')
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

    async passwordCodigo({ correo } = {}) {
      const email = String(correo ?? '').trim().toLowerCase()
      if (!email || !esCorreoValido(email)) {
        throw errorHttp(422, 'Debe indicar un correo válido')
      }
      return responder({ detail: 'Código enviado a tu correo' }, 150)
    },

    async verificarCodigo({ codigo } = {}) {
      const valor = String(codigo ?? '').trim().toUpperCase()
      if (valor?.length !== 6) {
        throw errorHttp(400, 'Código incorrecto o expirado')
      }
      return responder({ detail: 'Código correcto' }, 120)
    },

    async cambiarPassword({ codigo, contraseña_nueva, confirmar_contraseña_nueva } = {}) {
      const valor = String(codigo ?? '').trim().toUpperCase()
      const nueva = String(contraseña_nueva ?? '').trim()
      const confirmacion = String(confirmar_contraseña_nueva ?? '').trim()
      if (valor?.length !== 6 || !nueva || !confirmacion) {
        throw errorHttp(400, 'Código incorrecto o expirado')
      }
      if (nueva.length < 8) throw errorHttp(422, 'La contraseña debe tener al menos 8 caracteres')
      if (nueva !== confirmacion) throw errorHttp(422, 'Las contraseñas no coinciden')
      return responder({ detail: 'Contraseña actualizada' }, 150)
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
  // ── Fase 6 ──────────────────────────────────────────────────────────────────

  dashboard: {
    /**
     * Todo el dashboard (P12) en una sola respuesta. RF-006 pide una sola vista
     * con varios gráficos que reaccionan a los mismos filtros; con la conexión
     * del 70 % de RN-017, una petición es mejor que siete.
     */
    resumen: (filtros = {}) =>
      responder({
        indicadores: agregados.indicadores(filtros),
        distribucion: agregados.distribucion(filtros),
        variacion: agregados.variacion(filtros),
        alcanzado_vs_esperado: agregados.alcanzadoVsEsperado(filtros),
        fluidez_vs_comprension: agregados.fluidezVsComprension(filtros),
        evolucion_programas: agregados.evolucionPorPrograma(filtros),
        colegios: agregados.resumenPorColegio(filtros),
      }),
    rankingColegios: (filtros = {}) => responder(agregados.rankingColegios(filtros)),
    rankingAulas: (filtros = {}) => responder(agregados.rankingAulas(filtros)),
    ejecutivo: (filtros = {}) =>
      responder({
        indicadores: agregados.panelEjecutivo(filtros),
        evolucion_programas: agregados.evolucionPorPrograma(filtros),
        ranking: agregados.rankingColegios(filtros),
      }),
  },

  colegios: {
    detalle: (id, filtros = {}) => {
      const detalle = agregados.detalleColegio(id, filtros)
      if (!detalle) throw errorHttp(404, 'El colegio no existe')
      return responder(detalle)
    },
  },

  consolidados: {
    nivel: (filtros = {}) => responder(agregados.consolidadoNivel(filtros)),
    libros: (filtros = {}) => responder(agregados.consolidadoLibros(filtros)),
  },

  alertas: {
    listar: (filtros = {}) => responder(agregados.alertasInconsistencias(filtros)),
    marcarRevisada: (id) => responder(agregados.marcarAlertaRevisada(id), RETARDO_ESCRITURA_MS),
  },

  // ── Fase 7 ──────────────────────────────────────────────────────────────────

  administracion: {
    /** Valores existentes para los desplegables de filtro de colegios. */
    ubicaciones: () =>
      responder({
        departamentos: [...new Set(db.COLEGIOS.map((c) => c.departamento).filter(Boolean))],
        distritos: [...new Set(db.COLEGIOS.map((c) => c.distrito).filter(Boolean))],
      }),

    docentes: () =>
      responder(
        db.DOCENTES.map((d) => {
          const usuario = db.USUARIOS.find((u) => u.id_docente === d.id_docente)
          const vigentes = db.asignacionesDe(d.id_docente, db.PERIODO_VIGENTE.id_periodo)
          return {
            ...d,
            id_usuario: usuario?.id_usuario ?? null,
            nombre: `${d.nombres} ${d.apellidos}`,
            correo: usuario?.correo ?? null,
            activo: usuario?.activo ?? false,
            colegios_vigentes: vigentes.map((a) => db.COLEGIOS.find((c) => c.id_colegio === a.id_colegio)?.nombre),
          }
        }),
      ),

    colegios: () =>
      responder(
        db.COLEGIOS.map((c) => ({
          ...c,
          nombre: c.nombre,
          abreviatura: c.abreviatura,
          zona: c.zona,
          distrito: c.distrito,
        })),
      ),

    alumnos: () =>
      responder(
        db.ALUMNOS.map((a) => {
          const colegio = db.COLEGIOS.find((c) => c.id_colegio === a.id_colegio)
          const grado = db.GRADOS.find((g) => g.id_grado === a.id_grado)
          const programa = db.PROGRAMAS.find((p) => p.id_programa === a.id_programa)
          return {
            ...a,
            nombre: db.nombreCompleto(a),
            codigo: a.codigo,
            colegio: colegio?.nombre ?? '—',
            grado: grado?.nombre ?? a.id_grado,
            programa: programa?.nombre ?? '—',
          }
        }),
      ),

    usuarios: () =>
      responder(
        db.USUARIOS.map((u) => {
          const rol = { 1: 'Docente', 2: 'Supervisor', 3: 'Directivo' }[u.id_rol] ?? 'Usuario'
          return {
            ...u,
            nombre: `${u.nombres} ${u.apellidos}`,
            rol,
          }
        }),
      ),

    /** Baja lógica del colegio (D5): cambia el estado, no borra nada. */
    cambiarEstadoColegio: async (idColegio, activo) => {
      const colegio = db.COLEGIOS.find((c) => c.id_colegio === Number(idColegio))
      if (!colegio) throw errorHttp(404, `No existe un colegio con id_colegio=${idColegio}`)
      colegio.activo = Boolean(activo)
      return responder(colegio, RETARDO_ESCRITURA_MS)
    },

    /**
     * Auditoría de un registro. El mock devuelve un rastro de ejemplo para
     * poder construir y probar la pestaña; el backend aún no la publica.
     */
    auditoria: async (entidad, id) =>
      responder([
        {
          id_cambio: `${entidad}-${id}-2`,
          fecha: '2026-10-05T14:32:00',
          fecha_cliente: '2026-10-05T11:05:00',
          fecha_servidor: '2026-10-05T14:32:00',
          usuario: 'Docente de Prueba',
          campo: 'nombres',
          valor_anterior: 'Ana',
          valor_nuevo: 'Ana María',
          sesion_actividad_id: 'a3f1b2c4',
          diferido: true,
        },
        {
          id_cambio: `${entidad}-${id}-1`,
          fecha: '2026-10-04T09:10:00',
          usuario: 'Jefa de Prueba',
          campo: 'creación',
          valor_anterior: null,
          valor_nuevo: 'Registro creado',
          sesion_actividad_id: '9d2e7f10',
          diferido: false,
        },
      ]),

    /** Secciones de un colegio. Mientras el backend no las modele, van fijas. */
    secciones: async (idColegio) =>
      responder(
        ['A', 'B', 'C'].map((letra, i) => ({
          id_seccion: Number(idColegio) * 10 + i + 1,
          id_colegio: Number(idColegio),
          nombre: letra,
        })),
      ),

    asignaciones: () =>
      responder(
        db.ASIGNACIONES.map((a) => {
          const docente = db.DOCENTES.find((d) => d.id_docente === a.id_docente)
          const periodo = db.PERIODOS.find((p) => p.id_periodo === a.id_periodo)
          return {
            ...a,
            docente: docente ? `${docente.nombres} ${docente.apellidos}` : '—',
            colegio: db.COLEGIOS.find((c) => c.id_colegio === a.id_colegio)?.nombre ?? '—',
            periodo: periodo?.nombre ?? '—',
            estado_periodo: periodo?.estado ?? null,
          }
        }),
      ),

    /**
     * Igual que `POST /colegios`: solo exige nombre y zona, que es lo único que
     * guarda el backend. La abreviatura no se pide —se deduce del nombre— porque
     * solo la usan las etiquetas de los gráficos del propio mock.
     */
    crearColegio: async ({ nombre, zona }) => {
      const limpioNombre = String(nombre ?? '').trim()
      const limpioZona = String(zona ?? '').trim()
      if (!limpioNombre || !limpioZona) throw errorHttp(422, 'Completa el nombre y la zona del colegio')
      const repetido = db.COLEGIOS.some((c) => c.nombre.trim().toLowerCase() === limpioNombre.toLowerCase())
      if (repetido) throw errorHttp(422, 'Ya existe un colegio con ese nombre')
      const nuevo = {
        id_colegio: Math.max(...db.COLEGIOS.map((c) => c.id_colegio)) + 1,
        nombre: limpioNombre,
        abreviatura: limpioNombre.replace(/[^A-Za-zÁÉÍÓÚÑ ]/g, '').trim().split(/\s+/).slice(-2).map((x) => x[0] ?? '').join('').toUpperCase() || 'N/D',
        zona: limpioZona,
        distrito: limpioZona,
      }
      db.COLEGIOS.push(nuevo)
      return responder(nuevo, RETARDO_ESCRITURA_MS)
    },

    crearAlumno: async ({ nombres, apellidos, id_colegio: idColegio, id_grado: idGrado, id_programa: idPrograma, aula = 'A' }) => {
      const nombre = String(nombres ?? '').trim()
      const apellido = String(apellidos ?? '').trim()
      const colegioId = Number(idColegio)
      const gradoId = Number(idGrado)
      const programaId = Number(idPrograma)
      if (!nombre || !apellido || !colegioId || !gradoId || !programaId) {
        throw errorHttp(422, 'Completa nombre, colegio, grado y programa del alumno')
      }
      if (!db.COLEGIOS.some((c) => c.id_colegio === colegioId)) throw errorHttp(404, 'El colegio no existe')
      const ultimo = db.ALUMNOS.at(-1)
      const nuevo = {
        id_alumno: (ultimo?.id_alumno ?? 0) + 1,
        codigo: `EST-${db.COLEGIOS.find((c) => c.id_colegio === colegioId)?.abreviatura ?? 'NUE'}-${String((ultimo?.id_alumno ?? 0) + 1).padStart(4, '0')}`,
        nombres: nombre,
        apellidos: apellido,
        id_colegio: colegioId,
        id_grado: gradoId,
        aula: String(aula || 'A').toUpperCase(),
        id_ciclo_nominal: db.GRADOS.find((g) => g.id_grado === gradoId)?.id_ciclo ?? 1,
        id_ciclo_evaluado: db.GRADOS.find((g) => g.id_grado === gradoId)?.id_ciclo ?? 1,
        id_programa: programaId,
        activo: true,
      }
      db.ALUMNOS.push(nuevo)
      return responder(nuevo, RETARDO_ESCRITURA_MS)
    },

    /**
     * Alta de docente con la MISMA forma que `POST /profesores` del backend: no
     * recibe contraseña, la genera, y la devuelve en `contraseña_temporal` para
     * que el Supervisor pueda entregarla (el backend solo la devuelve cuando el
     * correo de bienvenida falla; aquí siempre, que es el caso útil en pruebas).
     */
    crearDocente: async ({ nombres, apellidos, correo }) => {
      const nombre = String(nombres ?? '').trim()
      const apellido = String(apellidos ?? '').trim()
      const email = String(correo ?? '').trim().toLowerCase()
      if (!nombre || !apellido || !email) throw errorHttp(422, 'Completa nombres, apellidos y correo')
      if (!esCorreoValido(email)) throw errorHttp(422, 'El correo no es válido')
      // El backend responde 409 cuando el correo ya está tomado.
      if (db.USUARIOS.some((u) => u.correo.toLowerCase() === email)) throw errorHttp(409, 'Ese correo ya está registrado')

      const idUsuario = Math.max(...db.USUARIOS.map((u) => u.id_usuario)) + 1
      const idDocente = Math.max(...db.DOCENTES.map((d) => d.id_docente)) + 1
      const temporal = `SICEDU-${String(idUsuario).padStart(3, '0')}`

      const nuevo = { id_usuario: idUsuario, id_rol: 1, correo: email, id_docente: idDocente, nombres: nombre, apellidos: apellido, activo: true }
      db.USUARIOS.push(nuevo)
      db.DOCENTES.push({ id_docente: idDocente, nombres: nombre, apellidos: apellido })
      return responder({ ...nuevo, 'contraseña_temporal': temporal }, RETARDO_ESCRITURA_MS)
    },

    /** Reactiva una cuenta desactivada (`PATCH /profesores/{id}/activar`). */
    activarUsuario: async (id) => {
      const usuario = db.USUARIOS.find((u) => u.id_usuario === Number(id))
      if (!usuario) throw errorHttp(404, 'El usuario no existe')
      usuario.activo = true
      return responder(usuario, RETARDO_ESCRITURA_MS)
    },

    /**
     * Misma forma que `POST /usuarios`: no recibe contraseña, la genera, y
     * devuelve `correo_enviado` para que la pantalla decida si mostrarla.
     * Rechaza el rol Docente, igual que el backend (para eso está crearDocente).
     */
    crearUsuario: async ({ nombres, apellidos, correo, id_rol: idRol }) => {
      const nombre = String(nombres ?? '').trim()
      const apellido = String(apellidos ?? '').trim()
      const email = String(correo ?? '').trim().toLowerCase()
      const rol = Number(idRol)
      if (!nombre || !apellido || !email || !rol) throw errorHttp(422, 'Completa todos los datos del usuario')
      if (!esCorreoValido(email)) throw errorHttp(422, 'El correo no es válido')
      // Ya NO se rechaza el rol Docente: `/profesores` desapareció y este es
      // el único alta de los tres roles. Con id_rol de Docente, el backend crea
      // además su ficha y sus asignaciones en la misma transacción.
      if (db.USUARIOS.some((u) => u.correo.toLowerCase() === email)) throw errorHttp(409, 'Ese correo ya está registrado')

      const idUsuario = Math.max(...db.USUARIOS.map((u) => u.id_usuario)) + 1
      const nuevo = { id_usuario: idUsuario, id_rol: rol, correo: email, id_docente: null, nombres: nombre, apellidos: apellido, activo: true }
      db.USUARIOS.push(nuevo)
      // Sin SMTP configurado el envío falla, que es el caso habitual hoy.
      return responder({ ...nuevo, 'contraseña_temporal': `SICEDU-${String(idUsuario).padStart(3, '0')}`, correo_enviado: false }, RETARDO_ESCRITURA_MS)
    },

    actualizarUsuario: async (id, { nombres, apellidos, correo, id_rol: idRol, password }) => {
      const usuario = db.USUARIOS.find((u) => u.id_usuario === Number(id))
      if (!usuario) throw errorHttp(404, 'El usuario no existe')
      const nombre = String(nombres ?? usuario.nombres).trim()
      const apellido = String(apellidos ?? usuario.apellidos).trim()
      const email = String(correo ?? usuario.correo).trim().toLowerCase()
      const rol = Number(idRol ?? usuario.id_rol)
      if (!nombre || !apellido || !email || !rol) throw errorHttp(422, 'Completa todos los campos del usuario')
      if (!esCorreoValido(email)) throw errorHttp(422, 'El correo no es válido')
      if (db.USUARIOS.some((u) => u.id_usuario !== Number(id) && u.correo.toLowerCase() === email)) throw errorHttp(422, 'Ese correo ya está registrado')

      const anteriorRol = usuario.id_rol
      usuario.nombres = nombre
      usuario.apellidos = apellido
      usuario.correo = email
      usuario.id_rol = rol

      if (rol === 1) {
        if (!usuario.id_docente) {
          const siguienteIdDocente = Math.max(...db.DOCENTES.map((d) => d.id_docente)) + 1
          usuario.id_docente = siguienteIdDocente
          db.DOCENTES.push({ id_docente: siguienteIdDocente, nombres: nombre, apellidos: apellido })
        } else {
          const docente = db.DOCENTES.find((d) => d.id_docente === usuario.id_docente)
          if (docente) {
            docente.nombres = nombre
            docente.apellidos = apellido
          }
        }
      } else if (anteriorRol === 1 && usuario.id_docente) {
        usuario.id_docente = null
      }

      if (password && String(password).trim()) {
        usuario.password = String(password).trim()
      }
      return responder(usuario, RETARDO_ESCRITURA_MS)
    },

    /**
     * Baja lógica. Replica las dos reglas que aplica el servidor: no se puede
     * dejar sin la última cuenta activa de Supervisor ni de Directivo (409).
     */
    desactivarUsuario: async (id) => {
      const usuario = db.USUARIOS.find((u) => u.id_usuario === Number(id))
      if (!usuario) throw errorHttp(404, `No existe un usuario con id_usuario=${id}`)
      const NOMBRE = { 2: 'Supervisor', 3: 'Directivo' }
      if (NOMBRE[usuario.id_rol]) {
        const activos = db.USUARIOS.filter((u) => u.activo && u.id_rol === usuario.id_rol).length
        if (activos <= 1) {
          throw errorHttp(409, `No puedes desactivar la última cuenta activa de ${NOMBRE[usuario.id_rol]}`)
        }
      }
      usuario.activo = false
      return responder(usuario, RETARDO_ESCRITURA_MS)
    },

    actualizarAlumno: async (id, cambios) => {
      const alumno = db.ALUMNOS.find((a) => a.id_alumno === Number(id))
      if (!alumno) throw errorHttp(404, `No existe un alumno con id_alumno=${id}`)
      Object.assign(alumno, cambios)
      return responder(alumno, RETARDO_ESCRITURA_MS)
    },

    actualizarColegio: async (id, cambios) => {
      const colegio = db.COLEGIOS.find((c) => c.id_colegio === Number(id))
      if (!colegio) throw errorHttp(404, `No existe un colegio con id_colegio=${id}`)
      Object.assign(colegio, Object.fromEntries(Object.entries(cambios).filter(([, v]) => v != null)))
      return responder(colegio, RETARDO_ESCRITURA_MS)
    },

    /**
     * RN-003: la rotación ocurre SOLO al cierre de un periodo y cambia el colegio
     * completo, no grados sueltos. Por eso la asignación es docente × colegio ×
     * periodo (los seis grados van juntos) y solo se admite sobre periodos que
     * todavía no empiezan.
     */
    crearAsignacion: async ({ id_docente: idDocente, id_colegio: idColegio, id_periodo: idPeriodo }) => {
      const periodo = db.PERIODOS.find((p) => p.id_periodo === Number(idPeriodo))
      if (!periodo) throw errorHttp(422, 'El periodo no existe')
      if (periodo.estado !== 'programado') {
        throw errorHttp(422, 'Solo se asigna en periodos que aún no empiezan: la rotación ocurre al cierre de un periodo')
      }
      const repetida = db.ASIGNACIONES.some(
        (a) => a.id_docente === Number(idDocente) && a.id_colegio === Number(idColegio) && a.id_periodo === Number(idPeriodo),
      )
      if (repetida) throw errorHttp(422, 'El docente ya tiene ese colegio en ese periodo')

      const nueva = {
        id_asignacion: Math.max(...db.ASIGNACIONES.map((a) => a.id_asignacion)) + 1,
        id_docente: Number(idDocente),
        id_colegio: Number(idColegio),
        id_periodo: Number(idPeriodo),
        grados: db.GRADOS.map((g) => g.id_grado),
      }
      db.ASIGNACIONES.push(nueva)
      return responder(nueva, RETARDO_ESCRITURA_MS)
    },

    eliminarAsignacion: async (idAsignacion) => {
      const indice = db.ASIGNACIONES.findIndex((a) => a.id_asignacion === Number(idAsignacion))
      if (indice < 0) throw errorHttp(404, 'La asignación no existe')
      const periodo = db.PERIODOS.find((p) => p.id_periodo === db.ASIGNACIONES[indice].id_periodo)
      if (periodo?.estado !== 'programado') {
        throw errorHttp(422, 'No se retira una asignación de un periodo en curso o cerrado')
      }
      db.ASIGNACIONES.splice(indice, 1)
      return responder({ ok: true }, RETARDO_ESCRITURA_MS)
    },
  },
}

export default handlers
