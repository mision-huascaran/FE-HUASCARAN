// Cuentas de Supervisor y Directivo (P16, CU024).
//
// Plan de Prueba: «el Supervisor gestiona Docentes y Supervisores; el Directivo,
// otros Directivos». Nadie crea cuentas de la parcela ajena, y el servidor lo
// aplica con un 403, así que la pantalla no ofrece lo que iba a fallar.
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { crearQueryClient } from '../../../App'
import { ToastProvider } from '../../../components/ui'
import TabUsuarios from '../TabUsuarios'
import useSessionStore from '../../../store/sessionStore'
import { ROLES } from '../../../auth/roles'

const ESPERA = { timeout: 8000 }

function montar(idRol) {
  useSessionStore.setState({
    token: 'mock.4.2026',
    usuario: { id_usuario: 4, id_rol: idRol, id_docente: null, nombre_completo: 'Prueba' },
    cargando: false,
  })
  return render(
    <QueryClientProvider client={crearQueryClient()}>
      <ToastProvider>
        <TabUsuarios />
      </ToastProvider>
    </QueryClientProvider>,
  )
}

describe('Cuentas (P16)', () => {
  it('el Supervisor solo puede crear Supervisores, nunca Directivos', async () => {
    montar(ROLES.SUPERVISOR)
    fireEvent.click(await screen.findByRole('button', { name: /nueva cuenta/i }, ESPERA))

    const dialogo = await screen.findByRole('dialog', {}, ESPERA)
    const rol = within(dialogo).getByLabelText(/Rol/)
    const opciones = within(rol).getAllByRole('option').map((o) => o.textContent)
    expect(opciones).toContain('Supervisor')
    expect(opciones).not.toContain('Directivo')
  })

  it('el Directivo solo puede crear Directivos', async () => {
    montar(ROLES.DIRECTIVO)
    fireEvent.click(await screen.findByRole('button', { name: /nueva cuenta/i }, ESPERA))

    const dialogo = await screen.findByRole('dialog', {}, ESPERA)
    const opciones = within(within(dialogo).getByLabelText(/Rol/)).getAllByRole('option').map((o) => o.textContent)
    expect(opciones).toContain('Directivo')
    expect(opciones).not.toContain('Supervisor')
  })

  it('no deja crear una cuenta sin nombre, apellidos y un correo con forma válida', async () => {
    montar(ROLES.SUPERVISOR)
    fireEvent.click(await screen.findByRole('button', { name: /nueva cuenta/i }, ESPERA))
    const dialogo = await screen.findByRole('dialog', {}, ESPERA)

    const crear = within(dialogo).getByRole('button', { name: /crear cuenta/i })
    expect(crear).toBeDisabled()

    fireEvent.change(within(dialogo).getByLabelText('Nombres'), { target: { value: 'Rosa' } })
    fireEvent.change(within(dialogo).getByLabelText('Apellidos'), { target: { value: 'Quispe' } })
    fireEvent.change(within(dialogo).getByLabelText(/Correo/), { target: { value: 'sin-arroba' } })
    expect(crear).toBeDisabled()

    fireEvent.change(within(dialogo).getByLabelText(/Correo/), { target: { value: 'rosa@sicedu.test' } })
    expect(crear).toBeEnabled()
  })

  it('al editar una cuenta se corrigen los datos pero no el rol', async () => {
    montar(ROLES.SUPERVISOR)
    fireEvent.click((await screen.findAllByRole('button', { name: /editar cuenta de/i }, ESPERA))[0])

    const dialogo = await screen.findByRole('dialog', {}, ESPERA)
    expect(within(dialogo).getByRole('heading', { name: /editar cuenta/i })).toBeInTheDocument()
    // Una cuenta no cambia de parcela corrigiéndole el nombre.
    expect(within(dialogo).getByLabelText(/Rol/)).toBeDisabled()
    expect(within(dialogo).getByRole('button', { name: 'Guardar' })).toBeInTheDocument()
  })

  it('ofrece desactivar las cuentas activas', async () => {
    montar(ROLES.SUPERVISOR)
    expect((await screen.findAllByRole('button', { name: /desactivar cuenta de/i }, ESPERA)).length).toBeGreaterThan(0)
  })
})
