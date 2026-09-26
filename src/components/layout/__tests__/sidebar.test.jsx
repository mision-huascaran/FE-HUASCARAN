// El pie del sidebar es el ÚNICO sitio con la identidad de quien tiene la
// sesión: antes el nombre salía también en la barra superior y se veía dos
// veces en pantalla. Aquí viven el correo, el cambio de contraseña y la salida.
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { crearQueryClient } from '../../../App'
import { AuthProvider } from '../../../auth/AuthProvider'
import { ToastProvider } from '../../ui'
import Sidebar from '../Sidebar'
import useSessionStore from '../../../store/sessionStore'
import { ROLES } from '../../../auth/roles'

function montar(idRol = ROLES.SUPERVISOR) {
  useSessionStore.setState({
    token: 'mock.4.2026',
    usuario: {
      id_usuario: 4,
      id_rol: idRol,
      id_docente: idRol === ROLES.DOCENTE ? 1 : null,
      nombre_completo: 'Ana Lucía Bustamante',
      correo: 'jefatura@sicedu.test',
    },
    cargando: false,
  })
  return render(
    <QueryClientProvider client={crearQueryClient()}>
      <ToastProvider>
        <MemoryRouter>
          <AuthProvider>
            <Sidebar />
          </AuthProvider>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

describe('Sidebar', () => {
  it('muestra el nombre y el rol de quien tiene la sesión', () => {
    montar()
    expect(screen.getByText('Ana Lucía Bustamante')).toBeInTheDocument()
    expect(screen.getByText('Supervisor')).toBeInTheDocument()
  })

  it('el correo y el cambio de contraseña viven en el menú, no a la vista', () => {
    montar()
    // Cerrado: nada de esto se ve.
    expect(screen.queryByText('jefatura@sicedu.test')).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: /cambiar contraseña/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { expanded: false }))

    expect(screen.getByText('jefatura@sicedu.test')).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /cambiar contraseña/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /cerrar sesión/i })).toBeInTheDocument()
  })

  it('el menú se pliega al volver a pulsarlo', () => {
    montar()
    const boton = screen.getByRole('button', { expanded: false })
    fireEvent.click(boton)
    expect(boton).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(boton)
    expect(boton).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('jefatura@sicedu.test')).not.toBeInTheDocument()
  })

  it('cada rol ve solo sus enlaces: el Docente no entra en Administración', () => {
    montar(ROLES.DOCENTE)
    expect(screen.getByRole('link', { name: /Alumnos/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Reporte semanal/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Administración/ })).not.toBeInTheDocument()
  })

  it('el Directivo llega a Cuentas y no a las pantallas de captura', () => {
    montar(ROLES.DIRECTIVO)
    expect(screen.getByRole('link', { name: /Cuentas/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Reporte semanal/ })).not.toBeInTheDocument()
  })
})
