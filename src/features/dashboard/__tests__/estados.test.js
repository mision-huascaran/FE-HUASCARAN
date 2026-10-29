// La regla que atraviesa el dashboard: SIN INFORMACIÓN NO ES CERO.
//
// Es la prueba más barata y la que más sujeta: si alguien "simplifica"
// `estados.js` con un `?? 0`, aquí se ve antes de que el Supervisor lea un
// 0 % de asistencia de un colegio que todavía no empezó su periodo.
import { describe, expect, it } from 'vitest'
import {
  SIN_INFORMACION,
  celda,
  esFuturo,
  esProvisional,
  enCurso,
  etiquetaDeEstado,
  formatearIndice,
  formatearPorcentaje,
  alcanceEnTexto,
  asistenciasCompletadas,
  sinInformacion,
} from '../estados'
import { mesesDeGrado } from '../librosPorGrado'

describe('sinInformacion', () => {
  it('un null, un sin_datos y un estado vacío son ausencia de información', () => {
    expect(sinInformacion(null)).toBe(true)
    expect(sinInformacion({ sin_datos: true, valor: 5 })).toBe(true)
    expect(sinInformacion({ estado: 'sin_informacion' })).toBe(true)
    expect(sinInformacion({ estado: 'no_aplica' })).toBe(true)
    expect(sinInformacion({ valor: null })).toBe(true)
  })

  it('UN CERO CONFIRMADO NO ES AUSENCIA: se muestra como 0', () => {
    // El caso que da sentido a todo el módulo. Un 0 con información detrás
    // —ausentes, "No realizada", LSL 0— es un dato, y el CU exige poder
    // distinguirlo del hueco.
    expect(sinInformacion({ estado: 'completo', valor: 0 })).toBe(false)
    expect(celda({ estado: 'completo', cantidad: 0 }, 'cantidad')).toBe('0')
  })

  it('un mes futuro no tiene valor, pero tampoco es información faltante', () => {
    const futuro = { estado: 'futuro', cantidad: null }
    expect(sinInformacion(futuro, 'cantidad')).toBe(true)
    expect(esFuturo(futuro)).toBe(true)
    expect(esProvisional(futuro)).toBe(false)
  })
})

describe('celda', () => {
  it('escribe el literal cuando no hay nada confirmado', () => {
    expect(celda({ estado: 'sin_informacion' }, 'total')).toBe(SIN_INFORMACION)
    expect(celda(null, 'total')).toBe(SIN_INFORMACION)
  })
})

describe('etiquetaDeEstado', () => {
  it('rotula lo que hay que advertir y nada más', () => {
    expect(etiquetaDeEstado({ estado: 'completo' })).toBeNull()
    expect(etiquetaDeEstado({ estado: 'registro_incompleto' })).toBe('Registro incompleto')
    expect(etiquetaDeEstado({ estado: 'evaluacion_incompleta' })).toBe('Evaluación incompleta')
    expect(etiquetaDeEstado({ estado: 'no_aplica' })).toBe('No aplica')
    expect(etiquetaDeEstado({ en_curso: true })).toBe('En curso')
    expect(etiquetaDeEstado({ parcial: true })).toBe('Parcial')
    expect(etiquetaDeEstado({ provisional: true })).toBe('Información incompleta')
  })

  it('distingue "en curso" de "provisional": uno es tiempo, el otro datos', () => {
    expect(enCurso({ estado: 'en_curso' })).toBe(true)
    expect(esProvisional({ estado: 'en_curso' })).toBe(false)
  })
})

describe('formatos', () => {
  it('porcentaje con un decimal, índice y promedio con dos', () => {
    expect(formatearPorcentaje(91.25)).toBe('91.3 %')
    expect(formatearIndice(2.2549)).toBe('2.25')
  })

  it('un nulo se escribe, no se convierte en cero', () => {
    expect(formatearPorcentaje(null)).toBe(SIN_INFORMACION)
    expect(formatearIndice(null)).toBe(SIN_INFORMACION)
  })
})

describe('alcanceEnTexto', () => {
  const colegios = [
    { id_colegio: 1, nombre: 'AMASHCA' },
    { id_colegio: 4, nombre: 'SHILLA' },
  ]

  it('nombra el alcance como piden los CU', () => {
    expect(alcanceEnTexto({ todosLosColegios: true })).toBe('en todos los colegios')
    expect(alcanceEnTexto({ idColegios: ['1'], colegios })).toBe('en AMASHCA')
    expect(alcanceEnTexto({ idColegios: ['1', '4'], colegios })).toBe('en los 2 colegios seleccionados')
  })
})

describe('asistenciasCompletadas', () => {
  it('completadas de esperadas, y sin esperadas "Sin información", no "0 de 0"', () => {
    expect(asistenciasCompletadas({ asistencias_completadas: 455, asistencias_esperadas: 467 })).toBe('455 de 467')
    expect(asistenciasCompletadas({ asistencias_completadas: 0, asistencias_esperadas: 0 })).toBe(SIN_INFORMACION)
    expect(asistenciasCompletadas(undefined)).toBe(SIN_INFORMACION)
  })
})

describe('mesesDeGrado', () => {
  const MESES = [
    { anio: 2026, mes: 3, estado: 'completo', total: 9, cantidad: 9 },
    { anio: 2026, mes: 4, estado: 'completo', total: 9, cantidad: 9 },
    { anio: 2026, mes: 5, estado: 'completo', total: 9, cantidad: 9 },
    { anio: 2026, mes: 12, estado: 'futuro', total: null, cantidad: null },
  ]
  const alumno = (totales) => ({
    meses: totales.map((total, i) => ({
      anio: 2026,
      mes: MESES.at(i).mes,
      estado: total == null ? 'sin_informacion' : 'completo',
      total,
    })),
  })

  it('suma los alumnos del grado; si a alguno le falta el mes, es incompleto, no un total confirmado', () => {
    const [marzo, abril, mayo, diciembre] = mesesDeGrado({ alumnos: [alumno([1, 2, null, null]), alumno([0, null, null, null])] }, MESES)
    expect(marzo).toMatchObject({ estado: 'completo', cantidad: 1 })
    expect(abril).toMatchObject({ estado: 'incompleto', cantidad: 2 })
    // Nadie tiene dato: "Sin información", nunca 0.
    expect(mayo).toMatchObject({ estado: 'sin_informacion', cantidad: null })
    expect(diciembre).toMatchObject({ estado: 'futuro', cantidad: null })
  })

  it('un grado sin alumnos no tiene información en ningún mes pasado', () => {
    const meses = mesesDeGrado({ alumnos: [] }, MESES)
    expect(meses.slice(0, 3).every((m) => m.cantidad === null && m.estado === 'sin_informacion')).toBe(true)
  })
})
