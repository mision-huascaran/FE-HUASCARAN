// La regla acordada con el backend: el Docente gestiona alumnos, el Supervisor
// solo los consulta. El servidor responde 403 al Supervisor en POST y PATCH
// /alumnos, así que la pantalla no debe ofrecerle acciones que fallarían.
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { crearQueryClient } from '../../App'
import { ToastProvider } from '../../components/ui'
import AlumnosPage from '../alumnos/AlumnosPage'
import useSessionStore from '../../store/sessionStore'
import { ROLES } from '../../auth/roles'

const ESPERA = { timeout: 8000 }

function montar(idRol) {
  useSessionStore.setState({
    token: 'mock.4.2026',
    usuario: { id_usuario: 4, id_rol: idRol, id_docente: idRol === ROLES.DOCENTE ? 1 : null, nombre_completo: 'Prueba' },
    cargando: false,
  })
  return render(
    <QueryClientProvider client={crearQueryClient()}>
      <ToastProvider>
        <MemoryRouter>
          <AlumnosPage />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

describe('Módulo Alumnos (CU008)', () => {
  it('el Docente puede crear, editar y dar de baja a sus alumnos', async () => {
    montar(ROLES.DOCENTE)
    expect(await screen.findByRole('button', { name: /nuevo alumno/i }, ESPERA)).toBeInTheDocument()
    expect((await screen.findAllByRole('button', { name: /^editar /i }, ESPERA)).length).toBeGreaterThan(0)
    // La baja es lógica (PATCH activo:false); el borrado definitivo está prohibido.
    expect(screen.getAllByRole('button', { name: /dar de baja a/i }).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: /eliminar/i })).not.toBeInTheDocument()
  })

  it('el Supervisor solo consulta: ni alta, ni edición, ni baja', async () => {
    montar(ROLES.SUPERVISOR)
    // Se espera a que la tabla tenga filas antes de afirmar que NO hay acciones.
    expect(await screen.findByRole('table', {}, ESPERA)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /nuevo alumno/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^editar /i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /dar de baja a/i })).not.toBeInTheDocument()
  })
})
