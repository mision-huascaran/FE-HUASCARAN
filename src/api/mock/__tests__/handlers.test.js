// Los handlers son el contrato con el que se construyen las pantallas mientras
// el backend se termina: si su forma cambia, las pantallas se rompen calladas.
import { describe, expect, it } from 'vitest'
import handlers from '../handlers'
import * as db from '../db'

const DOCENTE = db.USUARIOS.find((u) => u.id_rol === 1)

describe('auth', () => {
  it('devuelve un token con las credenciales correctas', async () => {
    const respuesta = await handlers.auth.login({ correo: DOCENTE.correo, password: db.CLAVE_DEMO })
    expect(respuesta.token_type).toBe('bearer')
    const perfil = await handlers.auth.me(respuesta.access_token)
    expect(perfil).toMatchObject({ id_rol: 1, correo: DOCENTE.correo })
    expect(perfil).not.toHaveProperty('password')
  })

  it('responde 401 sin distinguir correo de contraseña', async () => {
    await expect(handlers.auth.login({ correo: DOCENTE.correo, password: 'incorrecta' })).rejects.toMatchObject({
      response: { status: 401 },
    })
    await expect(handlers.auth.login({ correo: 'nadie@sicedu.test', password: db.CLAVE_DEMO })).rejects.toMatchObject({
      response: { status: 401 },
    })
  })
})

describe('panel del docente (P3)', () => {
  it('resume sus asignaciones, su avance semanal y el corte abierto', async () => {
    const resumen = await handlers.docentes.resumen(DOCENTE.id_docente, {
      periodo: db.PERIODO_VIGENTE.id_periodo,
      semana: db.SEMANA_ACTUAL.id_semana,
    })

    expect(resumen.mis_estudiantes).toBeGreaterThan(0)
    expect(resumen.reporte_semana.registrados).toBeLessThanOrEqual(resumen.reporte_semana.total)
    // RN-003: dos colegios con sus seis grados cada uno.
    expect(resumen.asignaciones).toHaveLength(12)
    expect(resumen.evaluacion_abierta).toMatchObject({ nombre: db.PERIODO_VIGENTE.nombre })
  })
})

describe('captura semanal (P4/P5)', () => {
  const filtros = { semana: db.SEMANA_ACTUAL.id_semana, colegio: 1, grado: 1 }

  it('trae una fila por alumno, con sus columnas de referencia bloqueadas', async () => {
    const filas = await handlers.semanal.listar(filtros)
    expect(filas.length).toBeGreaterThan(0)
    expect(filas[0]).toHaveProperty('referencia.nivel_esperado_razkids')
    expect(filas[0]).toHaveProperty('referencia.nivel_colocado')
  })

  it('sin asistencia descarta libros, sala de lectura y observación', async () => {
    const [fila] = await handlers.semanal.listar(filtros)
    const guardada = await handlers.semanal.guardar({
      id_alumno: fila.id_alumno,
      id_semana: filtros.semana,
      asistio: false,
      lsl: 3,
      libros: [{ titulo: 'X', aciertos: 1, total: 5 }],
      observacion: 'algo',
    })
    expect(guardada.lsl).toBe(0)
    expect(guardada.libros).toHaveLength(0)
    expect(guardada.observacion).toBe('')
  })

  it('rechaza una rúbrica con una sola dimensión (RN-008)', async () => {
    const [fila] = await handlers.rubrica.listar(filtros)
    await expect(
      handlers.rubrica.guardar({
        id_alumno: fila.id_alumno,
        id_semana: filtros.semana,
        id_nivel_fluidez: 1,
        id_nivel_comprension: null,
      }),
    ).rejects.toMatchObject({ response: { status: 422 } })
  })
})

// ── Fase 4: evaluaciones diagnósticas (P6, P7, P8) ──────────────────────────

const ALUMNO = db.ALUMNOS[0]
const PERIODO_ABIERTO = db.PERIODOS.find((p) => p.estado === 'abierto')

const evaluacionValida = (extra = {}) => ({
  id_alumno: ALUMNO.id_alumno,
  id_periodo: PERIODO_ABIERTO.id_periodo,
  nivel_inicial_razkids: 'D',
  nivel_prueba: 'D',
  aciertos: 4,
  total: 5,
  fluidez: 'Proceso',
  comprension: 'Logrado',
  nivel_sugerido: 'E',
  nivel_ajustado: 'E',
  nivel_general: 'Logrado',
  estado: 'revisado',
  ...extra,
})

describe('registro de vuelo (P6)', () => {
  it('devuelve una fila por alumno con sus cuatro cortes y su secuencia', async () => {
    const filas = await handlers.evaluaciones.listar({ colegio: ALUMNO.id_colegio, grado: ALUMNO.id_grado })
    expect(filas.length).toBeGreaterThan(0)

    const fila = filas[0]
    expect(fila).toHaveProperty('por_periodo')
    expect(Object.keys(fila.por_periodo)).toHaveLength(db.PERIODOS.length)
    // La secuencia viaja con `orden`, para que el cliente compare por catálogo
    // y no por la letra como texto (RN-012).
    fila.secuencia.forEach((s) => expect(typeof s.orden).toBe('number'))
  })

  it('adjunta la línea de tiempo de cada evaluación (RF-024)', async () => {
    const filas = await handlers.evaluaciones.listar({ colegio: ALUMNO.id_colegio })
    const conEvaluacion = filas.find((f) => f.evaluacion)
    expect(conEvaluacion.evaluacion.trazabilidad.length).toBeGreaterThanOrEqual(2)
    expect(conEvaluacion.evaluacion.trazabilidad[0].tipo).toBe('sistema')
    expect(conEvaluacion.evaluacion.trazabilidad.at(-1).tipo).toBe('confirmado')
  })
})

