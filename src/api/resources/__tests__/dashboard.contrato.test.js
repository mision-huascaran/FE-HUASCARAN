// El contrato del Dashboard con el backend (S23).
//
// Cada ejemplo tiene la forma COMPLETA del modelo de `app/schemas/dashboard.py`
// de BCK-SICEDU (todos los campos, también los anidados) y pasa por su
// `adaptarX`; lo que se comprueba es lo que lee la pantalla. Abajo, el
// simulador se compara campo a campo con los mismos modelos: si alguien vuelve
// a "inventar" un nombre en el mock, falla aquí y no contra el servidor.
import { describe, expect, it } from 'vitest'
import * as panel from '../../mock/dashboard'
import {
  adaptarAsistencia,
  adaptarClasesDeAsistencia,
  adaptarComparacionColegios,
  adaptarComparacionResultados,
  adaptarDesgloseDeLibros,
  adaptarDistribucion,
  adaptarEvolucion,
  adaptarFiltros,
  adaptarLibros,
  adaptarLibrosDeColegio,
  adaptarResultados,
} from '../dashboard'

const TERCER_PERIODO = { id: 33, numero: 3, nombre: 'Tercer periodo' }
const CORTE = '2026-10-29'
const QUISPE = { id: 77, nombre: 'Quispe, Ana' }

const CONTEXTO = {
  anio_escolar: { id: 2, nombre: '2026' },
  periodo: TERCER_PERIODO,
  colegios: [
    { id: 1, nombre: 'Ranrahirca' },
    { id: 5, nombre: 'Yanama' },
  ],
  alcance: 'todos',
  fecha_consulta: '2026-10-29T15:00:00Z',
  intervalo: { desde: '2026-08-16', hasta: '2026-10-31' },
  parcial: true,
}
const CONTEXTO_ANUAL = { ...CONTEXTO, periodo: null, intervalo: { desde: '2026-03-01', hasta: '2026-12-18' } }

const RANRAHIRCA = { id: 1, nombre: 'Ranrahirca' }
const YANAMA = { id: 5, nombre: 'Yanama' }
const SIN_PERIODO = { colegio: YANAMA, motivo: 'periodo_no_iniciado' }
const ALFABETIZACION = 'Alfabetización'
const ALFA = { id: 1, nombre: ALFABETIZACION }
const PRIMERO = { id: 1, nombre: '1.°' }
const SECCION_A = { id: 7, nombre: 'A' }

/** Ningún campo leído por la pantalla puede quedar en `undefined`. */
const sinIndefinidos = (objeto, nombres) => {
  const presentes = new Map(Object.entries(objeto))
  expect(nombres.filter((n) => presentes.get(n) === undefined)).toEqual([])
}

describe('adaptarFiltros', () => {
  it('pasa de `id` al id con nombre que usan los filtros', () => {
    const r = adaptarFiltros({
      colegios: [RANRAHIRCA],
      anios: [{ id: 2, nombre: '2026', periodos: [TERCER_PERIODO] }],
      seleccion_inicial: { id_anio_escolar: 2, id_periodo_academico: 33 },
    })
    expect(r.colegios).toEqual([{ id_colegio: 1, nombre: 'Ranrahirca' }])
    expect(r.anios[0]).toEqual({
      id_anio_escolar: 2,
      nombre: '2026',
      periodos: [{ id_periodo_academico: 33, numero: 3, nombre: 'Tercer periodo' }],
    })
    expect(r.seleccion_inicial).toEqual({ id_anio_escolar: 2, id_periodo_academico: 33 })
  })

  it('una selección inicial null sigue siendo null: no se aproxima', () => {
    expect(adaptarFiltros({ colegios: [], anios: [], seleccion_inicial: null }).seleccion_inicial).toBeNull()
  })
})

