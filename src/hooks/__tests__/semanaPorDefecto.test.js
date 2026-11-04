// Auditoría de UX #737, U01 y U02: la semana que se propone en Seguimiento de
// Lectura es la de HOY, no la última del mes, y las que aún no empiezan se
// marcan como próximas.
import { describe, expect, it } from 'vitest'
import { esSemanaFutura, semanaPorDefecto } from '../useFiltrosDeGrupo'

const NOVIEMBRE = [
  { id_semana: 44, fecha_inicio: '2026-11-02', fecha_fin: '2026-11-06' },
  { id_semana: 45, fecha_inicio: '2026-11-09', fecha_fin: '2026-11-13' },
  { id_semana: 46, fecha_inicio: '2026-11-16', fecha_fin: '2026-11-20' },
  { id_semana: 47, fecha_inicio: '2026-11-23', fecha_fin: '2026-11-27' },
]

describe('semanaPorDefecto', () => {
  it('propone la semana que contiene hoy, no la última del mes', () => {
    expect(semanaPorDefecto(NOVIEMBRE, '2026-11-03').id_semana).toBe(44)
    expect(semanaPorDefecto(NOVIEMBRE, '2026-11-18').id_semana).toBe(46)
  })

  it('un fin de semana entre dos semanas propone la que ya pasó', () => {
    expect(semanaPorDefecto(NOVIEMBRE, '2026-11-07').id_semana).toBe(44)
  })

  it('en un mes ya cerrado propone su última semana', () => {
    expect(semanaPorDefecto(NOVIEMBRE, '2026-12-10').id_semana).toBe(47)
  })

  it('en un mes que todavía no llega propone su primera semana', () => {
    expect(semanaPorDefecto(NOVIEMBRE, '2026-10-20').id_semana).toBe(44)
  })

  it('acepta los nombres viejos de los campos', () => {
    const viejas = [
      { id_semana: 1, inicio: '2026-11-02', fin: '2026-11-06' },
      { id_semana: 2, inicio: '2026-11-09', fin: '2026-11-13' },
    ]
    expect(semanaPorDefecto(viejas, '2026-11-10').id_semana).toBe(2)
  })

  it('sin fechas conserva la regla de antes (la última); sin semanas, nada', () => {
    expect(semanaPorDefecto([{ id_semana: 1 }, { id_semana: 2 }], '2026-11-03').id_semana).toBe(2)
    expect(semanaPorDefecto([], '2026-11-03')).toBeNull()
    expect(semanaPorDefecto(undefined, '2026-11-03')).toBeNull()
  })
})

describe('esSemanaFutura', () => {
  it('solo es futura la semana que empieza después de hoy', () => {
    expect(esSemanaFutura(NOVIEMBRE[0], '2026-11-03')).toBe(false)
    expect(esSemanaFutura(NOVIEMBRE[1], '2026-11-03')).toBe(true)
    expect(esSemanaFutura({ id_semana: 9 }, '2026-11-03')).toBe(false)
  })

  it('sin día explícito usa el reloj del servidor', () => {
    expect(esSemanaFutura({ fecha_inicio: '2999-01-04' })).toBe(true)
    expect(esSemanaFutura({ fecha_inicio: '2000-01-03' })).toBe(false)
  })
})
