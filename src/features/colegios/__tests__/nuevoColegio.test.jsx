// Colegios (CU013): el alta pide los Subprogramas, que son obligatorios.
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { crearQueryClient } from '../../../App'
import { ToastProvider } from '../../../components/ui'
import MantenimientoColegios from '../MantenimientoColegios'
import useSessionStore from '../../../store/sessionStore'
import { ROLES } from '../../../auth/roles'

const ESPERA = { timeout: 8000 }

function montar() {
  useSessionStore.setState({
    token: 'mock.4.2026',
    usuario: { id_usuario: 4, id_rol: ROLES.JEFA, id_docente: null, nombre_completo: 'Prueba' },
    cargando: false,
  })
  return render(
    <QueryClientProvider client={crearQueryClient()}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/colegios']}>
          <Routes>
            <Route path="/colegios" element={<MantenimientoColegios />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

describe('Colegios (CU013)', () => {
  it('Nuevo colegio pide los Subprogramas, obligatorios en CU013', async () => {
    montar()
    fireEvent.click(await screen.findByRole('button', { name: /agregar/i }, ESPERA))
    const dialogo = await screen.findByRole('dialog', {}, ESPERA)
    expect(within(dialogo).getByText('Subprogramas')).toBeInTheDocument()
    expect(await within(dialogo).findByRole('checkbox', { name: /Alfabetización/ }, ESPERA)).toBeInTheDocument()
  })
})