describe('adaptarDistribucion', () => {
  const RESPUESTA = {
    contexto: CONTEXTO,
    fechas_corte: [{ colegio: RANRAHIRCA, fecha: CORTE }],
    colegios_sin_informacion: [SIN_PERIODO],
    total: 40,
    subprogramas: [{ subprograma: ALFA, alumnos: 30, porcentaje: 75.0 }],
    sin_datos: false,
    mensaje: null,
  }

  it('`alumnos` del backend es la `cantidad` de la tabla y la dona', () => {
    const r = adaptarDistribucion(RESPUESTA)
    expect(r.subprogramas).toEqual([{ id_programa: 1, nombre: ALFABETIZACION, cantidad: 30, porcentaje: 75.0 }])
    expect(r.fechas_corte[0]).toEqual({ id_colegio: 1, nombre: 'Ranrahirca', fecha: CORTE })
    expect(r.colegios_sin_informacion[0]).toEqual({ id_colegio: 5, nombre: 'Yanama', motivo: 'periodo_no_iniciado' })
    expect(r.contexto).toEqual(CONTEXTO)
  })

  it('sin alumnos, `total` sigue en null y el mensaje se conserva', () => {
    const r = adaptarDistribucion({ ...RESPUESTA, total: null, subprogramas: [], sin_datos: true, mensaje: 'Sin datos' })
    expect(r.total).toBeNull()
    expect(r.sin_datos).toBe(true)
    expect(r.mensaje).toBe('Sin datos')
  })
})

describe('adaptarResultados', () => {
  const distribucion = (resultado, fuente, evaluados, pendientes) => ({
    resultado,
    fuente,
    niveles: ['Inicio', 'En proceso', 'Logrado', 'Avanzado'].map((nombre, i) => ({
      nombre,
      alumnos: evaluados ? i + 1 : 0,
      porcentaje: evaluados ? 10.0 * (i + 1) : null,
    })),
    evaluados,
    pendientes,
    base_porcentaje: 'evaluados',
    mensaje: evaluados ? null : 'No hay evaluaciones completas para esta selección.',
  })
  const RESPUESTA = {
    contexto: CONTEXTO,
    fechas_corte: [{ colegio: RANRAHIRCA, fecha: CORTE }],
    colegios_sin_informacion: [SIN_PERIODO],
    subprogramas: [
      {
        subprograma: ALFA,
        total_a_evaluar: 12,
        distribuciones: [
          distribucion('global', 'registro_vuelo', 10, 2),
          distribucion('fluidez', 'rubrica', 12, 0),
          distribucion('comprension', 'rubrica', 0, 12),
        ],
      },
    ],
    sin_datos: false,
    mensaje: null,
  }

  it('`total_a_evaluar` del subprograma llega a CADA dimensión', () => {
    const [programa] = adaptarResultados(RESPUESTA).programas
    expect(programa).toMatchObject({ id_programa: 1, nombre: ALFABETIZACION, total_a_evaluar: 12 })
    expect(programa.dimensiones.map((d) => d.a_evaluar)).toEqual([12, 12, 12])
  })

  it('cada dimensión conserva su recuento, su fuente y su mensaje', () => {
    const [global, fluidez, comprension] = adaptarResultados(RESPUESTA).programas[0].dimensiones
    expect(global).toMatchObject({ clave: 'global', nombre: 'Nivel global', fuente: 'registro_vuelo', evaluados: 10, pendientes: 2 })
    expect(global.estado).toBe('evaluacion_incompleta')
    expect(global.niveles[0]).toEqual({ nombre: 'Inicio', cantidad: 1, porcentaje: 10.0 })
    expect(fluidez).toMatchObject({ nombre: 'Fluidez Lectora', estado: 'completo' })
    expect(comprension).toMatchObject({ nombre: 'Comprensión Lectora', estado: 'sin_evaluaciones' })
    expect(comprension.mensaje).toBe('No hay evaluaciones completas para esta selección.')
  })

  it('un porcentaje null sigue siendo null, no 0', () => {
    const comprension = adaptarResultados(RESPUESTA).programas[0].dimensiones[2]
    expect(comprension.niveles.every((n) => n.porcentaje === null)).toBe(true)
  })
})

