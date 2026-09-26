// Asignaciones docente-colegio-grado-periodo (P16, CU024).
//
// La pantalla se reescribió para cuadrar con `POST /asignaciones`, que asigna
// POR GRADO y nombra el periodo `id_periodo_academico`. Antes enviaba
// `id_periodo` y ningún grado, así que el alta fallaba siempre.
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { crearQueryClient } from '../../../App'
import { ToastProvider } from '../../../components/ui'
import TabAsignaciones from '../TabAsignaciones'
import useSessionStore from '../../../store/sessionStore'
import { ROLES } from '../../../auth/roles'

const ESPERA = { timeout: 8000 }

function montar() {
  useSessionStore.setState({
    token: 'mock.4.2026',
    usuario: { id_usuario: 4, id_rol: ROLES.SUPERVISOR, id_docente: null, nombre_completo: 'Prueba' },
    cargando: false,
  })
  return render(
    <QueryClientProvider client={crearQueryClient()}>
      <ToastProvider>
        <TabAsignaciones />
      </ToastProvider>
    </QueryClientProvider>,
  )
}

describe('Asignaciones (P16)', () => {
  it('lista las asignaciones con su docente, colegio y periodo', async () => {
    montar()
    expect(await screen.findByRole('table', {}, ESPERA)).toBeInTheDocument()
    const cabeceras = screen.getAllByRole('columnheader').map((c) => c.textContent)
    expect(cabeceras).toEqual(expect.arrayContaining(['Docente', 'Colegio', 'Grado', 'Periodo']))
    expect(screen.getAllByRole('button', { name: /Retirar asignación de/i }).length).toBeGreaterThan(0)
  })

  it('el alta pide los cuatro datos que exige la API, grado incluido', async () => {
    montar()
    await screen.findByRole('table', {}, ESPERA)
    fireEvent.click(screen.getByRole('button', { name: /nueva asignación/i }))

    const dialogo = await screen.findByRole('dialog', {}, ESPERA)
    // El grado es obligatorio en POST /asignaciones: sin él el servidor responde 422.
    for (const campo of ['Docente', 'Colegio', 'Grado', 'Periodo']) {
      expect(within(dialogo).getByLabelText(new RegExp(campo))).toBeInTheDocument()
    }
  })

  it('no deja asignar mientras falte alguno de los cuatro', async () => {
    montar()
    await screen.findByRole('table', {}, ESPERA)
    fireEvent.click(screen.getByRole('button', { name: /nueva asignación/i }))
    const dialogo = await screen.findByRole('dialog', {}, ESPERA)

    const asignar = within(dialogo).getByRole('button', { name: 'Asignar' })
    expect(asignar).toBeDisabled()

    // Con solo dos de los cuatro sigue bloqueado.
    fireEvent.change(within(dialogo).getByLabelText(/Docente/), { target: { value: '1' } })
    fireEvent.change(within(dialogo).getByLabelText(/Colegio/), { target: { value: '1' } })
    expect(asignar).toBeDisabled()
  })

  it('cancelar cierra el formulario sin registrar nada', async () => {
    montar()
    await screen.findByRole('table', {}, ESPERA)
    fireEvent.click(screen.getByRole('button', { name: /nueva asignación/i }))
    const dialogo = await screen.findByRole('dialog', {}, ESPERA)
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
