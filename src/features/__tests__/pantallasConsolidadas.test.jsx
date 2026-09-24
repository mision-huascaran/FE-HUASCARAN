// Humo de las pantallas de las Fases 6 y 7, montadas contra los handlers REALES
// del mock. Los gráficos de recharts no se pintan en jsdom (no hay medidas),
// así que aquí se comprueba lo demás: indicadores, tablas y avisos.
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { crearQueryClient } from '../../App'
import { ToastProvider } from '../../components/ui'
import DashboardPage from '../dashboard/DashboardPage'
import ColegiosPage from '../colegios/ColegiosPage'
import ColegioDetallePage from '../colegios/ColegioDetallePage'
import ConsolidadosPage from '../consolidados/ConsolidadosPage'
import AlertasPage from '../alertas/AlertasPage'
import AdministracionPage from '../administracion/AdministracionPage'
import PanelEjecutivoPage from '../panelEjecutivo/PanelEjecutivoPage'
import ReportesPage from '../reportes/ReportesPage'
import ConsultaColegiosPage from '../consultaColegios/ConsultaColegiosPage'
import useSessionStore from '../../store/sessionStore'
import useFiltrosStore, { FILTROS_DASHBOARD_VACIOS } from '../../store/filtrosStore'
import { ROLES } from '../../auth/roles'
import { RUTAS_PROTEGIDAS } from '../../rutas'
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
  it('muestra el podio y la comparativa de los nueve colegios', async () => {
    montar(<ColegiosPage />, { ruta: '/colegios', patron: '/colegios' })
    expect(await screen.findByRole('list', { name: 'Podio' }, ESPERA)).toBeInTheDocument()
    expect(screen.getByText('Comparativa de los nueve colegios')).toBeInTheDocument()
  })

  it('el detalle incluye el ranking de aulas (RF-008)', async () => {
    montar(<ColegioDetallePage />, { ruta: '/colegios/1', patron: '/colegios/:id' })
    expect(await screen.findByRole('heading', { name: /Ranrahirca/ }, ESPERA)).toBeInTheDocument()
    expect(await screen.findByText('Ranking de aulas', {}, ESPERA)).toBeInTheDocument()
  })
})

describe('Consolidados (P14)', () => {
  it('indica si el dato es snapshot o cálculo en vivo y ofrece Excel y CSV', async () => {
    montar(<ConsolidadosPage />, { ruta: '/consolidados', patron: '/consolidados' })
    expect(await screen.findByText(/Cálculo en vivo|Snapshot del cierre/, {}, ESPERA)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Excel/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /CSV/ })).toBeInTheDocument()
  })
})