describe('adaptarComparacionResultados', () => {
  const RESPUESTA = {
    contexto: CONTEXTO,
    fechas_corte: [{ colegio: RANRAHIRCA, fecha: CORTE }],
    colegios_sin_informacion: [SIN_PERIODO],
    subprograma: ALFA,
    grados: [PRIMERO],
    vista: 'detalle_grado',
    resultado: 'global',
    escala: [
      { codigo: 'Inicio', nombre: 'Inicio', valor_indice: 1 },
      { codigo: 'Logrado', nombre: 'Logrado', valor_indice: 3 },
    ],
    ranking: [
      {
        posicion: 1,
        provisional: true,
        evaluacion_incompleta: true,
        colegio: RANRAHIRCA,
        grado: PRIMERO,
        indice: 2.5,
        total_a_evaluar: 5,
        evaluados: 4,
        pendientes: 1,
        distribucion: [
          { codigo: 'Inicio', alumnos: 2, porcentaje: 50.0 },
          { codigo: 'Logrado', alumnos: 2, porcentaje: 50.0 },
        ],
      },
    ],
    sin_evaluaciones: [{ colegio: { id: 4, nombre: 'Cascapara' }, grado: PRIMERO, total_a_evaluar: 3, evaluados: 0, pendientes: 3 }],
    no_aplica: [{ colegio: { id: 8, nombre: 'Shilla' }, grado: null }],
  }

  it('`ranking` es la tabla y cada nivel toma su nombre de la escala', () => {
    const r = adaptarComparacionResultados(RESPUESTA)
    expect(r.programa).toBe(ALFABETIZACION)
    expect(r.grupos[0]).toMatchObject({
      posicion: 1,
      id_colegio: 1,
      id_grado: 1,
      nombre: 'Ranrahirca · 1.°',
      indice: 2.5,
      a_evaluar: 5,
      evaluados: 4,
      pendientes: 1,
      estado: 'evaluacion_incompleta',
    })
    expect(r.grupos[0].niveles).toEqual([
      { codigo: 'Inicio', nombre: 'Inicio', cantidad: 2, porcentaje: 50.0 },
      { codigo: 'Logrado', nombre: 'Logrado', cantidad: 2, porcentaje: 50.0 },
    ])
    expect(r.escala.map((n) => n.nombre)).toEqual(['Inicio', 'Logrado'])
  })

  it('sin evaluaciones y no aplica van aparte, con su nombre', () => {
    const r = adaptarComparacionResultados(RESPUESTA)
    expect(r.sin_evaluaciones[0]).toMatchObject({ nombre: 'Cascapara · 1.°', pendientes: 3, a_evaluar: 3 })
    expect(r.no_aplica[0]).toMatchObject({ nombre: 'Shilla', id_grado: null, estado: 'no_aplica' })
  })
})

