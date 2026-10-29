// Cómo viajan los filtros al servidor.
//
// Son las tres reglas que el backend castiga con un 422 y que no se ven mirando
// la pantalla: el periodo prohibido en los bloques anuales, "todos" frente a la
// lista de colegios, y el indicador de la comparación que decide si lleva
// periodo o no.
import { describe, expect, it } from 'vitest'
import {
  INDICADORES_COMPARACION,
  filtrosCompletos,
  colegiosSinCalendario,
  parametrosDe,
} from '../../../api/resources/dashboard'

const TODOS = { idAnioEscolar: '2', idPeriodoAcademico: '33', todosLosColegios: true, idColegios: [] }
const DOS = { idAnioEscolar: '2', idPeriodoAcademico: '33', todosLosColegios: false, idColegios: ['1', '4'] }

describe('parametrosDe', () => {
  it('manda `todos_los_colegios` O la lista, nunca las dos', () => {
    expect(parametrosDe(TODOS)).toEqual({ id_anio_escolar: '2', todos_los_colegios: true, id_periodo_academico: 33 })
    expect(parametrosDe(DOS)).toEqual({ id_anio_escolar: '2', id_colegios: [1, 4], id_periodo_academico: 33 })
  })

  it('una selección vacía no manda nada de colegios: no equivale a "todos"', () => {
    const params = parametrosDe({ ...DOS, idColegios: [] })
    expect(params.id_colegios).toBeUndefined()
    expect(params.todos_los_colegios).toBeUndefined()
  })

  it('QUITA el periodo en los bloques anuales, aunque la pantalla lo tenga elegido', () => {
    // Libros y evolución anual: mandarlo es 422 "Este indicador es anual".
    expect(parametrosDe(TODOS, 'prohibido').id_periodo_academico).toBeUndefined()
  })
})

describe('filtrosCompletos', () => {
  it('exige año y al menos un colegio siempre', () => {
    expect(filtrosCompletos({ ...TODOS, idAnioEscolar: '' })).toBe(false)
    expect(filtrosCompletos({ ...DOS, idColegios: [] })).toBe(false)
    expect(filtrosCompletos(TODOS)).toBe(true)
  })

  it('el periodo solo donde hace falta: CU034 no lo usa', () => {
    const sinPeriodo = { ...TODOS, idPeriodoAcademico: '' }
    expect(filtrosCompletos(sinPeriodo)).toBe(false)
    expect(filtrosCompletos(sinPeriodo, { exigePeriodo: false })).toBe(true)
  })
})

describe('INDICADORES_COMPARACION', () => {
  it('el promedio de libros es anual y los otros tres son del periodo', () => {
    const porClave = Object.fromEntries(INDICADORES_COMPARACION.map((i) => [i.clave, i.periodo]))
    expect(porClave.promedio_libros).toBe('prohibido')
    expect(porClave.asistencia).toBe('obligatorio')
    expect(porClave.nivel_global_alfabetizacion).toBe('obligatorio')
    expect(porClave.nivel_global_comprension).toBe('obligatorio')
  })
})

describe('colegiosSinCalendario', () => {
  it('saca los colegios afectados del 422, para poder nombrarlos', () => {
    const error = {
      response: {
        data: {
          motivo: 'calendario_no_configurado',
          colegios_sin_calendario: [{ id: 5, nombre: 'YANAMA' }],
        },
      },
    }
    expect(colegiosSinCalendario(error)).toEqual([{ id: 5, nombre: 'YANAMA' }])
    expect(colegiosSinCalendario({ response: { data: { motivo: 'validacion' } } })).toEqual([])
    expect(colegiosSinCalendario(undefined)).toEqual([])
  })
})
