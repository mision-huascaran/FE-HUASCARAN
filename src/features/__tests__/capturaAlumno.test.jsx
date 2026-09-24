// Atajo de captura de un solo estudiante (RNF-006): la ventana trae el reporte
// semanal y el registro de vuelo DE ESE alumno, no accesos directos a otras
// pantallas, y guarda por la misma vía que las pantallas completas.
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { crearQueryClient } from '../../App'
import { ToastProvider } from '../../components/ui'
import useSessionStore from '../../store/sessionStore'
import useFiltrosStore from '../../store/filtrosStore'
import { ROLES } from '../../auth/roles'
import EstudiantesPage from '../estudiantes/EstudiantesPage'
import * as db from '../../api/mock/db'

const ESPERA = { timeout: 6000 }

function montar() {
  useSessionStore.setState({
    token: 'mock.1.2026',
    usuario: { id_usuario: 1, id_rol: ROLES.DOCENTE, id_docente: 1, nombre_completo: 'Docente de prueba' },
    cargando: false,
  })
  useFiltrosStore.setState({ idPeriodo: db.PERIODO_VIGENTE.id_periodo })

  return render(
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
}

async function abrirPrimeraFila() {
  const botones = await screen.findAllByRole('button', { name: /Registrar datos de/i }, ESPERA)
  await userEvent.click(botones[0])
  return screen.findByRole('dialog', {}, ESPERA)
}

describe('Captura de un estudiante desde la tabla', () => {
  it('cada fila ofrece el botón para registrar a ese estudiante', async () => {
    montar()
    const botones = await screen.findAllByRole('button', { name: /Registrar datos de/i }, ESPERA)
    expect(botones.length).toBeGreaterThan(0)
  })

  it('abre una ventana con las tres secciones del estudiante', async () => {
    montar()
    const dialogo = await abrirPrimeraFila()
    const pestanas = within(dialogo).getAllByRole('tab').map((t) => t.textContent)
    expect(pestanas).toEqual(['Reporte semanal', 'Registro de vuelo', 'Ficha del estudiante'])
  })

  it('el reporte semanal trae el formulario completo, no un atajo a otra pantalla', async () => {
    montar()
    const dialogo = await abrirPrimeraFila()
    expect(await within(dialogo).findByRole('switch', { name: /Asistió esta semana/i }, ESPERA)).toBeInTheDocument()
    expect(within(dialogo).getByRole('button', { name: /Agregar libro/i })).toBeInTheDocument()
    expect(within(dialogo).getByLabelText(/Sala de lectura/i)).toBeInTheDocument()
    expect(within(dialogo).getByLabelText(/Observación/i)).toBeInTheDocument()
    expect(within(dialogo).getByRole('button', { name: 'Guardar' })).toBeInTheDocument()
  })

  it('el registro de vuelo pide las dos dimensiones y muestra la sugerencia calculada', async () => {
    montar()
    const dialogo = await abrirPrimeraFila()
    await userEvent.click(within(dialogo).getByRole('tab', { name: 'Registro de vuelo' }))

    expect(await within(dialogo).findByLabelText(/Fluidez lectora/i, {}, ESPERA)).toBeInTheDocument()
    expect(within(dialogo).getByLabelText(/Comprensión lectora/i)).toBeInTheDocument()
    expect(within(dialogo).getByText(/Sugerencia \(calculada\)/i)).toBeInTheDocument()
    // RN-005: el nivel inicial es derivado y nunca editable.
    expect(within(dialogo).getByLabelText(/Nivel inicial Raz-Kids/i)).toBeDisabled()
  })

  it('sin las dos dimensiones de la rúbrica no deja guardar la evaluación (RN-008)', async () => {
    montar()
    const dialogo = await abrirPrimeraFila()
    await userEvent.click(within(dialogo).getByRole('tab', { name: 'Registro de vuelo' }))
    const fluidez = await within(dialogo).findByLabelText(/Fluidez lectora/i, {}, ESPERA)
    await userEvent.selectOptions(fluidez, '')

    await waitFor(() => expect(within(dialogo).getByRole('button', { name: 'Guardar' })).toBeDisabled())
  })
})