describe('adaptarAsistencia', () => {
  const CONTEO = {
    porcentaje: 92.3,
    presentes: 100,
    tardanzas: 20,
    ausentes: 10,
    sin_marcar: 3,
    clases_dictadas: 12,
    clases_incompletas: 1,
    clases_sin_registro: 2,
    provisional: true,
  }
  const RESPUESTA = {
    contexto: CONTEXTO,
    resumen: { ...CONTEO, asistencias_esperadas: 133, asistencias_completadas: 130, mensaje: null },
    mensual: [
      { anio: 2026, mes: 8, estado: 'con_datos', porcentaje: 93.1, presentes: 50, tardanzas: 4, ausentes: 4, sin_marcar: 0, provisional: false },
      { anio: 2026, mes: 10, estado: 'en_curso', porcentaje: 90.0, presentes: 9, tardanzas: 0, ausentes: 1, sin_marcar: 3, provisional: true },
      { anio: 2026, mes: 11, estado: 'futuro', porcentaje: null, presentes: null, tardanzas: null, ausentes: null, sin_marcar: null, provisional: null },
    ],
    por_colegio: [{ ...CONTEO, colegio: RANRAHIRCA }],
    colegios_sin_informacion: [SIN_PERIODO],
  }

  it('`por_colegio` es la tabla y `clases_incompletas` el contador de pendientes', () => {
    const r = adaptarAsistencia(RESPUESTA)
    expect(r.resumen.clases_registro_incompleto).toBe(1)
    expect(r.resumen).toMatchObject({ asistencias_esperadas: 133, asistencias_completadas: 130 })
    expect(r.colegios[0]).toMatchObject({ id_colegio: 1, nombre: 'Ranrahirca', clases_registro_incompleto: 1, porcentaje: 92.3 })
    sinIndefinidos(r.colegios[0], ['presentes', 'tardanzas', 'ausentes', 'sin_marcar', 'clases_sin_registro'])
  })

  it('los meses llevan nombre y el futuro sigue sin valor', () => {
    const r = adaptarAsistencia(RESPUESTA)
    expect(r.mensual.map((m) => m.nombre)).toEqual(['Agosto 2026', 'Octubre 2026', 'Noviembre 2026'])
    expect(r.mensual[2]).toMatchObject({ estado: 'futuro', porcentaje: null })
  })

  it('sin estados registrados, el porcentaje sigue en null', () => {
    const r = adaptarAsistencia({ ...RESPUESTA, resumen: { ...RESPUESTA.resumen, porcentaje: null, mensaje: 'Sin información' } })
    expect(r.resumen.porcentaje).toBeNull()
    expect(r.resumen.mensaje).toBe('Sin información')
  })
})

describe('adaptarClasesDeAsistencia', () => {
  const RESPUESTA = {
    contexto: CONTEXTO,
    grupos: [
      {
        grado: PRIMERO,
        seccion: SECCION_A,
        resumen: {
          porcentaje: null,
          presentes: 0,
          tardanzas: 0,
          ausentes: 0,
          sin_marcar: 4,
          clases_dictadas: 1,
          clases_incompletas: 1,
          clases_sin_registro: 1,
          provisional: true,
        },
        clases: [
          {
            id_clase: 501,
            fecha: '2026-09-02',
            tipo: 'habitual',
            reprogramada: false,
            lista_historica: 4,
            presentes: 0,
            tardanzas: 0,
            ausentes: 0,
            sin_marcar: 4,
            porcentaje: null,
            estado: 'registro_incompleto',
          },
        ],
        clases_sin_registro: [
          { id_clase: null, fecha: '2026-09-09', tipo: 'habitual', reprogramada: true, fecha_original: '2026-09-08' },
        ],
      },
    ],
  }

  it('las clases sin registro aparecen separadas y sin conteos', () => {
    const r = adaptarClasesDeAsistencia(RESPUESTA)
    expect(r.clases).toHaveLength(1)
    expect(r.clases_sin_registro).toHaveLength(1)
    const [sinRegistro] = r.clases_sin_registro
    expect(sinRegistro).toMatchObject({ fecha: '2026-09-09', grado: PRIMERO, seccion: SECCION_A, fecha_original: '2026-09-08' })
    for (const conteo of ['presentes', 'tardanzas', 'ausentes', 'sin_marcar', 'porcentaje', 'alumnos', 'lista_historica']) {
      expect(sinRegistro).not.toHaveProperty(conteo)
    }
  })

  it('una clase dictada lleva su lista histórica como alumnos y su grupo', () => {
    const [clase] = adaptarClasesDeAsistencia(RESPUESTA).clases
    expect(clase).toMatchObject({ id_clase: 501, alumnos: 4, grado: PRIMERO, seccion: SECCION_A, estado: 'registro_incompleto' })
    expect(clase.porcentaje).toBeNull()
    expect(adaptarClasesDeAsistencia(RESPUESTA).grados).toEqual([PRIMERO])
  })
})

