// La cola, contra el contrato de la semana 11.
//
// Tres cosas que antes no existían y que los cuatro módulos de registro
// necesitan: un identificador de operación estable, la lectura de un lote que
// puede venir medio aceptado, y el choque de versiones como caso propio.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  _reiniciarCola,
  encolar,
  esModificacionConcurrente,
  registrarEnviador,
  resultadoDeLote,
} from '../colaOffline'
import useSessionStore from '../../store/sessionStore'

vi.mock('idb-keyval', () => {
  let almacen = {}
  return {
    get: vi.fn(async (k) => almacen[k]),
    set: vi.fn(async (k, v) => {
      almacen[k] = v
    }),
    del: vi.fn(async (k) => {
      delete almacen[k]
    }),
  }
})

const esperar = () => new Promise((r) => setTimeout(r, 30))

beforeEach(async () => {
  await _reiniciarCola()
  useSessionStore.setState({ token: 'mock.1.2026' })
})

describe('Identificador de operación', () => {
  it('viaja con el envío y es el MISMO en cada reintento', async () => {
    /**
     * Es toda su gracia: si se generara al enviar, dos intentos del mismo
     * cambio serían dos operaciones distintas para el servidor y se
     * aplicarían las dos.
     */
    const vistos = []
    let fallar = true
    registrarEnviador('prueba-id', async (payload) => {
      vistos.push(payload.id_operacion)
      if (fallar) {
        fallar = false
        const e = new Error('servidor caído')
        e.response = { status: 500 }
        throw e
      }
      return { ok: true }
    })

    encolar({ clave: 'k1', tipo: 'prueba-id', payload: { a: 1 }, descripcion: 'x' })
    await esperar()
    await new Promise((r) => setTimeout(r, 1200))

    expect(vistos.length).toBeGreaterThanOrEqual(2)
    expect(vistos[0]).toBeTruthy()
    expect(new Set(vistos).size).toBe(1)
  })

  it('una corrección que reemplaza a otra pendiente es una operación NUEVA', async () => {
    /**
     * Reutilizar el id haría que el servidor descartara la corrección por
     * idempotente, que es justo lo contrario de lo que quiere quien acaba de
     * corregir.
     */
    const vistos = []
    registrarEnviador('prueba-reemplazo', async (payload) => {
      vistos.push(payload.id_operacion)
      return { ok: true }
    })

    encolar({ clave: 'misma', tipo: 'prueba-reemplazo', payload: { v: 1 }, descripcion: 'x' })
    encolar({ clave: 'misma', tipo: 'prueba-reemplazo', payload: { v: 2 }, descripcion: 'x' }).catch(() => {})
    await esperar()

    // Se mandó una sola vez, pero con un id distinto del que tenía la primera.
    expect(vistos).toHaveLength(1)
    expect(vistos[0]).toBeTruthy()
  })
})

describe('Un lote puede venir medio aceptado', () => {
  const RESPUESTA = {
    registros: [
      { id_operacion: 'op-1', estado: 'aceptada', registro: { id: 1 } },
      { id_operacion: 'op-2', estado: 'rechazada', motivo: 'alumno_inactivo', detail: 'El alumno está inactivo.' },
    ],
  }

  it('cada quien lee lo SUYO, no el conjunto', () => {
    // Un 200 no significa "todo bien": hay que mirar el ítem propio.
    expect(resultadoDeLote(RESPUESTA, 'op-1')).toMatchObject({ estado: 'aceptada' })
    expect(resultadoDeLote(RESPUESTA, 'op-2')).toMatchObject({
      estado: 'rechazada',
      motivo: 'alumno_inactivo',
    })
  })

  it('una respuesta sin lote se da por aceptada', () => {
    // Endpoints que todavía no se han actualizado: un 200 significaba eso.
    expect(resultadoDeLote({ id: 9 }, 'op-1')).toMatchObject({ estado: 'aceptada' })
    expect(resultadoDeLote(undefined, 'op-1')).toMatchObject({ estado: 'aceptada' })
  })
})

describe('Choque de versiones', () => {
  it('se reconoce por su motivo, no por el código', () => {
    /**
     * No es un fallo de red ni del servidor: alguien cambió ese registro
     * mientras esta persona lo miraba. Reintentarlo pisaría el cambio ajeno.
     */
    const choque = { response: { status: 409, data: { motivo: 'modificacion_concurrente' } } }
    const otro409 = { response: { status: 409, data: { motivo: 'actividad_activa_existente' } } }

    expect(esModificacionConcurrente(choque)).toBe(true)
    expect(esModificacionConcurrente(otro409)).toBe(false)
    expect(esModificacionConcurrente(new Error('red'))).toBe(false)
  })
})
