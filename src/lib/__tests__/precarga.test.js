// Precarga para trabajar sin conexión (T19).
//
// Lo que se comprueba aquí es que un fallo de red no deje al docente con una
// pantalla vacía que parezca "no hay alumnos".
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { borrarPrecarga, leerPrecarga, precargarParaOffline } from '../precarga'

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

  it('D04: si falla una parte, conserva el bloque anterior y no se da por actualizada', async () => {
    // CP15: con el catálogo de colegios bloqueado, la precarga perdía ese
    // bloque y avanzaba la fecha como si la sincronización fuera completa.
    await precargarParaOffline(
      { alumnos: async () => [{ id_alumno: 1 }], colegios: async () => [{ id_colegio: 9 }] },
      { propietario: 4 },
    )
    const completa = await leerPrecarga(4)

    const resultado = await precargarParaOffline(
      {
        alumnos: async () => [{ id_alumno: 1 }, { id_alumno: 2 }],
        colegios: async () => {
          throw new Error('bloqueado')
        },
      },
      { propietario: 4 },
    )

    expect(resultado.ok).toBe(false)
    const guardada = await leerPrecarga(4)
    expect(guardada.datos.colegios).toEqual([{ id_colegio: 9 }])
    expect(guardada.datos.alumnos).toHaveLength(2)
    expect(guardada.guardadoEn).toBe(completa.guardadoEn)
  })

  it('D03: la precarga de otro usuario no se lee ni se mezcla', async () => {
    await precargarParaOffline({ alumnos: async () => [{ id_alumno: 1, nombre: 'Ana' }] }, { propietario: 1 })

    expect(await leerPrecarga(3)).toBeNull()
    expect((await leerPrecarga(1)).datos.alumnos).toHaveLength(1)

    // Una precarga parcial de otra persona no hereda los bloques de la anterior.
    await precargarParaOffline(
      {
        semanas: async () => [{ id_semana: 1 }],
        alumnos: async () => {
          throw new Error('403')
        },
      },
      { propietario: 3 },
    )
    expect((await leerPrecarga(3)).datos.alumnos).toBeUndefined()
  })

  it('se puede borrar (cierre de sesión)', async () => {
    await precargarParaOffline({ alumnos: async () => [{ id_alumno: 1 }] })
    await borrarPrecarga()
    expect(await leerPrecarga()).toBeNull()
  })
})