const MES = (mes, estado, total, enCurso = false) => ({ anio: 2026, mes, estado, total, en_curso: enCurso })

describe('adaptarLibros', () => {
  const RESPUESTA = {
    contexto: CONTEXTO_ANUAL,
    resumen: { total: 80, estado: 'incompleto', provisional: true, alumnos_incluidos: 40, promedio: 2.0, etiqueta: 'Total registrado hasta el momento' },
    meses: [MES(3, 'completo', 30), MES(10, 'incompleto', 50, true), MES(11, 'futuro', null)],
    colegios: [
      {
        posicion: 1,
        provisional: true,
        colegio: RANRAHIRCA,
        total: 80,
        estado: 'incompleto',
        alumnos_incluidos: 40,
        promedio: 2.0,
        meses: [MES(3, 'completo', 0), MES(11, 'futuro', null)],
      },
    ],
    colegios_sin_informacion: [{ colegio: { id: 9, nombre: 'Tinco' }, alumnos_incluidos: 12, motivo: 'sin_informacion' }],
  }

  it('`colegios_sin_informacion` es la lista sin posición de la pantalla', () => {
    const r = adaptarLibros(RESPUESTA)
    expect(r.sin_informacion).toEqual([{ id_colegio: 9, nombre: 'Tinco', alumnos_incluidos: 12, alumnos: 12, motivo: 'sin_informacion' }])
  })

  it('los meses llevan nombre y `cantidad`, y un 0 confirmado sigue siendo 0', () => {
    const r = adaptarLibros(RESPUESTA)
    expect(r.meses[0]).toMatchObject({ nombre: 'Marzo 2026', cantidad: 30, estado: 'completo' })
    expect(r.meses[1]).toMatchObject({ cantidad: 50, en_curso: true })
    expect(r.meses[2]).toMatchObject({ cantidad: null, estado: 'futuro' })
    expect(r.colegios[0].meses[0].cantidad).toBe(0)
    expect(r.colegios[0]).toMatchObject({ id_colegio: 1, nombre: 'Ranrahirca', alumnos: 40, promedio: 2.0, posicion: 1 })
    expect(r.resumen).toMatchObject({ alumnos: 40, etiqueta: 'Total registrado hasta el momento' })
  })

  it('total y promedio null siguen en null', () => {
    const r = adaptarLibros({
      ...RESPUESTA,
      resumen: { ...RESPUESTA.resumen, total: null, promedio: null, estado: 'sin_informacion', provisional: false, etiqueta: null },
    })
    expect(r.resumen.total).toBeNull()
    expect(r.resumen.promedio).toBeNull()
  })
})

describe('adaptarLibrosDeColegio', () => {
  const alumno = { alumno: QUISPE, total: null, estado: 'sin_informacion', meses: [MES(3, 'sin_informacion', null)] }
  const grado = (posicion, promedio) => ({
    posicion,
    provisional: false,
    grado: PRIMERO,
    total: promedio == null ? null : 10,
    estado: promedio == null ? 'sin_informacion' : 'completo',
    alumnos_incluidos: 5,
    promedio,
    alumnos: [alumno],
  })
  const RESPUESTA = {
    contexto: CONTEXTO_ANUAL,
    colegio: RANRAHIRCA,
    resumen: { total: 10, estado: 'completo', provisional: false, alumnos_incluidos: 5, promedio: 2.0, etiqueta: null },
    meses: [MES(3, 'completo', 10)],
    grados: [grado(1, 2.0)],
    grados_sin_informacion: [grado(null, null)],
  }

  it('`total` de grados, alumnos y meses es lo que pinta la pantalla', () => {
    const r = adaptarLibrosDeColegio(RESPUESTA)
    expect(r.grados[0]).toMatchObject({ id_grado: 1, nombre: '1.°', total: 10, posicion: 1, alumnos_incluidos: 5 })
    expect(r.grados[0].alumnos[0]).toMatchObject({ id_alumno: 77, nombre: QUISPE.nombre, total: null })
    expect(r.grados[0].alumnos[0].meses[0]).toMatchObject({ nombre: 'Marzo 2026', cantidad: null })
    expect(r.meses[0].cantidad).toBe(10)
  })

  it('`grados_sin_informacion` va aparte, sin posición ni promedio', () => {
    const r = adaptarLibrosDeColegio(RESPUESTA)
    expect(r.sin_informacion[0]).toMatchObject({ id_grado: 1, posicion: null, promedio: null, total: null })
  })
})

