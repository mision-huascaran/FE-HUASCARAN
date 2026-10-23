// El aviso de pendientes (CU017–CU021, T5).
//
// Lo que se comprueba es lo único que puede fallar SIN QUE NADIE SE ENTERE: el
// aviso no interrumpe el envío, así que si el servidor lo descarta por un campo
// mal puesto, el trabajo sube igual y el agujero que este endpoint vino a tapar
// —el docente que trabajó sin señal y es invisible para el Supervisor— sigue
// abierto, pero ya sin síntomas.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { _reiniciarCola, encolar, registrarEnviador } from '../colaOffline'
import { avisarPendientes } from '../../api/resources/sincronizacion'
import { idDeDispositivo } from '../dispositivo'
import useSessionStore from '../../store/sessionStore'

vi.mock('idb-keyval', () => {
  const almacen = new Map()
  return {
    get: vi.fn(async (k) => almacen.get(k)),
    set: vi.fn(async (k, v) => almacen.set(k, v)),
    del: vi.fn(async (k) => almacen.delete(k)),
  }
})

vi.mock('../../api/resources/sincronizacion', async (importOriginal) => ({
  ...(await importOriginal()),
  avisarPendientes: vi.fn(async () => ({ recibidos: 1, registrados: 1 })),
  consultarOperacion: vi.fn(async () => ({ estado: 'desconocida' })),
}))

const esperar = () => new Promise((r) => setTimeout(r, 40))

beforeEach(async () => {
  await _reiniciarCola()
  vi.mocked(avisarPendientes).mockClear()
  useSessionStore.setState({ token: 'mock.1.2026' })
})

describe('Aviso de pendientes', () => {
  it('manda el módulo DEL CONTRATO, no el nombre interno del envío', async () => {
    // Los tipos de la cola son los de la interfaz ("asistencia") y el contrato
    // tiene su propia lista cerrada ("asistencias"). Mandar el de casa haría
    // que el servidor descartara el lote por un valor inválido.
    registrarEnviador('marca-de-prueba', async () => ({ ok: true }), { modulo: 'asistencias' })

    encolar({ clave: 'k1', tipo: 'marca-de-prueba', payload: { a: 1 }, descripcion: 'x' })
    await esperar()

    expect(avisarPendientes).toHaveBeenCalled()
    const lote = vi.mocked(avisarPendientes).mock.calls[0][0]
    expect(lote[0].modulo).toBe('asistencias')
    expect(lote[0].id_dispositivo).toBe(idDeDispositivo())
    expect(lote[0].id_operacion).toEqual(expect.any(String))
  })

  it('un envío sin módulo declarado no arrastra al resto del lote', async () => {
    /**
     * El servidor valida `modulo` contra una lista cerrada: un valor que no
     * está en ella puede costar el lote ENTERO, y con él el aviso de todas las
     * demás operaciones. Así que la que no sabe a qué módulo pertenece se
     * queda fuera del aviso —se envía igual, eso no cambia— en vez de
     * arriesgar las que sí.
     */
    registrarEnviador('con-modulo', async () => ({ ok: true }), { modulo: 'lectura' })
    registrarEnviador('sin-modulo', async () => ({ ok: true }))

    encolar({ clave: 'k1', tipo: 'sin-modulo', payload: { a: 1 }, descripcion: 'x' })
    encolar({ clave: 'k2', tipo: 'con-modulo', payload: { b: 2 }, descripcion: 'y' })
    await esperar()

    const lote = vi.mocked(avisarPendientes).mock.calls[0][0]
    expect(lote).toHaveLength(1)
    expect(lote[0].modulo).toBe('lectura')
  })

  it('el id del dispositivo sobrevive al cierre de sesión', () => {
    // Vive en `localStorage` y no en IndexedDB justo por esto: al salir se
    // borran los datos de menores, pero si el id se fuera con ellos, el
    // siguiente aviso parecería venir de otro equipo.
    const antes = idDeDispositivo()
    localStorage.removeItem('sicedu.cola-envios')
    expect(idDeDispositivo()).toBe(antes)
  })
})
