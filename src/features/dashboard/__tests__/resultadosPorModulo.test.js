// El reparto de `resultados-aprendizaje` entre la tarjeta de Rúbrica y la de
// Registro de Vuelo, y los dos cálculos que hacen con él.
//
// Son funciones puras a propósito: es donde está la regla que los CU escriben
// en negrita —el porcentaje de un conjunto no es el promedio de los
// porcentajes de sus partes— y se prueba con números, no montando pantallas.
import { describe, expect, it } from 'vitest'
import {
  CLAVES_RUBRICA,
  CLAVE_VUELO,
  avancePorDimension,
  completitud,
  dimensionesDe,
  nivelesSumados,
} from '../resultadosPorModulo'

const dimension = (clave, extra = {}) => ({ clave, nombre: clave, evaluados: 0, pendientes: 0, niveles: [], ...extra })

const DATOS = {
  programas: [
    {
      id_programa: 1,
      nombre: 'Alfabetización',
      dimensiones: [
        dimension('global', { evaluados: 8, pendientes: 2, niveles: [{ nombre: 'A', cantidad: 5 }, { nombre: 'B', cantidad: 3 }] }),
        dimension('fluidez', { evaluados: 6, pendientes: 4 }),
        dimension('comprension', { evaluados: 10, pendientes: 0 }),
      ],
    },
    {
      id_programa: 2,
      nombre: 'Comprensión Lectora',
      dimensiones: [
        dimension('global', { evaluados: 20, pendientes: 0, niveles: [{ nombre: 'A', cantidad: 20 }] }),
        dimension('fluidez', { evaluados: 15, pendientes: 5 }),
        dimension('comprension', { evaluados: 20, pendientes: 0 }),
      ],
    },
  ],
}

describe('De qué módulo es cada resultado', () => {
  it('la Rúbrica se queda Fluidez y Comprensión; Registro de Vuelo, el nivel global', () => {
    expect(dimensionesDe(DATOS, CLAVES_RUBRICA).map((d) => d.clave)).toEqual([
      'fluidez',
      'comprension',
      'fluidez',
      'comprension',
    ])
    expect(dimensionesDe(DATOS, CLAVE_VUELO).map((d) => d.clave)).toEqual(['global', 'global'])
  })

  it('un resultado que no es de ninguno de los dos no se reparte solo', () => {
    const conNuevo = { programas: [{ id_programa: 1, nombre: 'X', dimensiones: [dimension('inventado')] }] }
    expect(dimensionesDe(conNuevo, CLAVES_RUBRICA)).toHaveLength(0)
    expect(dimensionesDe(conNuevo, CLAVE_VUELO)).toHaveLength(0)
  })

  it('sin datos devuelve una lista vacía, no revienta', () => {
    expect(dimensionesDe(undefined, CLAVE_VUELO)).toEqual([])
    expect(dimensionesDe({}, CLAVES_RUBRICA)).toEqual([])
  })
})

describe('Completitud', () => {
  it('suma recuentos y divide UNA vez: no promedia porcentajes', () => {
    // Rúbrica: evaluados 6+10+15+20 = 51 sobre esperadas 10+10+20+20 = 60.
    expect(completitud(dimensionesDe(DATOS, CLAVES_RUBRICA))).toEqual({
      evaluados: 51,
      pendientes: 9,
      esperadas: 60,
      porcentaje: 85,
    })
  })

  it('sin esperadas el porcentaje es null, no 0: "0 de 0" no es un dato', () => {
    expect(completitud([]).porcentaje).toBeNull()
    expect(completitud([dimension('global')]).porcentaje).toBeNull()
  })
})

describe('Gráficas', () => {
  it('los niveles se suman por NOMBRE entre subprogramas', () => {
    expect(nivelesSumados(dimensionesDe(DATOS, CLAVE_VUELO))).toEqual([
      { nombre: 'A', cantidad: 25 },
      { nombre: 'B', cantidad: 3 },
    ])
  })

  it('un nivel sin cantidad confirmada no inventa un cero', () => {
    const dims = [dimension('global', { niveles: [{ nombre: 'A', cantidad: null }, { nombre: 'B', cantidad: 2 }] })]
    expect(nivelesSumados(dims)).toEqual([{ nombre: 'B', cantidad: 2 }])
  })

  it('el avance va POR DIMENSIÓN, que es lo que dice cuál falta', () => {
    expect(avancePorDimension(dimensionesDe(DATOS, CLAVES_RUBRICA))).toEqual([
      // Fluidez: 6+15 = 21 de 30.
      { nombre: 'fluidez', porcentaje: 70 },
      // Comprensión: 10+20 = 30 de 30.
      { nombre: 'comprension', porcentaje: 100 },
    ])
  })
})