describe('adaptarDesgloseDeLibros', () => {
  const registro = (id, extra) => ({
    id_lectura_semanal: id,
    clase_referencia: { id_clase: id * 10, fecha: '2026-09-10' },
    subprograma: ALFA,
    colegio: RANRAHIRCA,
    grado: PRIMERO,
    seccion: SECCION_A,
    ...extra,
  })
  const RESPUESTA = {
    contexto: CONTEXTO_ANUAL,
    alumno: QUISPE,
    anio: 2026,
    mes: 9,
    total: 3,
    registros: [
      registro(1, { estado_tabla: 'normal', lsn: 1, lsl: 2, total: 3 }),
      registro(2, { estado_tabla: 'no_realizada', lsn: 0, lsl: null, total: null }),
    ],
  }

  it('`registros` son los elementos, con su clase de referencia y cantidades', () => {
    const r = adaptarDesgloseDeLibros(RESPUESTA)
    expect(r.items[0]).toMatchObject({
      id_lectura_semanal: 1,
      clase: { id_clase: 10, fecha: '2026-09-10' },
      subprograma: ALFABETIZACION,
      libros_subir_nivel: 1,
      libros_seleccion_libre: 2,
      no_realizada: false,
    })
    expect(r.items[1].no_realizada).toBe(true)
    expect(r.alumno).toEqual({ id_alumno: 77, nombre: QUISPE.nombre })
  })

  it('`lsl` y `total` null siguen en null', () => {
    const r = adaptarDesgloseDeLibros(RESPUESTA)
    expect(r.items[1].libros_seleccion_libre).toBeNull()
    expect(r.items[1].total).toBeNull()
    expect(adaptarDesgloseDeLibros({ ...RESPUESTA, total: null, registros: [] }).total).toBeNull()
  })
})

describe('adaptarEvolucion', () => {
  const RESPUESTA = {
    contexto: CONTEXTO_ANUAL,
    anios: [
      {
        anio_escolar: { id: 2, nombre: '2026' },
        parcial: true,
        alumnos_atendidos: 120,
        colegios_atendidos: 3,
        libros: { total: null, estado: 'sin_informacion' },
        // Dos colegios en la lista y tres atendidos: si alguien leyera
        // `colegios` como número, aquí se notaría.
        colegios: [
          { colegio: RANRAHIRCA, alumnos_atendidos: 60 },
          { colegio: YANAMA, alumnos_atendidos: 60 },
        ],
      },
    ],
    mensaje: 'No hay información de otros años para mostrar la evolución.',
  }

  it('usa `colegios_atendidos`, no la lista `colegios`, como número de colegios', () => {
    const [anio] = adaptarEvolucion(RESPUESTA).anios
    expect(anio.colegios_atendidos).toBe(3)
    expect(anio).not.toHaveProperty('colegios')
    expect(anio.cobertura_por_colegio).toEqual([
      { id_colegio: 1, nombre: 'Ranrahirca', alumnos_atendidos: 60 },
      { id_colegio: 5, nombre: 'Yanama', alumnos_atendidos: 60 },
    ])
  })

  it('alumnos, año y libros quedan donde los lee la pantalla; libros null sigue en null', () => {
    const r = adaptarEvolucion(RESPUESTA)
    expect(r.anios[0]).toMatchObject({ id_anio_escolar: 2, nombre: '2026', parcial: true, alumnos_atendidos: 120 })
    expect(r.anios[0].libros).toBeNull()
    expect(r.anios[0].estado_libros).toBe('sin_informacion')
    expect(r.mensaje).toBe(RESPUESTA.mensaje)
  })
})

