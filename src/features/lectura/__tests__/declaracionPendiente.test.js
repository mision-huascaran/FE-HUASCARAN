// CU026 sin conexión: la declaración (o su reversión) que espera en la cola
// manda sobre la tabla. Datos inventados.
import { describe, expect, it } from 'vitest'
import { conDeclaracionPendiente, declaracionesPendientes } from '../declaracionPendiente'

const tabla = (extra = {}) => ({ id: 7, estado: 'normal', motivo_no_realizada: null, filas: [], ...extra })
const DECLARADA = '2026-06-15T10:00:00Z'
const REVERTIDA = '2026-06-15T10:05:00Z'
const op = (idTabla, realizadoEn, motivo) => ({ payload: { idTabla, realizadoEn, motivo } })

describe('conDeclaracionPendiente', () => {
  it('sin nada pendiente devuelve la tabla tal cual', () => {
    const t = tabla()
    expect(conDeclaracionPendiente(t, [], [])).toBe(t)
  })

  it('una declaración pendiente bloquea la tabla con su motivo', () => {
    expect(conDeclaracionPendiente(tabla(), [op(7, DECLARADA, 'Paro')], [])).toEqual(
      expect.objectContaining({ estado: 'no_realizada', motivo_no_realizada: 'Paro', declaracion_pendiente: true }),
    )
  })

  it('declarar y revertir sin conexión: gana la última, la reversión', () => {
    const datos = conDeclaracionPendiente(tabla(), [op(7, DECLARADA, 'Paro')], [op(7, REVERTIDA, 'Se dio')])
    expect(datos).toEqual(expect.objectContaining({ estado: 'normal', motivo_no_realizada: null, declaracion_pendiente: true }))
  })

  it('revertir una que el servidor ya tenía la desbloquea', () => {
    const datos = conDeclaracionPendiente(tabla({ estado: 'no_realizada', motivo_no_realizada: 'Paro' }), [], [op(7, REVERTIDA, 'Se dio')])
    expect(datos.estado).toBe('normal')
  })

  it('lo de otra tabla no se aplica', () => {
    expect(conDeclaracionPendiente(tabla(), [op(8, DECLARADA, 'Paro')], []).estado).toBe('normal')
    expect(declaracionesPendientes(7, [op(8, 'x')], [op(7, 'y')])).toBe(1)
    expect(declaracionesPendientes(undefined, [op(7, 'x')])).toBe(0)
  })
})
