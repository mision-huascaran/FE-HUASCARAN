// CU028 — Revocar un permiso de corrección: el literal del caso de uso al
// terminar, y los dos casos que no son errores sino cambios de estado (otro
// Supervisor lo revocó antes, o el permiso venció mientras tanto).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import handlers from '../../../api/mock/handlers'
import PermisosDeCorreccion from '../PermisosDeCorreccion'
import { ROLES } from '../../../auth/roles'
import { errorHttp } from '../../../test/fabricas'
import { renderConProveedores } from '../../../test/renderConProveedores'

const DOCENTE = { id_usuario: 9, nombre: 'Rosa Quispe', activo: true }
const ESPERA = { timeout: 8000 }

const VIGENTE = {
  id: 71,
  id_usuario: 9,
  estado: 'vigente',
  modulo: 'lectura',
  anio_escolar: { id: 1, nombre: '2026' },
  colegio: { id: 1, nombre: 'I.E. de prueba' },
  grado: { id: 3, nombre: '3.° grado' },
  periodo_academico: { id: 2, nombre: 'PA2' },
  inicio: '2026-10-01T13:00:00Z',
  fin: '2026-12-01T13:00:00Z',
  otorgado_en: '2026-10-01T13:00:00Z',
}

async function revocarConMotivo() {
  renderConProveedores(<PermisosDeCorreccion docente={DOCENTE} />, { rol: ROLES.SUPERVISOR })
  // Al recibir el catálogo, la pantalla elige sola el año vigente y vuelve a
  // pedir la lista. Si se pulsa «Revocar» antes, el clic puede caer en la fila
  // de la primera lista, que ya no está en el DOM, y el diálogo no se abre.
  await waitFor(() => expect(screen.getByLabelText('Año escolar')).not.toHaveValue(''), ESPERA)
  fireEvent.click(await screen.findByRole('button', { name: 'Revocar' }, ESPERA))
  const modal = await screen.findByRole('dialog', { name: 'Revocar permiso de corrección' }, ESPERA)
  fireEvent.change(within(modal).getByLabelText(/Motivo de revocación/), { target: { value: 'Ya corrigió los registros' } })
  fireEvent.click(within(modal).getByRole('button', { name: 'Confirmar revocación' }))
}

beforeEach(() => {
  localStorage.clear()
  vi.spyOn(handlers.permisos, 'listar').mockResolvedValue({ items: [VIGENTE], total: 1, page: 1, page_size: 40, total_pages: 1 })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Revocar un permiso de corrección (CU028)', () => {
  it('revoca con el motivo escrito y muestra el literal de CU028', async () => {
    const revocar = vi.spyOn(handlers.permisos, 'revocar').mockResolvedValue({ ...VIGENTE, estado: 'revocado' })
    await revocarConMotivo()

    expect(await screen.findByText('Permiso de corrección revocado correctamente.', {}, ESPERA)).toBeInTheDocument()
    expect(revocar).toHaveBeenCalledWith(9, 71, 'Ya corrigió los registros')
  })

  it.each([
    ['permiso_ya_revocado', 'El permiso ya fue revocado. Se actualizó su información.'],
    ['permiso_vencido', 'El permiso ya venció y no requiere revocación.'],
  ])('si el servidor responde %s, avisa del cambio de estado en vez de un error', async (motivo, aviso) => {
    vi.spyOn(handlers.permisos, 'revocar').mockRejectedValue(errorHttp(409, { motivo, detail: 'texto del servidor' }))
    await revocarConMotivo()

    expect(await screen.findByText(aviso, {}, ESPERA)).toBeInTheDocument()
    expect(screen.queryByText('texto del servidor')).not.toBeInTheDocument()
  })
})