describe('adaptarComparacionColegios', () => {
  const RESPUESTA = {
    contexto: CONTEXTO,
    indicador: 'asistencia',
    intervalo: 'periodo',
    ranking: [
      {
        posicion: 1,
        provisional: true,
        colegio: RANRAHIRCA,
        valor: 93.5,
        poblacion: { descripcion: 'asistencias registradas', cantidad: 400 },
        advertencias: ['registro_incompleto'],
      },
    ],
    sin_informacion: [{ colegio: YANAMA, motivo: 'periodo_no_iniciado' }],
    mensaje: null,
  }

  it('`ranking` es la tabla, con población y advertencias', () => {
    const r = adaptarComparacionColegios(RESPUESTA)
    expect(r.colegios[0]).toEqual({
      posicion: 1,
      provisional: true,
      id_colegio: 1,
      nombre: 'Ranrahirca',
      valor: 93.5,
      poblacion: { descripcion: 'asistencias registradas', cantidad: 400 },
      advertencias: ['registro_incompleto'],
    })
    expect(r.sin_informacion).toEqual([{ id_colegio: 5, nombre: 'Yanama', motivo: 'periodo_no_iniciado' }])
    expect(r.intervalo).toBe('periodo')
  })
})

// ── El simulador tiene los campos de los modelos del backend ────────────────

/** Los campos de cada modelo de `app/schemas/dashboard.py`. */
const MODELOS = {
  FiltrosDisponibles: ['anios', 'colegios', 'seleccion_inicial'],
  DistribucionSubprograma: ['colegios_sin_informacion', 'contexto', 'fechas_corte', 'mensaje', 'sin_datos', 'subprogramas', 'total'],
  ResultadosAprendizaje: ['colegios_sin_informacion', 'contexto', 'fechas_corte', 'mensaje', 'sin_datos', 'subprogramas'],
  ComparacionResultados: [
    'colegios_sin_informacion', 'contexto', 'escala', 'fechas_corte', 'grados', 'no_aplica', 'ranking', 'resultado',
    'sin_evaluaciones', 'subprograma', 'vista',
  ],
  AsistenciaDelPeriodo: ['colegios_sin_informacion', 'contexto', 'mensual', 'por_colegio', 'resumen'],
  AsistenciaPorClase: ['contexto', 'grupos'],
  LibrosDelAnio: ['colegios', 'colegios_sin_informacion', 'contexto', 'meses', 'resumen'],
  LibrosDelColegio: ['colegio', 'contexto', 'grados', 'grados_sin_informacion', 'meses', 'resumen'],
  DesgloseLibros: ['alumno', 'anio', 'contexto', 'mes', 'registros', 'total'],
  EvolucionAnual: ['anios', 'contexto', 'mensaje'],
  ComparacionColegios: ['contexto', 'indicador', 'intervalo', 'mensaje', 'ranking', 'sin_informacion'],
  ContextoDashboard: ['alcance', 'anio_escolar', 'colegios', 'fecha_consulta', 'intervalo', 'parcial', 'periodo'],
  ResumenAsistencia: [
    'asistencias_completadas', 'asistencias_esperadas', 'ausentes', 'clases_dictadas', 'clases_incompletas',
    'clases_sin_registro', 'mensaje', 'porcentaje', 'presentes', 'provisional', 'sin_marcar', 'tardanzas',
  ],
  GrupoAsistencia: ['clases', 'clases_sin_registro', 'grado', 'resumen', 'seccion'],
  ClaseSinRegistro: ['fecha', 'fecha_original', 'id_clase', 'reprogramada', 'tipo'],
  AnioEvolucion: ['alumnos_atendidos', 'anio_escolar', 'colegios', 'colegios_atendidos', 'libros', 'parcial'],
  RegistroLibros: [
    'clase_referencia', 'colegio', 'estado_tabla', 'grado', 'id_lectura_semanal', 'lsl', 'lsn', 'seccion', 'subprograma',
    'total',
  ],
}

