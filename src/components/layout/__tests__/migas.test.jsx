// Auditoría de UX #737, U29: las migas dicen dónde estás, también en las
// vistas que se abren sin cambiar de URL.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Breadcrumbs, { conExtra } from '../Breadcrumbs'
import useMigaStore, { useMigaExtra } from '../../../store/migaStore'
import useSessionStore from '../../../store/sessionStore'
import { ROLES } from '../../../auth/roles'

function Vista({ nombre, volver }) {
  useMigaExtra(nombre, volver)
  return null
}

function montar(ruta, nombre, volver) {
  useSessionStore.setState({ usuario: { id_usuario: 1, id_rol: ROLES.SUPERVISOR } })
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Breadcrumbs />
      {nombre !== undefined && <Vista nombre={nombre} volver={volver} />}
    </MemoryRouter>,
  )
}

afterEach(() => useMigaStore.setState({ extra: null, volver: null }))

describe('migas de pan', () => {
  it('la ficha de un alumno dice su nombre, no "Detalle"', () => {
    montar('/estudiantes/41', 'Abigail Alva Chávez')
    expect(screen.getByText('Abigail Alva Chávez')).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByText('Detalle')).toBeNull()
  })

  it('una vista sin ruta propia se añade al final', () => {
    montar('/colegios', 'Calendario académico')
    expect(screen.getByRole('link', { name: 'Colegios' })).toBeInTheDocument()
    expect(screen.getByText('Calendario académico')).toHaveAttribute('aria-current', 'page')
  })

  it('al desmontarse la vista, la miga se va con ella', () => {
    const { unmount } = montar('/colegios', 'Calendario académico')
    unmount()
    expect(useMigaStore.getState().extra).toBeNull()
  })

  it('sin vista registrada, las migas son las de la URL', () => {
    montar('/estudiantes/41')
    expect(screen.getByText('Detalle')).toBeInTheDocument()
    expect(conExtra([{ to: '/a', label: 'A' }], null, '/a')).toEqual([{ to: '/a', label: 'A' }])
  })

  // BUG 10 del reporte de QA del 09/11/2026: "Colegios" apuntaba con un
  // <Link> a la URL en la que ya se estaba —la vista de detalle no cambia de
  // ruta—, así que el clic no navegaba a ningún lado y parecía no hacer nada.
  it('con "volver" registrado, la miga de en medio es un botón que lo llama', () => {
    const volver = vi.fn()
    montar('/colegios', 'Colegio de Prueba', volver)

    const miga = screen.getByRole('button', { name: 'Colegios' })
    expect(screen.queryByRole('link', { name: 'Colegios' })).toBeNull()

    fireEvent.click(miga)
    expect(volver).toHaveBeenCalledTimes(1)
  })
})
