// D77 — CP-PER-01. Los filtros de Permisos de corrección se restauran al volver
// a la pantalla (CU028, por usuario autenticado).
import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import PermisosDeCorreccion from '../PermisosDeCorreccion'
import { ROLES } from '../../../auth/roles'
import { renderConProveedores } from '../../../test/renderConProveedores'

const DOCENTE = { id_usuario: 9, nombre: 'Rosa Quispe', activo: true }
const ESPERA = { timeout: 8000 }

beforeEach(() => localStorage.clear())

describe('Filtros de Permisos de corrección (D77)', () => {
  it('al volver a la pantalla siguen los que se aplicaron', async () => {
    const { unmount } = renderConProveedores(<PermisosDeCorreccion docente={DOCENTE} />, { rol: ROLES.SUPERVISOR })
    fireEvent.change(await screen.findByLabelText('Módulo', {}, ESPERA), { target: { value: 'lectura' } })
    fireEvent.click(screen.getByRole('button', { name: /^filtrar$/i }))
    unmount()

    renderConProveedores(<PermisosDeCorreccion docente={DOCENTE} />, { rol: ROLES.SUPERVISOR })
    expect(await screen.findByLabelText('Módulo', {}, ESPERA)).toHaveValue('lectura')
  })
})