describe('guardar una evaluación (RN-008, RN-015)', () => {
  it('rechaza la rúbrica con una sola dimensión', async () => {
    await expect(handlers.evaluaciones.guardar(evaluacionValida({ comprension: '' }))).rejects.toMatchObject({
      response: { status: 422 },
    })
  })

  it('rechaza cambiar el nivel sugerido sin justificación', async () => {
    await expect(
      handlers.evaluaciones.guardar(evaluacionValida({ nivel_ajustado: 'F' })),
    ).rejects.toMatchObject({ response: { status: 422 } })
  })

  it('acepta el cambio cuando viene justificado y deja el rastro', async () => {
    const guardada = await handlers.evaluaciones.guardar(
      evaluacionValida({ nivel_ajustado: 'F', justificacion: 'Rinde mejor en aula que en la prueba.' }),
    )
    expect(guardada.ajustado_por_docente).toBe(true)
    expect(guardada.justificacion).toBeTruthy()
    expect(guardada.trazabilidad.some((h) => h.tipo === 'docente')).toBe(true)
  })

  it('es idempotente por alumno-periodo: reenviar no duplica (RNF-001)', async () => {
    const antes = db.EVALUACIONES.filter(
      (e) => e.id_alumno === ALUMNO.id_alumno && e.id_periodo === PERIODO_ABIERTO.id_periodo,
    ).length
    await handlers.evaluaciones.guardar(evaluacionValida())
    await handlers.evaluaciones.guardar(evaluacionValida())
    const despues = db.EVALUACIONES.filter(
      (e) => e.id_alumno === ALUMNO.id_alumno && e.id_periodo === PERIODO_ABIERTO.id_periodo,
    ).length
    expect(despues).toBe(Math.max(1, antes))
  })
})

// ── Fase 5: nivel final mensual (P9) y ficha del estudiante (P11) ───────────

describe('nivel final mensual (P9, RF-018)', () => {
  it('se deriva de las rúbricas semanales y declara cuántas lo sustentan', async () => {
    const filas = await handlers.nivelFinal.listar({ mes: db.MES_ACTUAL, colegio: ALUMNO.id_colegio })
    expect(filas.length).toBeGreaterThan(0)
    filas.forEach((f) => {
      expect(f.semanas_sustento).toBeGreaterThan(0)
      expect(f.semanas_sustento).toBeLessThanOrEqual(f.semanas_mes)
      expect(f.nivel_calculado).toBeTruthy()
    })
  })

  it('rechaza un ajuste sin justificación (RN-015)', async () => {
    const [fila] = await handlers.nivelFinal.listar({ mes: db.MES_ACTUAL, colegio: ALUMNO.id_colegio })
    await expect(
      handlers.nivelFinal.ajustar({ mes: db.MES_ACTUAL, id_alumno: fila.id_alumno, nivel_final: 'Destacado', justificacion: '  ' }),
    ).rejects.toMatchObject({ response: { status: 422 } })
  })

  it('guarda el ajuste justificado y marca la fila como ajustada', async () => {
    const [fila] = await handlers.nivelFinal.listar({ mes: db.MES_ACTUAL, colegio: ALUMNO.id_colegio })
    const otro = db.NIVEL_GENERAL.find((n) => n.nombre_nivel !== fila.nivel_calculado)
    const guardada = await handlers.nivelFinal.ajustar({
      mes: db.MES_ACTUAL,
      id_alumno: fila.id_alumno,
      nivel_final: otro.nombre_nivel,
      justificacion: 'Su desempeño en aula sostiene un nivel distinto.',
    })
    expect(guardada.ajustado).toBe(true)
    expect(guardada.nivel_final).toBe(otro.nombre_nivel)
  })
})

describe('ficha del estudiante (P11)', () => {
  it('no expone más datos personales que nombre, código y datos académicos (RN-019)', async () => {
    const ficha = await handlers.alumnos.detalle(ALUMNO.id_alumno)
    const prohibidos = ['dni', 'fecha_nacimiento', 'direccion', 'foto', 'telefono', 'apoderado']
    prohibidos.forEach((clave) => expect(ficha).not.toHaveProperty(clave))
    expect(ficha.nombre).toBeTruthy()
    expect(ficha.codigo).toBeTruthy()
  })

  it('entrega la evolución de los cuatro cortes con el nivel esperado de referencia', async () => {
    const historial = await handlers.alumnos.historial(ALUMNO.id_alumno)
    expect(historial.evolucion).toHaveLength(db.PERIODOS.length)
    historial.evolucion.forEach((punto) => {
      expect(punto.periodo).toBeTruthy()
      expect(punto.orden_esperado).toBeGreaterThan(0)
    })
  })

  it('separa los libros de subir de nivel de los de sala de lectura (RF-015)', async () => {
    const historial = await handlers.alumnos.historial(ALUMNO.id_alumno)
    historial.libros.forEach((semana) => {
      expect(typeof semana.lsl).toBe('number')
      semana.libros.forEach((libro) => {
        expect(libro.titulo).toBeTruthy()
        expect(typeof libro.aciertos).toBe('number')
        expect(typeof libro.total).toBe('number')
      })
    })
  })
})