describe('Alertas (P15)', () => {
  it('lista las alertas pendientes', async () => {
    montar(<AlertasPage />, { ruta: '/alertas', patron: '/alertas' })
    expect(await screen.findByRole('table', {}, ESPERA)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Marcar como revisada' }).length).toBeGreaterThan(0)
  })
})

describe('Administración (P16)', () => {
  it('abre en Docentes y ofrece las pestañas del Supervisor para crear colegios, alumnos y usuarios', async () => {
    montar(<AdministracionPage />, { ruta: '/administracion', patron: '/administracion' })
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'Docentes',
      'Asignaciones',
      'Colegios',
      'Alumnos',
      'Cuentas',
      'Periodos de evaluación',
      'Catálogos',
    ])
    expect(await screen.findByText('Rosa Elena Cárdenas Villanueva', {}, ESPERA)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /nuevo docente/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Colegios' }))
    expect(screen.getByRole('button', { name: /nuevo colegio/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Alumnos' }))
    expect(screen.getByRole('button', { name: /nuevo alumno/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Cuentas' }))
    expect(screen.getByRole('button', { name: /nueva cuenta/i })).toBeInTheDocument()
  })

  it('permite que un directivo acceda a administración para crear y gestionar cuentas', () => {
    const rutaAdmin = RUTAS_PROTEGIDAS.find((ruta) => ruta.path === '/administracion')
    expect(rutaAdmin?.allow).toContain(ROLES.DIRECTIVOS)
  })

  it('permite desactivar y reactivar cuentas desde la tabla de administración', async () => {
    montar(<AdministracionPage />, { ruta: '/administracion', patron: '/administracion' })
    fireEvent.click(await screen.findByRole('tab', { name: 'Cuentas' }, ESPERA))

    expect(await screen.findByRole('button', { name: /nueva cuenta/i }, ESPERA)).toBeInTheDocument()
    // El botón de alta está en la cabecera de la tarjeta y aparece antes que las
    // filas: hay que esperar a que la consulta de cuentas resuelva.
    expect((await screen.findAllByRole('button', { name: /desactivar cuenta de/i }, ESPERA)).length).toBeGreaterThan(0)
    // Corregir los datos de una cuenta no existe en la API: no debe haber botón.
    expect(screen.queryByRole('button', { name: /editar usuario/i })).not.toBeInTheDocument()
  })

  it('bloquea la desactivación del último supervisor activo con un mensaje de validación claro', async () => {
    montar(<AdministracionPage />, { ruta: '/administracion', patron: '/administracion' })
    fireEvent.click(await screen.findByRole('tab', { name: 'Cuentas' }, ESPERA))
    const boton = await screen.findByRole('button', { name: /desactivar cuenta de ana lucía bustamante/i }, ESPERA)
    fireEvent.click(boton)

    // La regla la aplica el servidor con un 409: la pantalla solo muestra el
    // mensaje que llega, sin adelantarse a decidir si se puede o no.
    expect(
      await screen.findByText(/No puedes desactivar la última cuenta activa de Supervisor/i, {}, ESPERA),
    ).toBeInTheDocument()
  })

  it('permite que un directivo gestione solo cuentas directivas en administración', async () => {
    montar(<AdministracionPage />, { ruta: '/administracion', patron: '/administracion', idRol: ROLES.DIRECTIVOS })
    // El Directivo no administra el programa: solo sus propias cuentas, así que
    // no hay pestañas de docentes, colegios ni catálogos.
    expect(screen.getByRole('heading', { name: 'Cuentas' })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Docentes' })).not.toBeInTheDocument()

    expect(await screen.findByRole('button', { name: /desactivar cuenta de/i }, ESPERA)).toBeInTheDocument()
    expect(screen.queryByText('Ana Lucía Bustamante Rojas')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /nueva cuenta/i })).toBeInTheDocument()
  })

  it('permite crear una cuenta de docente desde la pestaña de docentes', async () => {
    montar(<AdministracionPage />, { ruta: '/administracion', patron: '/administracion' })

    fireEvent.click(screen.getByRole('button', { name: /nuevo docente/i }))
    expect(await screen.findByRole('dialog', { name: /nuevo docente/i }, ESPERA)).toBeInTheDocument()

    fireEvent.change(await screen.findByLabelText('Nombres'), { target: { value: 'María' } })
    fireEvent.change(await screen.findByLabelText('Apellidos'), { target: { value: 'Pérez' } })
    fireEvent.change(await screen.findByLabelText('Correo institucional'), { target: { value: 'mperez@sicedu.test' } })

    fireEvent.click(screen.getByRole('button', { name: /crear cuenta/i }))

    // El backend genera la contraseña: la pantalla no la pide y la muestra para
    // que el Supervisor pueda entregarla.
    expect(await screen.findByText(/Entregue esta contraseña/i, {}, ESPERA)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /entendido/i }))
    expect(await screen.findByText('María Pérez', {}, ESPERA)).toBeInTheDocument()
  })
})

describe('Panel ejecutivo (P17)', () => {
  it('muestra los seis indicadores y ningún formulario de captura (RNF-004)', async () => {
    const { container } = montar(<PanelEjecutivoPage />, { ruta: '/panel-ejecutivo', patron: '/panel-ejecutivo', idRol: ROLES.DIRECTIVOS })
    expect(await screen.findByText('Estudiantes atendidos', {}, ESPERA)).toBeInTheDocument()
    expect(screen.getByText('Libros leídos en el año')).toBeInTheDocument()
    expect(container.querySelector('form, input, textarea')).toBeNull()
  })

  it('reportes ofrece las tres descargas', () => {
    montar(<ReportesPage />, { ruta: '/reportes', patron: '/reportes', idRol: ROLES.DIRECTIVOS })
    expect(screen.getAllByRole('button', { name: /Excel/ })).toHaveLength(3)
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
