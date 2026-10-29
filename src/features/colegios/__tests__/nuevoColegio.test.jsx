// Colegios (CU013): el alta pide los Subprogramas, que son obligatorios.
import { afterEach, describe, expect, it } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
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

  /**
   * D61 y D70 — CP-COL-04, CP-CAL-01. Sin conexión la pantalla entera se
   * cambiaba por "Requiere conexión": no se veía la copia y no había forma
   * de llegar al Calendario académico, que sí se consulta sin conexión.
   */
  it('sin conexión sigue mostrando los colegios y deja abrir el calendario', async () => {
    montar()
    await screen.findByRole('table', {}, ESPERA)
    await screen.findAllByRole('button', { name: /^editar /i }, ESPERA)

    act(() => {
      Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true })
      window.dispatchEvent(new Event('offline'))
    })

    expect(screen.queryByText('Requiere conexión')).not.toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^editar /i })[0]).toBeDisabled()
    expect(screen.getByRole('button', { name: /calendario académico/i })).toBeEnabled()
  })
})

afterEach(() => {
  Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true })
  window.dispatchEvent(new Event('online'))
})
