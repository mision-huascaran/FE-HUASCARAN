// Humo de la pantalla de captura semanal (P4/P5) contra los handlers REALES del
// mock. Es la pantalla más pesada del docente —grilla, rúbrica y cajón de
// libros— y la que más se rompe cuando cambia la forma de un handler.
import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { crearQueryClient } from '../../App'
import { ToastProvider } from '../../components/ui'
import ReporteSemanalPage from '../reporteSemanal/ReporteSemanalPage'
import useSessionStore from '../../store/sessionStore'
import useFiltrosStore from '../../store/filtrosStore'
import { ROLES } from '../../auth/roles'
import * as db from '../../api/mock/db'

const ESPERA = { timeout: 6000 }

function montar(ruta = '/captura') {
  useSessionStore.setState({
    token: 'mock.1.2026',
    usuario: { id_usuario: 1, id_rol: ROLES.PROFESOR, id_docente: 1, nombres: 'Docente de prueba' },
    cargando: false,
  })
  useFiltrosStore.setState({ idPeriodo: db.PERIODO_VIGENTE.id_periodo })

  return render(
    <QueryClientProvider client={crearQueryClient()}>
      <ToastProvider>
        <MemoryRouter initialEntries={[ruta]}>
          <Routes>
            <Route path="/captura" element={<ReporteSemanalPage />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

describe('Captura semanal (P4)', () => {
  it('carga la grilla con todos los alumnos del grado en una sola pantalla', async () => {
    montar()

    const tabla = await screen.findByRole('table', {}, ESPERA)
    const cabecera = within(tabla).getAllByRole('columnheader').map((c) => c.textContent)
    expect(cabecera).toEqual(
      expect.arrayContaining([
        'Estudiante',
        'Asistencia',
        'Libros de subir de nivel',
        'Sala de lectura',
        'Observación',
      ]),
    )
    // Filas precargadas, no un formulario por alumno (RNF-006).
    expect(within(tabla).getAllByRole('row').length).toBeGreaterThan(1)
  })

  it('ofrece las acciones masivas del docente', async () => {
    montar()
    await screen.findByRole('table', {}, ESPERA)

    expect(screen.getByRole('button', { name: /Marcar toda la asistencia/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Copiar semana anterior/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Guardar semana/i })).toBeInTheDocument()
  })

  it('marcar toda la asistencia deja filas pendientes de guardar', async () => {
    const usuario = userEvent.setup()
    montar()
    await screen.findByRole('table', {}, ESPERA)

    await usuario.click(screen.getByRole('button', { name: /Marcar toda la asistencia/i }))

    // El contador del botón de guardar refleja lo que está sin enviar.
    expect(await screen.findByRole('button', { name: /Guardar semana \(\d+\)/i })).toBeInTheDocument()
  })
})

describe('Rúbrica semanal (P5)', () => {
  it('la pestaña de rúbrica pinta fluidez y comprensión juntas', async () => {
    montar('/captura?vista=rubrica')

    const tabla = await screen.findByRole('table', {}, ESPERA)
    const cabecera = within(tabla).getAllByRole('columnheader').map((c) => c.textContent)
    expect(cabecera).toEqual(
      expect.arrayContaining(['Fluidez lectora', 'Comprensión lectora', 'Ciclo evaluado']),
    )
    expect(screen.getByText(/se registran siempre juntas/i)).toBeInTheDocument()
  })

  it('se puede ir y volver entre las dos pestañas', async () => {
    const usuario = userEvent.setup()
    montar()
    await screen.findByRole('table', {}, ESPERA)

    await usuario.click(screen.getByRole('tab', { name: 'Rúbrica' }))
    expect(await screen.findByText(/se registran siempre juntas/i, {}, ESPERA)).toBeInTheDocument()

    await usuario.click(screen.getByRole('tab', { name: 'Reporte semanal' }))
    expect(
      await screen.findByRole('button', { name: /Marcar toda la asistencia/i }, ESPERA),
    ).toBeInTheDocument()
  })
})
