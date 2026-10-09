// CU017 y CU019 — Listado y detalle de las sesiones del Docente.
//
// Las reglas que se fijan aquí: estado y sincronización son columnas
// INDEPENDIENTES, una sesión en curso dice "No aplica" en vez de dejar huecos,
// y el módulo es estrictamente en línea.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { crearQueryClient } from '../../../App'
import { ToastProvider } from '../../../components/ui'
import SesionesPage from '../SesionesPage'

const ESPERA = { timeout: 8000 }

const listar = vi.fn()
const detalle = vi.fn()

vi.mock('../../../api/resources/actividades', async (importOriginal) => ({
  ...(await importOriginal()),
  listarActividades: (...a) => listar(...a),
  obtenerActividad: (...a) => detalle(...a),
}))

const pagina = (items) => ({ items, total: items.length, pagina: 1, paginas: 1, por_pagina: 10 })

const FINALIZADA = {
  id: 'a1',
  fecha: '2026-10-08',
  inicio: '2026-10-08T13:00:00Z',
  fin: '2026-10-08T17:30:00Z',
  duracion_segundos: 16200,
  estado: 'finalizada',
  tipo_cierre: 'Manual por finalización de actividad',
  sincronizacion: 'pendiente',
  cambios: 4,
}

function definirConexion(enLinea) {
  Object.defineProperty(window.navigator, 'onLine', { value: enLinea, configurable: true })
}

function montar({ sinReintentos = false } = {}) {
  const cliente = sinReintentos ? new QueryClient({ defaultOptions: { queries: { retry: false } } }) : crearQueryClient()
  return render(
    <QueryClientProvider client={cliente}>
      <ToastProvider>
        <SesionesPage />
      </ToastProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  definirConexion(true)
  localStorage.clear()
  listar.mockReset().mockResolvedValue(pagina([FINALIZADA]))
  detalle.mockReset()
})

describe('Listado de sesiones (CU017)', () => {
  it('estado y sincronización son columnas distintas', async () => {
    montar()
    await screen.findByText('4 h 30 min', {}, ESPERA)
    expect(screen.getAllByText('Finalizada').length).toBeGreaterThan(0)
    // Finalizada Y pendiente a la vez: el caso de uso lo exige explícitamente.
    expect(screen.getAllByText('Pendiente').length).toBeGreaterThan(0)
  })

  it('la duración se lee en horas y minutos, no en segundos', async () => {
    montar()
    expect(await screen.findByText('4 h 30 min', {}, ESPERA)).toBeInTheDocument()
  })

  it('una sesión en curso dice "No aplica" en fin y tipo de cierre', async () => {
    listar.mockResolvedValue(
      pagina([{ ...FINALIZADA, fin: null, tipo_cierre: null, estado: 'en_curso', duracion_segundos: 1800 }]),
    )
    montar()
    // Se espera a la DURACIÓN, no a "En curso": ese texto también es una
    // opción del filtro de estado y existe antes de que carguen los datos.
    expect(await screen.findByText('30 min', {}, ESPERA)).toBeInTheDocument()
    expect(screen.getAllByText('No aplica')).toHaveLength(2)
  })

  it('sin sesiones lo dice en vez de dejar la tabla muda', async () => {
    listar.mockResolvedValue(pagina([]))
    montar()
    expect(await screen.findByText('No existen sesiones para consultar', {}, ESPERA)).toBeInTheDocument()
  })

  it('un rango de fechas invertido no llega a consultarse', async () => {
    montar()
    await screen.findByText('Finalizada', {}, ESPERA)
    const llamadasAntes = listar.mock.calls.length

    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-10-20' } })
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-10-01' } })

    expect(screen.getByRole('button', { name: /^buscar$/i })).toBeDisabled()
    expect(listar.mock.calls.length).toBe(llamadasAntes)
  })

  it('sin conexión no consulta nada', async () => {
    definirConexion(false)
    montar()
    expect(await screen.findByText(/no disponible sin conexión/i, {}, ESPERA)).toBeInTheDocument()
    expect(listar).not.toHaveBeenCalled()
  })

  it('avisa si el servidor falla', async () => {
    listar.mockRejectedValue({ response: { status: 500, data: { detail: 'Se cayó' } } })
    montar({ sinReintentos: true })
    expect(await screen.findByText(/no se pudo obtener el historial/i, {}, ESPERA)).toBeInTheDocument()
  })
})

describe('Detalle de una sesión (CU019)', () => {
  it('agrupa los cambios por módulo con su desglose', async () => {
    detalle.mockResolvedValue({
      id: 'a1',
      fecha: '2026-10-08',
      inicio: '2026-10-08T13:00:00Z',
      fin: '2026-10-08T17:30:00Z',
      estado: 'finalizada',
      tipo_cierre: 'Manual por finalización de actividad',
      sincronizacion: 'sincronizada',
      registros_pendientes: 0,
      cambios: 4,
      cambios_por_modulo: [{ modulo: 'alumnos', total: 4, creados: 1, editados: 3, activados: 0, inactivados: 0 }],
      asignaciones: [{ colegio: { id: 1, nombre: 'I.E. 86021' }, grado: { id: 2, nombre: '2.º' }, ciclo: 'III' }],
    })

    montar()
    fireEvent.click(await screen.findByRole('button', { name: /ver detalle/i }, ESPERA))

    expect(await screen.findByText('Alumnos', {}, ESPERA)).toBeInTheDocument()
    expect(screen.getByText('Cambios por módulo')).toBeInTheDocument()
    expect(screen.getByText(/I.E. 86021/)).toBeInTheDocument()
  })

  it('una sesión sin cambios lo dice', async () => {
    detalle.mockResolvedValue({ id: 'a1', estado: 'finalizada', cambios_por_modulo: [] })
    montar()
    fireEvent.click(await screen.findByRole('button', { name: /ver detalle/i }, ESPERA))
    expect(await screen.findByText('Sin cambios en esta sesión', {}, ESPERA)).toBeInTheDocument()
  })
})
