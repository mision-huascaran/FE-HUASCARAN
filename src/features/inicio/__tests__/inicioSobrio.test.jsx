// Inicio sobrio: línea de contexto, tarjetas sin color salvo vencidos e
// incompletos, el desglose como tabla y las Alertas en un desplegable que
// recuerda si se dejó abierto.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { crearQueryClient } from '../../../App'
import InicioSupervisor from '../InicioSupervisor'
import AlertasInactividad from '../AlertasInactividad'
import { CLAVE_ALERTAS_ABIERTAS } from '../alertasAbiertas'
import useSessionStore from '../../../store/sessionStore'
import { ROLES } from '../../../auth/roles'

const supervisor = vi.fn()
vi.mock('../../../api/resources/inicio', () => ({
  obtenerInicioDocente: vi.fn(),
  obtenerInicioSupervisor: () => supervisor(),
  obtenerResumenSupervisor: () => supervisor(),
  obtenerInicioDirectivo: vi.fn(),
  obtenerResumenDocente: vi.fn(),
}))

const ESPERA = { timeout: 8000 }
const VENCIDOS = 'Registros vencidos'
const INCOMPLETOS = 'Registros incompletos'
const TEXTO_NORMAL = 'text-ink-900'
const VER = 'Ver alertas'
const EXPANDIDO = 'aria-expanded'
const LISTA = { name: 'Alertas operativas' }
const CRITICA = 'Incumplimiento de Sede - Colegio Shilla: Sin registros obligatorios en el periodo académico actual.'
const AVISO_1 = 'Inactividad Operativa - Carlos Minaya: Sin actividad registrada en los últimos 4 días hábiles.'
const AVISO_2 = 'Sincronización Olvidada - Luis Mendoza: Registros vencidos, último inicio de sesión hace más de 3 días.'

const RESUMEN = {
  colegios_registrados: 9,
  docentes_activos: 3,
  docentes_con_actividad_activa: 0,
  registros_vencidos: 3,
  registros_incompletos: 1,
  vencidos_por_modulo: { asistencias: 1, lectura: 0, rubrica: 2, registro_vuelo: 0 },
  incompletos_por_modulo: { asistencias: 1, lectura: 0, rubrica: 0, registro_vuelo: 0 },
  // Como las ordena el servidor: sincronización, inactividad y sede al final.
  alertas: [
    { tipo: 'sincronizacion_olvidada', mensaje: AVISO_2, critica: false },
    { tipo: 'inactividad_operativa', mensaje: AVISO_1, critica: false },
    { tipo: 'incumplimiento_sede', mensaje: CRITICA, critica: true },
  ],
}

function montar(componente) {
  useSessionStore.setState({
    token: 'mock.1.2026',
    usuario: { id_usuario: 1, id_rol: ROLES.SUPERVISOR, id_docente: null, nombres: 'Prueba' },
    cargando: false,
  })
  return render(
    <QueryClientProvider client={crearQueryClient()}>
      <MemoryRouter>{componente}</MemoryRouter>
    </QueryClientProvider>,
  )
}

/** El número de una tarjeta, a partir de su etiqueta. */
const valorDe = (etiqueta) => screen.getByText(etiqueta, { exact: true }).nextElementSibling

beforeEach(() => {
  localStorage.clear()
  supervisor.mockReset()
})

