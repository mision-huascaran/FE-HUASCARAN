// Cola de envíos pendientes (RNF-001): el guardado no bloquea la interfaz y no
// se duplica. Aquí se comprueba lo que decide si el trabajo del docente se
// pierde o no: qué se reintenta, qué se descarta y qué se le devuelve a la fila.
import { beforeEach, describe, expect, it } from 'vitest'
import { _reiniciarCola, encolar, iniciarCola, registrarEnviador, reintentarAhora } from '../colaOffline'
import useSessionStore from '../../store/sessionStore'
import useSyncStore from '../../store/syncStore'

const fila = (clave, extra = {}) => ({
  clave,
  tipo: 'fila-semanal',
  payload: { id_alumno: 1, ...extra },
  descripcion: 'Semana 12 · Luis Pérez',
})

beforeEach(() => {
  _reiniciarCola()
  Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true })
  // Precondición: hay una sesión iniciada. Sin ella la cola no envía (CP09).
  useSessionStore.setState({ token: 'mock.1.2026' })
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
    // Sin conexión nada sale: las dos ediciones esperan y la segunda sustituye
    // a la primera, que se da por reemplazada.
    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true })
    const enviados = []
    registrarEnviador('fila-semanal', async (payload) => {
      enviados.push(payload)
      return { id_registro: 9 }
    })

    const primera = encolar(fila('alumno-4-semana-12', { lsl: 1 }))
    const segunda = encolar(fila('alumno-4-semana-12', { lsl: 5 }))
    await expect(primera).resolves.toEqual({ reemplazado: true })
    expect(useSyncStore.getState().pendientes).toBe(1)

    Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true })
    await reintentarAhora()
    await expect(segunda).resolves.toEqual({ id_registro: 9 })
    expect(enviados.map((e) => e.lsl)).toEqual([5])
  })

  it('una edición de la fila que YA SE ESTÁ ENVIANDO no la reemplaza: sale después', async () => {
    // Antes la sustituía en la cola y, al llegar la respuesta del envío en
    // vuelo, se borraba la nueva: el segundo cambio se daba por guardado sin
    // haber salido nunca.
    const liberar = []
    const enviados = []
    registrarEnviador('fila-semanal', (payload) => {
      enviados.push(payload)
      return new Promise((resolver) => liberar.push(resolver))
    })

    const primera = encolar(fila('alumno-4-semana-12', { lsl: 1 }))
    await new Promise((listo) => setTimeout(listo, 0))
    const segunda = encolar(fila('alumno-4-semana-12', { lsl: 5 }))

    liberar[0]({ id_registro: 9 })
    await expect(primera).resolves.toEqual({ id_registro: 9 })
    await new Promise((listo) => setTimeout(listo, 0))
    liberar[1]({ id_registro: 10 })
    await expect(segunda).resolves.toEqual({ id_registro: 10 })
    expect(enviados.map((e) => e.lsl)).toEqual([1, 5])
  })

  it('fusionar suma los campos de la edición pendiente a la nueva', async () => {
    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true })
    const enviados = []
    registrarEnviador('fila-semanal', async (payload) => {
      enviados.push(payload)
      return {}
    })
    const fusionar = (anterior, nuevo) => ({ ...anterior, ...nuevo })
    encolar({ ...fila('alumno-4-semana-12', { lsl: 1 }), fusionar })
    encolar({ ...fila('alumno-4-semana-12', { observacion: 'Bien' }), fusionar })

    Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true })
    await reintentarAhora()
    await new Promise((listo) => setTimeout(listo, 0))
    expect(enviados).toHaveLength(1)
    expect(enviados[0]).toEqual(expect.objectContaining({ lsl: 1, observacion: 'Bien' }))
  })

  it('sin sesión no envía nada; lo manda al iniciar sesión (CP09, D05)', async () => {
    // Recuperar la conexión en la pantalla de login no debe sincronizar: el
    // envío espera al siguiente inicio de sesión, y tampoco se pierde por un
    // 401 de una petición sin token.
    await iniciarCola()
    useSessionStore.setState({ token: null })
    const enviados = []
    registrarEnviador('fila-semanal', async (payload) => {
      enviados.push(payload)
      return { ok: true }
    })

    const resultado = encolar(fila('alumno-9-semana-12'))
    await new Promise((listo) => setTimeout(listo, 20))
    expect(enviados).toHaveLength(0)
    expect(useSyncStore.getState().pendientes).toBe(1)

    useSessionStore.setState({ token: 'mock.1.2026' })
    await expect(resultado).resolves.toEqual({ ok: true })
    expect(enviados).toHaveLength(1)
  })
})
