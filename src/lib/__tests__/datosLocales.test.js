// D03 / D02 — Qué queda en el navegador tras cerrar sesión (CP06, CP13).
//
// Se borran la precarga de IndexedDB y los filtros y resúmenes de
// localStorage; la cola de envíos pendientes NO se toca (CU007, CU008).
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

    await limpiarDatosLocalesDeSesion()

    expect(idb.__leer('sicedu.precarga')).toBeUndefined()
    expect(idb.__leer('sicedu.cola-envios')).toHaveLength(1)
    expect(localStorage.getItem('sicedu.filtros.alumnos')).toBeNull()
    expect(localStorage.getItem('sicedu.resumen.directivo')).toBeNull()
    // Lo que no es de SICEDU no se toca.
    expect(localStorage.getItem('otra.app')).toBe('x')
  })
})