describe('Inicio del Supervisor', () => {
  it('lleva el rol y la fecha bajo el título, y ya no el libro', async () => {
    supervisor.mockResolvedValue(RESUMEN)
    const { container } = montar(<InicioSupervisor />)

    const titulo = await screen.findByRole('heading', { name: 'Inicio', level: 1 }, ESPERA)
    expect(titulo.nextElementSibling).toHaveTextContent(/^Supervisor · \S+ \d{2}\/\d{2}\/\d{4}$/)
    expect(container.querySelector('img')).toBeNull()
  })

  it('solo vencidos e incompletos cambian de color, y solo si son mayores que 0', async () => {
    supervisor.mockResolvedValue(RESUMEN)
    montar(<InicioSupervisor />)
    await screen.findByText(VENCIDOS, {}, ESPERA)

    expect(valorDe(VENCIDOS)).toHaveClass('text-danger-600')
    expect(valorDe(INCOMPLETOS)).toHaveClass('text-warning-600')
    expect(valorDe('Colegios registrados')).toHaveClass(TEXTO_NORMAL)
  })

  it('en 0, vencidos e incompletos van en el color de texto normal', async () => {
    supervisor.mockResolvedValue({ ...RESUMEN, registros_vencidos: 0, registros_incompletos: 0 })
    montar(<InicioSupervisor />)
    await screen.findByText(VENCIDOS, {}, ESPERA)

    expect(valorDe(VENCIDOS)).toHaveClass(TEXTO_NORMAL)
    expect(valorDe(INCOMPLETOS)).toHaveClass(TEXTO_NORMAL)
  })

  it('el desglose es una tabla de 2 filas por 4 módulos; solo lo mayor que 0 enlaza', async () => {
    supervisor.mockResolvedValue(RESUMEN)
    montar(<InicioSupervisor />)
    const tabla = await screen.findByRole('table', {}, ESPERA)

    expect(within(tabla).getAllByRole('columnheader').map((c) => c.textContent)).toEqual([
      'Asistencias',
      'Lectura',
      'Rúbrica',
      'Registro de Vuelo',
    ])
    expect(within(tabla).getAllByRole('rowheader').map((c) => c.textContent)).toEqual(['Vencidos', 'Incompletos'])
    const enlaces = within(tabla).getAllByRole('link')
    expect(enlaces.map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['1', '/asistencia'],
      ['2', '/rubrica'],
      ['1', '/asistencia'],
    ])
    expect(within(tabla).getByRole('link', { name: /Vencidos en Rúbrica: 2/ })).toBeInTheDocument()
  })
})

describe('Alertas', () => {
  it('cerradas por defecto, con la cuenta siempre visible', () => {
    montar(<AlertasInactividad alertas={RESUMEN.alertas} />)

    expect(screen.getByRole('heading', { name: 'Alertas' })).toBeInTheDocument()
    expect(screen.getByText('1 crítica')).toHaveClass('text-danger-600')
    expect(screen.getByText('2 avisos')).toBeInTheDocument()
    const boton = screen.getByRole('button', { name: VER })
    expect(boton).toHaveAttribute(EXPANDIDO, 'false')
    expect(screen.queryByRole('list', LISTA)).toBeNull()
  })

  it('el botón despliega la lista (aria-controls) con las críticas primero', () => {
    montar(<AlertasInactividad alertas={RESUMEN.alertas} />)
    const boton = screen.getByRole('button', { name: VER })

    fireEvent.click(boton)

    expect(boton).toHaveAttribute(EXPANDIDO, 'true')
    expect(boton).toHaveAccessibleName('Ocultar alertas')
    const lista = screen.getByRole('list', LISTA)
    expect(lista).toHaveAttribute('id', boton.getAttribute('aria-controls'))
    expect(within(lista).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      `Crítica: ${CRITICA}`,
      `Aviso: ${AVISO_2}`,
      `Aviso: ${AVISO_1}`,
    ])

    fireEvent.click(boton)
    expect(boton).toHaveAttribute(EXPANDIDO, 'false')
    expect(screen.queryByRole('list', LISTA)).toBeNull()
  })

  it('recuerda si se dejó abierto, y solo guarda ese booleano', () => {
    const { unmount } = montar(<AlertasInactividad alertas={RESUMEN.alertas} />)
    fireEvent.click(screen.getByRole('button', { name: VER }))
    expect(localStorage.getItem(CLAVE_ALERTAS_ABIERTAS)).toBe('true')
    expect(Object.keys(localStorage)).toEqual([CLAVE_ALERTAS_ABIERTAS])
    unmount()

    montar(<AlertasInactividad alertas={RESUMEN.alertas} />)
    expect(screen.getByRole('button', { name: 'Ocultar alertas' })).toHaveAttribute(EXPANDIDO, 'true')
    expect(screen.getByRole('list', LISTA)).toBeVisible()
  })

  it('sin alertas, la cabecera dice "Sin alertas" y no hay nada que desplegar', () => {
    localStorage.setItem(CLAVE_ALERTAS_ABIERTAS, 'true')
    montar(<AlertasInactividad alertas={[]} />)

    expect(screen.getByText('Sin alertas')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByRole('list')).toBeNull()
  })

  it('sin críticas, la cuenta solo nombra los avisos', () => {
    montar(<AlertasInactividad alertas={RESUMEN.alertas.filter((a) => !a.critica)} />)
    expect(screen.getByText('2 avisos')).toBeInTheDocument()
    expect(screen.queryByText(/crítica/)).toBeNull()
  })
})
