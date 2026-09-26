// Cola de envíos pendientes (RNF-001): el guardado no bloquea la interfaz y no
// se duplica. Aquí se comprueba lo que decide si el trabajo del docente se
// pierde o no: qué se reintenta, qué se descarta y qué se le devuelve a la fila.
import { beforeEach, describe, expect, it } from 'vitest'
import { _reiniciarCola, encolar, registrarEnviador } from '../colaOffline'
import useSyncStore from '../../store/syncStore'

const fila = (clave, extra = {}) => ({
  clave,
  tipo: 'fila-semanal',
  payload: { id_alumno: 1, ...extra },
  descripcion: 'Semana 12 · Luis Pérez',
})

beforeEach(() => {
  _reiniciarCola()
})

describe('cola de envíos', () => {
  it('envía la fila con su idempotency_key y resuelve con la respuesta', async () => {
    const enviados = []
    registrarEnviador('fila-semanal', async (payload) => {
      enviados.push(payload)
      return { id_registro: 7 }
    })

    const resultado = await encolar(fila('alumno-1-semana-12'))

    expect(resultado).toEqual({ id_registro: 7 })
    // La clave viaja al servidor: un reintento del mismo envío no duplica el registro.
    expect(enviados[0]).toMatchObject({ id_alumno: 1, idempotency_key: 'alumno-1-semana-12' })
    expect(useSyncStore.getState().pendientes).toBe(0)
  })

  it('un 4xx no se reintenta: sale de la cola y la fila se entera', async () => {
    const error = { response: { status: 422, data: { detail: 'Los aciertos superan el total' } } }
    registrarEnviador('fila-semanal', async () => {
      throw error
    })

    await expect(encolar(fila('alumno-2-semana-12'))).rejects.toBe(error)
    // Reintentar no lo va a arreglar, así que no se queda trabando la cola.
    expect(useSyncStore.getState().pendientes).toBe(0)
  })

  it('descarta un tipo sin enviador en vez de dejar la cola trabada', async () => {
    await expect(
      encolar({ ...fila('alumno-3-semana-12'), tipo: 'tipo-que-no-existe' }),
    ).rejects.toThrow(/Sin enviador/)
    expect(useSyncStore.getState().pendientes).toBe(0)
  })

  it('la edición más reciente reemplaza a la pendiente de la misma fila', async () => {
    let liberar
    registrarEnviador('fila-semanal', () => new Promise((resolver) => { liberar = resolver }))

    const primera = encolar(fila('alumno-4-semana-12', { lsl: 1 }))
    await Promise.resolve()
    const segunda = encolar(fila('alumno-4-semana-12', { lsl: 5 }))

    // La primera no se pierde ni se duplica: se da por reemplazada.
    await expect(primera).resolves.toEqual({ reemplazado: true })

    liberar({ id_registro: 9 })
    await expect(segunda).resolves.toEqual({ id_registro: 9 })
  })
})
