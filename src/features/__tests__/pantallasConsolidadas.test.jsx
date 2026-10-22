// Humo de las pantallas de las Fases 6 y 7, montadas contra los handlers REALES
// del mock. Los gráficos de recharts no se pintan en jsdom (no hay medidas),
// así que aquí se comprueba lo demás: indicadores, tablas y avisos.
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { crearQueryClient } from '../../App'
import { ToastProvider } from '../../components/ui'
import DashboardPage from '../dashboard/DashboardPage'
import MantenimientoColegios from '../colegios/MantenimientoColegios'
import ConsultaColegiosPage from '../consultaColegios/ConsultaColegiosPage'
import useSessionStore from '../../store/sessionStore'
import useFiltrosStore, { FILTROS_DASHBOARD_VACIOS } from '../../store/filtrosStore'
import { ROLES } from '../../auth/roles'
import * as db from '../../api/mock/db'

function montar(elemento, { ruta = '/', patron = '/', idRol = ROLES.JEFA } = {}) {
  useSessionStore.setState({
    token: 'mock.4.2026',
    usuario: { id_usuario: 4, id_rol: idRol, id_docente: idRol === ROLES.PROFESOR ? 1 : null, nombre_completo: 'Prueba' },
    cargando: false,
  })
  useFiltrosStore.setState({ idPeriodo: db.PERIODO_VIGENTE.id_periodo, dashboard: FILTROS_DASHBOARD_VACIOS })
  return render(
    <QueryClientProvider client={crearQueryClient()}>
      <ToastProvider>
        <MemoryRouter initialEntries={[ruta]}>
          <Routes>
            <Route path={patron} element={elemento} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

const ESPERA = { timeout: 8000 }

describe('Dashboard (P12)', () => {
  it('pinta los cuatro indicadores y una pestaña por colegio (RF-006)', async () => {
    montar(<DashboardPage />, { ruta: '/dashboard', patron: '/dashboard' })
    expect(await screen.findByText('Estudiantes en el programa', {}, ESPERA)).toBeInTheDocument()
    expect(screen.getByText('Cobertura del periodo')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Todos los colegios' })).toBeInTheDocument()
    expect(screen.getAllByRole('tab')).toHaveLength(db.COLEGIOS.length + 1)
  })

  it('lee los filtros desde la URL para poder compartir la vista', async () => {
    montar(<DashboardPage />, { ruta: '/dashboard?colegio=3', patron: '/dashboard' })
    const pestana = await screen.findByRole('tab', { name: /Shupluy/ }, ESPERA)
    expect(pestana).toHaveAttribute('aria-selected', 'true')
  })
})

describe('Colegios (P13)', () => {
  it('Nuevo colegio pide los Subprogramas, obligatorios en CU013', async () => {
    montar(<MantenimientoColegios />, { ruta: '/colegios', patron: '/colegios' })
    fireEvent.click(await screen.findByRole('button', { name: /agregar/i }, ESPERA))
    const dialogo = await screen.findByRole('dialog', {}, ESPERA)
    expect(within(dialogo).getByText('Subprogramas')).toBeInTheDocument()
    expect(await within(dialogo).findByRole('checkbox', { name: /Alfabetización/ }, ESPERA)).toBeInTheDocument()
  })
})

describe('Consulta de colegios (RF-003)', () => {
  it('avisa del modo consulta al abrir un colegio no asignado', async () => {
    const { container } = montar(<ConsultaColegiosPage />, { ruta: '/consulta-colegios', patron: '/consulta-colegios', idRol: ROLES.PROFESOR })
    const selector = await screen.findByLabelText('Colegio')
    // Las opciones llegan del catálogo: se espera a que exista la del colegio.
    // La docente 1 no tiene Tinco (9) en ningún periodo.
    await screen.findByRole('option', { name: /Tinco/ }, ESPERA)
    fireEvent.change(selector, { target: { value: '9' } })
    expect(await screen.findByText(/Modo consulta/, {}, ESPERA)).toBeInTheDocument()
    expect(container.querySelector('textarea')).toBeNull()
  })
})
