// Precarga para trabajar sin conexión (T19).
//
// Lo que se comprueba aquí es que un fallo de red no deje al docente con una
// pantalla vacía que parezca "no hay alumnos".
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { leerPrecarga, precargarParaOffline } from '../precarga'

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
    __limpiar: () => {
      almacen = {}
    },
  }
})

beforeEach(async () => {
  const idb = await import('idb-keyval')
  idb.__limpiar()
})

describe('precarga', () => {
  it('guarda lo descargado para poder trabajar sin red', async () => {
    const resultado = await precargarParaOffline({
      alumnos: async () => [{ id_alumno: 1 }],
      grados: async () => [{ id_grado: 1 }],
    })

    expect(resultado.ok).toBe(true)
    const guardado = await leerPrecarga()
    expect(guardado.datos.alumnos).toHaveLength(1)
    expect(guardado.guardadoEn).toBeTruthy()
  })

  it('un bloque que falla no tumba la precarga entera', async () => {
    const resultado = await precargarParaOffline({
      alumnos: async () => [{ id_alumno: 1 }],
      niveles: async () => {
        throw new Error('sin red')
      },
    })

    // Se avisa de que está incompleta, pero lo que sí llegó queda guardado.
    expect(resultado.ok).toBe(false)
    const guardado = await leerPrecarga()
    expect(guardado.datos.alumnos).toHaveLength(1)
    expect(guardado.datos.niveles).toBeUndefined()
  })

  it('si no se pudo traer nada no guarda una precarga vacía', async () => {
    // Guardar {} haría que la grilla dijera "no hay alumnos" en vez de
    // "no se pudo descargar", que es muy distinto para quien está en el aula.
    const resultado = await precargarParaOffline({
      alumnos: async () => {
        throw new Error('sin red')
      },
    })

    expect(resultado.ok).toBe(false)
    expect(await leerPrecarga()).toBeNull()
  })
})
