// `GET /me/habilitaciones`: el respaldo para decidir SIN CONEXIÓN. Se guarda en
// IndexedDB al bajarlo, y si el servidor no contesta se usa lo guardado.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { get, set } from 'idb-keyval'
import handlers from '../../mock/handlers'
import { habilitacionesGuardadas, obtenerMisHabilitaciones, obtenerPeriodoDeFecha } from '../habilitaciones'

vi.mock('idb-keyval', () => ({
  get: vi.fn(async () => undefined),
  set: vi.fn(async () => {}),
}))

const CLAVE = 'sicedu.habilitaciones'
const SIN_RED = 'Network Error'
const GUARDADAS = { generado_en: '2026-10-20T08:00:00Z', asignaciones: [], permisos: [], calendarios: [] }

beforeEach(() => {
  vi.restoreAllMocks()
  get.mockReset().mockResolvedValue(undefined)
  set.mockReset().mockResolvedValue(undefined)
})

describe('habilitaciones', () => {
  it('descarga el paquete y lo guarda en IndexedDB', async () => {
    const datos = await obtenerMisHabilitaciones()

    expect(datos).toEqual(expect.objectContaining({ asignaciones: expect.any(Array) }))
    expect(set).toHaveBeenCalledWith(CLAVE, datos)
  })

  it('sin IndexedDB lo devuelve igual (queda en memoria)', async () => {
    set.mockRejectedValue(new Error('IndexedDB bloqueado'))
    await expect(obtenerMisHabilitaciones()).resolves.toEqual(expect.objectContaining({ asignaciones: expect.any(Array) }))
  })

  it('si el servidor no contesta usa lo guardado', async () => {
    vi.spyOn(handlers.habilitaciones, 'mias').mockRejectedValue(new Error(SIN_RED))
    get.mockResolvedValue(GUARDADAS)

    await expect(obtenerMisHabilitaciones()).resolves.toBe(GUARDADAS)
  })

  it('si no contesta y nunca se guardó nada, el error sigue', async () => {
    vi.spyOn(handlers.habilitaciones, 'mias').mockRejectedValue(new Error(SIN_RED))

    await expect(obtenerMisHabilitaciones()).rejects.toThrow(SIN_RED)
  })

  it('lo guardado es null si IndexedDB falla o está vacío', async () => {
    expect(await habilitacionesGuardadas()).toBeNull()
    get.mockRejectedValue(new Error('IndexedDB bloqueado'))
    expect(await habilitacionesGuardadas()).toBeNull()
  })

  it('pregunta qué periodo aplica a una fecha en un colegio', async () => {
    const periodo = vi.spyOn(handlers.habilitaciones, 'periodo').mockResolvedValue({ tipo: 'PA', numero: 4 })

    await expect(obtenerPeriodoDeFecha({ idColegio: '3', fecha: '2026-10-22' })).resolves.toEqual({ tipo: 'PA', numero: 4 })
    expect(periodo).toHaveBeenCalledWith({ idColegio: '3', fecha: '2026-10-22' })
  })
})
