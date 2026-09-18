import { describe, expect, it } from 'vitest'
import {
  ACCIONES,
  calcularNivelFinal,
  calcularNivelGeneral,
  moverNivelRazkids,
} from '../nivelFinal'

/**
 * Catálogo reducido con la forma del backend. Lo importante es que "aa" tiene
 * orden 1 y va ANTES que "B", cosa que no ocurre si se comparan como texto.
 */
const CATALOGO = [
  { letra: 'aa', orden: 1 },
  { letra: 'A', orden: 2 },
  { letra: 'B', orden: 3 },
  { letra: 'C', orden: 4 },
  { letra: 'D', orden: 5 },
  { letra: 'E', orden: 6 },
  { letra: 'F', orden: 7 },
]

const base = {
  nivelEntrada: { letra: 'D', orden: 5 },
  fluidez: 'Proceso',
  comprension: 'Logrado',
  programa: 2,
  nivelEsperadoGrado: { letra: 'C', orden: 4 },
  catalogoRazkids: CATALOGO,
}

describe('moverNivelRazkids (RN-012)', () => {
  it('navega por `orden` y no por la letra como texto', () => {
    expect(moverNivelRazkids({ letra: 'aa', orden: 1 }, 1, CATALOGO)).toMatchObject({ letra: 'A' })
    expect(moverNivelRazkids({ letra: 'B', orden: 3 }, -1, CATALOGO)).toMatchObject({ letra: 'A' })
  })

  it('no se sale de los extremos del catálogo', () => {
    expect(moverNivelRazkids({ letra: 'aa', orden: 1 }, -1, CATALOGO)).toMatchObject({ letra: 'aa' })
    expect(moverNivelRazkids({ letra: 'F', orden: 7 }, 1, CATALOGO)).toMatchObject({ letra: 'F' })
  })
})

describe('calcularNivelFinal — regla provisional (RN-009, §P7)', () => {
  it('sube un nivel cuando la razón de aciertos llega al 80 %', () => {
    const r = calcularNivelFinal({ ...base, aciertos: 4, total: 5 })
    expect(r.delta).toBe(1)
    expect(r.accion).toBe(ACCIONES.SUBIR)
    expect(r.nivelSugerido.letra).toBe('E')
  })

  it('baja un nivel cuando la razón cae al 40 % o menos', () => {
    const r = calcularNivelFinal({ ...base, aciertos: 2, total: 5 })
    expect(r.delta).toBe(-1)
    expect(r.accion).toBe(ACCIONES.BAJAR)
    expect(r.nivelSugerido.letra).toBe('C')
  })

  it('mantiene el nivel entre ambos umbrales', () => {
    const r = calcularNivelFinal({ ...base, aciertos: 3, total: 5 })
    expect(r.delta).toBe(0)
    expect(r.accion).toBe(ACCIONES.MANTENER)
    expect(r.nivelSugerido.letra).toBe('D')
  })

  it('los umbrales son inclusivos en ambos extremos', () => {
    expect(calcularNivelFinal({ ...base, aciertos: 8, total: 10 }).delta).toBe(1)
    expect(calcularNivelFinal({ ...base, aciertos: 4, total: 10 }).delta).toBe(-1)
  })

  it('marca la evaluación incompleta si falta una dimensión de la rúbrica (RN-008)', () => {
    const r = calcularNivelFinal({ ...base, aciertos: 4, total: 5, comprension: '' })
    expect(r.completo).toBe(false)
    expect(r.accion).toBe(ACCIONES.REVISAR)
    expect(r.nivelGeneral).toBeNull()
  })

  it('no calcula nada con una prueba inválida', () => {
    expect(calcularNivelFinal({ ...base, aciertos: 3, total: 0 }).nivelSugerido).toBeNull()
    expect(calcularNivelFinal({ ...base, aciertos: 7, total: 5 }).nivelSugerido).toBeNull()
  })

  it('redacta el motivo que muestra la trazabilidad (P8)', () => {
    const r = calcularNivelFinal({ ...base, aciertos: 4, total: 5 })
    expect(r.motivo).toContain('E')
    expect(r.motivo).toContain('4/5')
    expect(r.motivo).toContain('Fluidez en proceso')
  })
})

describe('calcularNivelGeneral (RN-013)', () => {
  it('es Inicio si la Fluidez es Pre Inicio, sin importar el nivel alcanzado', () => {
    expect(
      calcularNivelGeneral({ fluidez: 'Pre Inicio', ordenAlcanzado: 20, ordenEsperado: 4 }),
    ).toBe('Inicio')
  })

  it('es Inicio si queda por debajo del nivel esperado para su grado', () => {
    expect(calcularNivelGeneral({ fluidez: 'Logrado', ordenAlcanzado: 3, ordenEsperado: 4 })).toBe('Inicio')
  })

  it('reparte Proceso, Logrado y Destacado según la brecha', () => {
    expect(calcularNivelGeneral({ fluidez: 'Proceso', ordenAlcanzado: 4, ordenEsperado: 4 })).toBe('Proceso')
    expect(calcularNivelGeneral({ fluidez: 'Proceso', ordenAlcanzado: 6, ordenEsperado: 4 })).toBe('Logrado')
    expect(calcularNivelGeneral({ fluidez: 'Proceso', ordenAlcanzado: 7, ordenEsperado: 4 })).toBe('Destacado')
  })

  it('el nivel general viaja dentro del cálculo completo', () => {
    // 4/5 sube de D(5) a E(6); el esperado del grado es C(4) → brecha 2 → Logrado.
    expect(calcularNivelFinal({ ...base, aciertos: 4, total: 5 }).nivelGeneral).toBe('Logrado')
  })
})
