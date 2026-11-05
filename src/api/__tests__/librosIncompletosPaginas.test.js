// CU034 (Tanda O, D97) — el detalle de "Información incompleta" trae TODAS las
// páginas: el servidor entrega de 40 en 40 y la tabla pagina en el cliente.
import { afterEach, describe, expect, it, vi } from 'vitest'
import handlers from '../mock/handlers'
import { obtenerLibrosIncompletos } from '../resources/dashboard'

const FILTROS = { idAnioEscolar: 2, todosLosColegios: true }

/** Respuesta paginada del backend con un ítem por página. */
const pagina = (page, totalPages) => ({ items: [{ id: `item-${page}` }], total: totalPages, page, page_size: 1, total_pages: totalPages })

afterEach(() => {
  vi.restoreAllMocks()
})

describe('obtenerLibrosIncompletos', () => {
  it('une todas las páginas en orden y pide cada una una sola vez', async () => {
    const pedir = vi.spyOn(handlers.dashboard, 'librosIncompletos').mockImplementation(async ({ page }) => pagina(page, 3))

    const items = await obtenerLibrosIncompletos(FILTROS)

    expect(items.map((i) => i.id)).toEqual(['item-1', 'item-2', 'item-3'])
    expect(pedir.mock.calls.map(([params]) => params.page).sort()).toEqual([1, 2, 3])
  })

  it('con una sola página no vuelve a pedir', async () => {
    const pedir = vi.spyOn(handlers.dashboard, 'librosIncompletos').mockImplementation(async ({ page }) => pagina(page, 1))

    expect(await obtenerLibrosIncompletos(FILTROS)).toEqual([{ id: 'item-1' }])
    expect(pedir).toHaveBeenCalledTimes(1)
  })

  it('lleva los filtros del detalle de una celda en cada página', async () => {
    const pedir = vi.spyOn(handlers.dashboard, 'librosIncompletos').mockImplementation(async ({ page }) => pagina(page, 2))

    await obtenerLibrosIncompletos(FILTROS, { idColegio: 7, idGrado: 3, anio: 2026, mes: 10 })

    for (const [params] of pedir.mock.calls) {
      expect(params).toMatchObject({ id_anio_escolar: 2, todos_los_colegios: true, id_colegio: 7, id_grado: 3, anio: 2026, mes: 10 })
    }
  })
})