const campos = (objeto) => Object.keys(objeto).sort()

describe('el simulador devuelve la forma del backend', () => {
  const PERIODO = { id_anio_escolar: 2, todos_los_colegios: true, id_periodo_academico: 33 }
  const ANUAL = { id_anio_escolar: 2, todos_los_colegios: true }

  it('cada endpoint tiene exactamente los campos de su modelo', () => {
    expect(campos(panel.filtros())).toEqual(MODELOS.FiltrosDisponibles)
    expect(campos(panel.distribucionSubprograma(PERIODO))).toEqual(MODELOS.DistribucionSubprograma)
    expect(campos(panel.resultadosAprendizaje(PERIODO))).toEqual(MODELOS.ResultadosAprendizaje)
    expect(campos(panel.comparacionResultados({ ...PERIODO, id_programa: 1, todos_los_grados: true }))).toEqual(
      MODELOS.ComparacionResultados,
    )
    expect(campos(panel.asistencia(PERIODO))).toEqual(MODELOS.AsistenciaDelPeriodo)
    expect(campos(panel.asistenciaClases({ ...PERIODO, id_colegio: 1 }))).toEqual(MODELOS.AsistenciaPorClase)
    expect(campos(panel.libros(ANUAL))).toEqual(MODELOS.LibrosDelAnio)
    expect(campos(panel.librosDeColegio(1, ANUAL))).toEqual(MODELOS.LibrosDelColegio)
    expect(campos(panel.librosDesglose({ ...ANUAL, id_alumno: 1, anio: 2026, mes: 4 }))).toEqual(MODELOS.DesgloseLibros)
    expect(campos(panel.evolucionAnual(ANUAL))).toEqual(MODELOS.EvolucionAnual)
    expect(campos(panel.comparacionColegios({ ...PERIODO, indicador: 'asistencia' }))).toEqual(MODELOS.ComparacionColegios)
  })

  it('los anidados que más se confundían también tienen la forma del backend', () => {
    expect(campos(panel.asistencia(PERIODO).contexto)).toEqual(MODELOS.ContextoDashboard)
    expect(campos(panel.asistencia(PERIODO).resumen)).toEqual(MODELOS.ResumenAsistencia)
    const [grupo] = panel.asistenciaClases({ ...PERIODO, id_colegio: 1 }).grupos
    expect(campos(grupo)).toEqual(MODELOS.GrupoAsistencia)
    expect(campos(grupo.clases_sin_registro[0])).toEqual(MODELOS.ClaseSinRegistro)
    expect(campos(panel.evolucionAnual(ANUAL).anios[0])).toEqual(MODELOS.AnioEvolucion)
    expect(Array.isArray(panel.evolucionAnual(ANUAL).anios[0].colegios)).toBe(true)
    const desglose = panel.librosDesglose({ ...ANUAL, id_alumno: 1, anio: 2026, mes: 4 })
    desglose.registros.forEach((r) => expect(campos(r)).toEqual(MODELOS.RegistroLibros))
  })

  it('el detalle y el desglose de libros validan la selección de colegios, como el backend', () => {
    expect(() => panel.librosDeColegio(1, { id_anio_escolar: 2 })).toThrow()
    expect(() => panel.librosDesglose({ id_anio_escolar: 2, id_alumno: 1, anio: 2026, mes: 4 })).toThrow()
    expect(() => panel.librosDeColegio(1, { ...ANUAL, id_periodo_academico: 33 })).toThrow()
  })
})
