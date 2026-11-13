// Lectura, Rúbrica y Vuelo: lo que espera en la cola gana sobre la respuesta
// del servidor hasta que se confirma (D123 en estos tres módulos). Datos inventados.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SINCRONIZACION, conPendientes } from '../registrosOffline'

let cola = []
vi.mock('../colaOffline', () => ({
  pendientesDeTipo: (tipo) => cola.filter((item) => item.tipo === tipo),
  encolar: vi.fn(),
  registrarEnviador: vi.fn(),
  ajustarPendientes: vi.fn(async () => {}),
}))

beforeEach(() => {
  cola = []
})

const todas = () => true

describe('conPendientes · Rúbrica', () => {
  const respuesta = () => ({
    items: [
      { id_alumno: 1, fluidez: null, comprension: 2, version: 3 },
      { id_alumno: 2, fluidez: 1, comprension: 1, version: 1 },
    ],
  })
  const envio = (idAlumno, local, extra = {}) => ({
    tipo: 'rubrica-mensual',
    ...extra,
    payload: { nombre: 'X', item: { id_alumno: idAlumno, version: 3, id_colegio: 1, mes: 11, ...local }, local },
  })

  it('el valor pendiente pisa al del servidor, con su indicador', () => {
    cola = [envio(1, { fluidez: 0 })]
    const datos = conPendientes('rubrica', respuesta(), todas)
    expect(datos.items[0]).toEqual(expect.objectContaining({ fluidez: 0, comprension: 2, sincronizacion: SINCRONIZACION.PENDIENTE }))
    expect(datos.items[1].sincronizacion).toBeUndefined()
  })

  it('si el último intento falló, la fila sigue con el valor nuevo y marca el error', () => {
    cola = [envio(1, { fluidez: 0 }, { error: 'Error simulado', intentos: 1 })]
    expect(conPendientes('rubrica', respuesta(), todas).items[0]).toEqual(
      expect.objectContaining({ fluidez: 0, sincronizacion: SINCRONIZACION.ERROR }),
    )
  })

  it('no aplica lo pendiente de otro grupo o mes', () => {
    cola = [envio(1, { fluidez: 0 })]
    const datos = conPendientes('rubrica', respuesta(), ({ item }) => item.mes === 10)
    expect(datos.items[0].fluidez).toBeNull()
  })

  it('un envío de antes (sin `local`) aplica los campos que cambió, no los de la operación', () => {
    cola = [{ tipo: 'rubrica-mensual', payload: { item: { id_alumno: 2, version: 1, realizado_en: 'x', id_actividad: 9, comprension: 3 } } }]
    expect(conPendientes('rubrica', respuesta(), todas).items[1]).toEqual(
      expect.objectContaining({ comprension: 3, version: 1, sincronizacion: SINCRONIZACION.PENDIENTE }),
    )
  })

  it('sin datos no inventa nada', () => {
    cola = [envio(1, { fluidez: 0 })]
    expect(conPendientes('rubrica', undefined, todas)).toBeUndefined()
  })
})

describe('conPendientes · Lectura', () => {
  it('aplica las filas pendientes de la tabla', () => {
    cola = [{ tipo: 'lectura-fila', payload: { idTabla: 7, item: { id_alumno: 5, cantidad_lsl: 4 }, local: { cantidad_lsl: 4 } } }]
    const tabla = { id: 7, filas: [{ id_alumno: 5, cantidad_lsl: 1 }] }
    expect(conPendientes('lectura', tabla, ({ idTabla }, datos) => idTabla === datos.id).filas[0]).toEqual(
      expect.objectContaining({ cantidad_lsl: 4, sincronizacion: SINCRONIZACION.PENDIENTE }),
    )
    // La misma persona en otra semana (otra tabla) no se toca.
    const otra = { id: 8, filas: [{ id_alumno: 5, cantidad_lsl: 1 }] }
    expect(conPendientes('lectura', otra, ({ idTabla }, datos) => idTabla === datos.id).filas[0].cantidad_lsl).toBe(1)
  })
})

describe('conPendientes · Registro de Vuelo', () => {
  it('pone el nivel pendiente en SU periodo y recalcula el avance', () => {
    cola = [
      {
        tipo: 'registro-vuelo',
        payload: { numero: 2, item: { id_alumno: 3, id_periodo_academico: 22, id_nivel_colocado: 9 }, local: { nivel_colocado: { id: 9, letra: 'J' } } },
      },
    ]
    const datos = {
      items: [
        {
          id_alumno: 3,
          avance_anual: 0,
          periodos: [
            { numero: 1, id_periodo_academico: 21, nivel_colocado: null },
            { numero: 2, id_periodo_academico: 22, nivel_colocado: null },
          ],
        },
      ],
    }
    const alumno = conPendientes('vuelo', datos, todas).items[0]
    expect(alumno.periodos[1]).toEqual(expect.objectContaining({ nivel_colocado: { id: 9, letra: 'J' }, sincronizacion: SINCRONIZACION.PENDIENTE }))
    expect(alumno.periodos[0].sincronizacion).toBeUndefined()
    expect(alumno.avance_anual).toBeGreaterThan(0)
  })
})
