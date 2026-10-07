// La regla acordada con el backend: el Docente gestiona alumnos, el Supervisor
// solo los consulta. El servidor responde 403 al Supervisor en POST y PATCH
// /alumnos, así que la pantalla no debe ofrecerle acciones que fallarían.
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
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
  it('el Docente gestiona los alumnos de sus secciones', async () => {
    montar(ROLES.DOCENTE)
    expect(await screen.findByRole('button', { name: /^nuevo$/i }, ESPERA)).toBeInTheDocument()
    expect((await screen.findAllByRole('button', { name: /^editar /i }, ESPERA)).length).toBeGreaterThan(0)
    // Nunca se borra: inactivar cambia el estado y deja auditoría (D5).
    expect(screen.getAllByRole('button', { name: /^inactivar /i }).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: /eliminar/i })).not.toBeInTheDocument()
  })

  it('el Supervisor también los gestiona, sobre todos los colegios (D1)', async () => {
    // Cambió respecto al Documento de Análisis: el alumno no es un usuario, pero
    // el Supervisor lo da de alta desde la pestaña Alumnos de Usuarios.
    montar(ROLES.SUPERVISOR)
    expect(await screen.findByRole('button', { name: /^nuevo$/i }, ESPERA)).toBeInTheDocument()
    expect((await screen.findAllByRole('button', { name: /^editar /i }, ESPERA)).length).toBeGreaterThan(0)
  })

  it('abre filtrado por Estado = Activo, como todas las grillas', async () => {
    montar(ROLES.DOCENTE)
    expect(await screen.findByLabelText('Estado', {}, ESPERA)).toHaveValue('activo')
  })

  it('el popup de Visualizar no deja editar ningún campo (S3)', async () => {
    montar(ROLES.DOCENTE)
    fireEvent.click((await screen.findAllByRole('button', { name: /^visualizar /i }, ESPERA))[0])

    const dialogo = await screen.findByRole('dialog', {}, ESPERA)
    expect(within(dialogo).getByRole('heading', { name: /visualizar/i })).toBeInTheDocument()
    within(dialogo)
      .getAllByRole('textbox')
      .forEach((campo) => expect(campo).toBeDisabled())
    expect(within(dialogo).queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument()
  })
})
