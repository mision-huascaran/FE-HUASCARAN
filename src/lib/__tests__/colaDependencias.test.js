// La cola envía en ORDEN y por PARES cuando un envío depende de otro.
//
// El caso concreto: el cierre de una actividad no puede llegar sin su inicio.
// Si el inicio se descarta por un error definitivo, mandar el cierre daría un
// 404 por una actividad que nunca llegó a existir, y dejaría en la pantalla un
// segundo error que no aporta nada.
//
// Lo acordamos así con el backend: "envía los pendientes en orden, primero el
// inicio y después el finalizar de la misma actividad".
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { _reiniciarCola, encolar, registrarEnviador } from '../colaOffline'
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

/** Error definitivo: un 4xx no se arregla reintentando. */
const error4xx = (status, motivo) => {
  const e = new Error('rechazado')
  e.response = { status, data: { detail: 'rechazado', motivo } }
  return e
}

const esperar = () => new Promise((listo) => setTimeout(listo, 50))

beforeEach(async () => {
  await _reiniciarCola()
  // Precondición: hay una sesión iniciada. Sin ella la cola no envía (CP09).
  useSessionStore.setState({ token: 'mock.1.2026' })
})

describe('Envíos encadenados en la cola', () => {
  it('descarta el cierre si su inicio se rechaza definitivamente', async () => {
    const enviados = []
    registrarEnviador('inicio', async () => {
      enviados.push('inicio')
      throw error4xx(409, 'actividad_superpuesta')
    })
    registrarEnviador('cierre', async () => {
      enviados.push('cierre')
    })

    encolar({ clave: 'ini-1', tipo: 'inicio', payload: {}, descripcion: 'Inicio' }).catch(() => {})
    encolar({
      clave: 'fin-1',
      tipo: 'cierre',
      payload: {},
      descripcion: 'Cierre',
      dependeDe: 'ini-1',
    }).catch(() => {})

    await esperar()

    // El cierre NO debe haberse intentado: sin inicio no hay actividad.
    expect(enviados).toEqual(['inicio'])
  })

  it('si el inicio llega bien, el cierre se manda después y en ese orden', async () => {
    const enviados = []
    registrarEnviador('inicio', async () => {
      enviados.push('inicio')
    })
    registrarEnviador('cierre', async () => {
      enviados.push('cierre')
    })

    encolar({ clave: 'ini-2', tipo: 'inicio', payload: {}, descripcion: 'Inicio' })
    encolar({ clave: 'fin-2', tipo: 'cierre', payload: {}, descripcion: 'Cierre', dependeDe: 'ini-2' })

    await esperar()

    expect(enviados).toEqual(['inicio', 'cierre'])
  })

  it('un envío independiente no se ve arrastrado por el que falla', async () => {
    const enviados = []
    registrarEnviador('inicio', async () => {
      enviados.push('inicio')
      throw error4xx(422, 'inicio_invalido')
    })
    registrarEnviador('otro', async () => {
      enviados.push('otro')
    })

    encolar({ clave: 'ini-3', tipo: 'inicio', payload: {}, descripcion: 'Inicio' }).catch(() => {})
    // Sin `dependeDe`: no tiene nada que ver con la actividad.
    encolar({ clave: 'suelto', tipo: 'otro', payload: {}, descripcion: 'Otra fila' })

    await esperar()

    expect(enviados).toEqual(['inicio', 'otro'])
  })
})
