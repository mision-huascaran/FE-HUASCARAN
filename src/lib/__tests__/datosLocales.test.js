// D03 / D02 — Qué queda en el navegador tras cerrar sesión (CP06, CP13).
//
// Se borra la precarga de IndexedDB y se VACÍA localStorage entero; la cola de
// envíos pendientes NO se toca (CU007, CU008).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { limpiarDatosLocalesDeSesion } from '../datosLocales'

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
    __leer: (k) => almacen[k],
    __sembrar: (k, v) => {
      almacen[k] = v
    },
  }
})

beforeEach(() => localStorage.clear())

describe('limpieza local al cerrar sesión', () => {
  it('borra precarga, filtros y resúmenes, y conserva los pendientes', async () => {
    const idb = await import('idb-keyval')
    idb.__sembrar('sicedu.precarga', { datos: { alumnos: [{ nombre: 'Ana' }] }, propietario: 1 })
    idb.__sembrar('sicedu.cola-envios', [{ clave: 'actividad-cierre-1' }])
    localStorage.setItem('sicedu.filtros.alumnos', '{"id_ciclo":"1"}')
    localStorage.setItem('sicedu.resumen.directivo', '{}')
    localStorage.setItem('otra.app', 'x')
    localStorage.setItem('sicedu.reloj.desfase', '-3600000')

    await limpiarDatosLocalesDeSesion()

    expect(idb.__leer('sicedu.precarga')).toBeUndefined()
    expect(idb.__leer('sicedu.cola-envios')).toHaveLength(1)
    expect(localStorage.getItem('sicedu.filtros.alumnos')).toBeNull()
    expect(localStorage.getItem('sicedu.resumen.directivo')).toBeNull()
    /**
     * CU007 pide limpiar localStorage ÍNTEGRAMENTE, no solo las claves
     * `sicedu.*`: en un equipo compartido no debe quedar nada del usuario que
     * sale, se llame como se llame la clave.
     */
    expect(localStorage.getItem('otra.app')).toBeNull()
    /**
     * Con UNA excepción: el desfase del reloj no es estado del usuario, es la
     * defensa de CU022 contra un reloj manipulado. Borrarlo dejaría a la
     * siguiente sesión fiándose de la hora del dispositivo hasta la primera
     * respuesta del servidor, que es justo lo que el caso de uso prohíbe.
     */
    expect(localStorage.getItem('sicedu.reloj.desfase')).toBe('-3600000')
  })
})
