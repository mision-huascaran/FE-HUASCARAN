// Inicio del Docente (CU010): cada estado condicional de la cabecera y de las
// tarjetas. Los datos se controlan sustituyendo sus dos hooks.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import InicioDocente from '../InicioDocente'
import useFiltrosStore from '../../../store/filtrosStore'
import useSessionStore from '../../../store/sessionStore'
import { PERIODO_VIGENTE } from '../../../api/mock/db'
import { ROLES } from '../../../auth/roles'
import { jwtDePrueba } from '../../../test/fabricas'
import { renderConProveedores } from '../../../test/renderConProveedores'

const estado = vi.hoisted(() => ({ resumen: {}, actividad: {} }))
vi.mock('../useResumenDocente', () => ({ default: () => estado.resumen }))
vi.mock('../useActividad', () => ({ default: () => estado.actividad }))
// Los Resúmenes de Acción tienen su propia prueba (resumenesAccion.test.jsx).
vi.mock('../ResumenesAccion', () => ({ default: () => null }))

const RESUMEN = {
  mis_estudiantes: 48,
  reporte_semana: { registrados: 30, total: 48 },
  pendientes_rubrica: 5,
  ajustes_por_revisar: 2,
  evaluacion_abierta: { nombre: 'Octubre', registrados: 20, total: 48 },
}

function montar({ usuario = {}, hora = 9 } = {}) {
  vi.setSystemTime(new Date(2026, 9, 10, hora, 0, 0))
  renderConProveedores(<InicioDocente />, { rol: ROLES.DOCENTE })
  useSessionStore.setState((s) => ({ usuario: { ...s.usuario, ...usuario } }))
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  useFiltrosStore.setState({ idPeriodo: PERIODO_VIGENTE.id_periodo })
  estado.resumen = { data: RESUMEN, isLoading: false, semanaActual: null }
  estado.actividad = { sesion: null, sinAsignaciones: false }
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Saludo', () => {
  it.each([
    [9, 'Buenos días'],
    [15, 'Buenas tardes'],
    [21, 'Buenas noches'],
  ])('a las %i h dice "%s" con el primer nombre', async (hora, saludo) => {
    montar({ hora })
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(`${saludo}, Rosa`)
  })

  it('sin `nombres` usa el primer nombre del nombre completo', async () => {
    montar({ usuario: { nombres: undefined, nombre_completo: 'Julio César Meléndez' } })
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Julio')
  })
})

describe('Periodo y actividad', () => {
  it('muestra el periodo vigente', async () => {
    montar()
    expect(await screen.findByText(`${PERIODO_VIGENTE.nombre} ${PERIODO_VIGENTE.anio}`)).toBeInTheDocument()
  })

  it('sin periodo elegido muestra un guion, no un texto vacío', async () => {
    useFiltrosStore.setState({ idPeriodo: null })
    montar()
    await waitFor(() => expect(screen.getByText('—')).toBeInTheDocument())
  })

  it('con actividad iniciada dice la hora de fin de la SESIÓN, la del token (CU010)', async () => {
    estado.actividad = { sesion: { inicio: '2026-10-10T14:00:00Z' }, sinAsignaciones: false }
    montar()
    // El JWT vence a las 16:00 UTC (11:00 en Lima), antes que inicio + 8 h.
    useSessionStore.setState({ token: jwtDePrueba({ exp: Date.UTC(2026, 9, 10, 16, 0, 0) / 1000 }) })
    expect(await screen.findByText(/La sesión finaliza a las 11:00/)).toBeInTheDocument()
    expect(screen.getByText(/Actividad iniciada a las 09:00/)).toBeInTheDocument()
  })

  it('con el token del mock, sin `exp`, calcula el fin desde el inicio de la actividad', async () => {
    estado.actividad = { sesion: { inicio: '2026-10-10T14:00:00Z' }, sinAsignaciones: false }
    montar()
    expect(await screen.findByText(/La sesión finaliza a las 17:00/)).toBeInTheDocument()
  })

  it('sin asignaciones explica por qué no puede iniciar una actividad', async () => {
    estado.actividad = { sesion: null, sinAsignaciones: true }
    montar()
    expect(await screen.findByText('No puede iniciar una actividad porque no tiene asignaciones activas.')).toBeInTheDocument()
  })
})

describe('Tarjetas del panel', () => {
  it('con el corte abierto y alumnos pendientes, invita a registrar (RN-010)', async () => {
    montar()
    expect(await screen.findByText('Evaluación diagnóstica de Octubre abierta')).toBeInTheDocument()
    expect(screen.getByText(/Lleva 20 de 48 estudiantes/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Registrar evaluación' })).toHaveAttribute('href', '/registro-vuelo/nuevo')
  })

  it('con el corte completo no insiste', async () => {
    estado.resumen.data = { ...RESUMEN, evaluacion_abierta: { nombre: 'Octubre', registrados: 48, total: 48 } }
    montar()
    await screen.findByText('Mis estudiantes')
    expect(screen.queryByText(/Evaluación diagnóstica de Octubre abierta/)).not.toBeInTheDocument()
  })

  it('pinta las cuatro cifras del resumen', async () => {
    montar()
    expect(await screen.findByText('48')).toBeInTheDocument()
    expect(screen.getByText('30 / 48')).toBeInTheDocument()
    expect(screen.getByText('Pendientes de rúbrica')).toBeInTheDocument()
    expect(screen.getByText('Ajustes por revisar')).toBeInTheDocument()
  })

  it('mientras carga no inventa cifras', async () => {
    estado.resumen = { data: undefined, isLoading: true, semanaActual: null }
    montar()
    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByText('Mis estudiantes')).not.toBeInTheDocument()
  })

  it('sin datos del servidor no pinta las tarjetas (D13)', async () => {
    estado.resumen = { data: undefined, isLoading: false, semanaActual: null }
    montar()
    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByText('Mis estudiantes')).not.toBeInTheDocument()
  })
})
