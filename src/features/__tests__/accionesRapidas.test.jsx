import { render, screen } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { crearQueryClient } from '../../App'
import { ToastProvider } from '../../components/ui'
import useSessionStore from '../../store/sessionStore'
import useFiltrosStore from '../../store/filtrosStore'
import { ROLES } from '../../auth/roles'
import EstudiantesPage from '../estudiantes/EstudiantesPage'

describe('Acciones rápidas del estudiante', () => {
  it('muestra un botón de acciones rápidas por fila para entrar al reporte semanal o registro de vuelo', async () => {
    useSessionStore.setState({
      token: 'mock.1.2026',
      usuario: { id_usuario: 1, id_rol: ROLES.PROFESOR, id_docente: 1, nombres: 'Docente de prueba' },
      cargando: false,
    })
    useFiltrosStore.setState({ idPeriodo: 1 })

    render(
      <QueryClientProvider client={crearQueryClient()}>
        <ToastProvider>
          <MemoryRouter initialEntries={['/estudiantes']}>
            <Routes>
              <Route path="/estudiantes" element={<EstudiantesPage />} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>,
    )

    const botones = await screen.findAllByRole('button', { name: /abrir acciones rápidas para/i })
    expect(botones.length).toBeGreaterThan(0)
  })
})
