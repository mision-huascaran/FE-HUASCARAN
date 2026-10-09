// CU020 y CU021 — Seguimiento del equipo de docentes.
//
// Lo que se fija aquí son las reglas del caso de uso que es fácil romper sin
// darse cuenta: que el orden lo manda el servidor, que "nunca conectado" se
// diga con palabras, que los atajos NO lleven a ningún sitio mientras las
// grillas no existan, y que sin conexión no se tire de la memoria local.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { QueryClient } from '@tanstack/react-query'
import { crearQueryClient } from '../../../App'
import { ToastProvider } from '../../../components/ui'
import SeguimientoPage from '../SeguimientoPage'

const ESPERA = { timeout: 8000 }

const listar = vi.fn()
const actividadesDe = vi.fn()

vi.mock('../../../api/resources/seguimiento', () => ({
  listarSeguimiento: (...a) => listar(...a),
  listarActividadesDe: (...a) => actividadesDe(...a),
  obtenerDocenteSeguimiento: vi.fn(),
}))

vi.mock('../../../api/resources/administracion', async (importOriginal) => ({
  ...(await importOriginal()),
  listarColegiosAdmin: async () => ({ items: [{ id_colegio: 1, nombre: 'I.E. 86021 Ranrahirca' }] }),
}))

const FILA = {
  id_docente: 7,
  nombres: 'Rosa',
  apellidos: 'Camones',
  activo: true,
  colegios: [{ id: 1, nombre: 'I.E. 86021 Ranrahirca' }, { id: 2, nombre: 'I.E. 86024 Mancos' }],
  ultima_conexion: null,
  sincronizacion: 'pendiente',
  registros_pendientes: 3,
}

const pagina = (items) => ({ items, total: items.length, pagina: 1, paginas: 1, por_pagina: 10 })

function definirConexion(enLinea) {
  Object.defineProperty(window.navigator, 'onLine', { value: enLinea, configurable: true })
}

function montar({ sinReintentos = false } = {}) {
  // El cliente real reintenta 3 veces con espera creciente. Para el caso de
  // error eso haría que el test agotara su tiempo esperando reintentos.
  const cliente = sinReintentos
    ? new QueryClient({ defaultOptions: { queries: { retry: false } } })
    : crearQueryClient()

  return render(
    <QueryClientProvider client={cliente}>
      <ToastProvider>
        <SeguimientoPage />
      </ToastProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  definirConexion(true)
  listar.mockReset().mockResolvedValue(pagina([FILA]))
  actividadesDe.mockReset().mockResolvedValue(pagina([]))
})

describe('Seguimiento de docentes (CU020)', () => {
  it('muestra las columnas del caso de uso y une los colegios con comas', async () => {
    montar()
    expect(await screen.findByText('Rosa Camones', {}, ESPERA)).toBeInTheDocument()
    expect(screen.getByText('I.E. 86021 Ranrahirca, I.E. 86024 Mancos')).toBeInTheDocument()
    // "Pendiente" sale también como opción del filtro: basta con que esté.
    expect(screen.getAllByText('Pendiente').length).toBeGreaterThan(0)
  })

  it('quien nunca entró lo dice con palabras, no con una celda vacía', async () => {
    montar()
    expect(await screen.findByText('Nunca', {}, ESPERA)).toBeInTheDocument()
  })

  it('los filtros viajan al servidor, no se aplican en el cliente', async () => {
    montar()
    await screen.findByText('Rosa Camones', {}, ESPERA)

    fireEvent.change(screen.getByLabelText('Sincronización'), { target: { value: 'pendiente' } })
    await waitFor(
      () => expect(listar).toHaveBeenCalledWith(expect.objectContaining({ sincronizacion: 'pendiente' })),
      ESPERA,
    )
  })

  it('sin conexión no consulta nada y lo explica', async () => {
    definirConexion(false)
    montar()

    expect(await screen.findByText(/no disponible sin conexión/i, {}, ESPERA)).toBeInTheDocument()
    expect(listar).not.toHaveBeenCalled()
  })

  it('avisa si el servidor falla, en vez de quedarse en blanco', async () => {
    listar.mockRejectedValue({ response: { status: 500, data: { detail: 'Se cayó' } } })
    montar({ sinReintentos: true })
    expect(await screen.findByText('No se pudo cargar el seguimiento', {}, ESPERA)).toBeInTheDocument()
  })
})

describe('Bitácora de un docente (CU021)', () => {
  async function abrirDetalle() {
    montar()
    fireEvent.click(await screen.findByRole('button', { name: /ver detalle/i }, ESPERA))
  }

  it('abre el detalle ocultando la grilla general', async () => {
    await abrirDetalle()
    expect(await screen.findByRole('button', { name: /volver al seguimiento/i }, ESPERA)).toBeInTheDocument()
    expect(screen.queryByLabelText('Sincronización')).not.toBeInTheDocument()
  })

  it('la cabecera lleva avatar de iniciales y las etiquetas del docente', async () => {
    await abrirDetalle()
    await screen.findByRole('button', { name: /volver al seguimiento/i }, ESPERA)
    expect(screen.getByText('RC')).toBeInTheDocument()
    expect(screen.getByText('I.E. 86024 Mancos')).toBeInTheDocument()
  })

  it('sin sesiones lo dice, en vez de una tabla vacía sin explicación', async () => {
    await abrirDetalle()
    expect(await screen.findByText('Sin sesiones registradas', {}, ESPERA)).toBeInTheDocument()
  })

  it('los atajos están deshabilitados mientras las grillas no existan', async () => {
    actividadesDe.mockResolvedValue(
      pagina([
        {
          id: 'a1',
          fecha: '2026-10-08',
          inicio: '2026-10-08T13:00:00Z',
          fin: null,
          tipo_cierre: null,
          productividad: [{ modulo: 'alumnos', cantidad: 3 }],
          productividad_texto: '3 Alumnos',
        },
      ]),
    )
    await abrirDetalle()

    const atajo = await screen.findByRole('button', { name: /ver alumnos/i }, ESPERA)
    // Llevar a una pantalla que no existe parecería un error de la aplicación.
    expect(atajo).toBeDisabled()
    // Una sesión en curso dice "No aplica" en fin Y en tipo de cierre: son dos.
    expect(screen.getAllByText('No aplica')).toHaveLength(2)
  })

  it('se puede volver a la grilla general', async () => {
    await abrirDetalle()
    fireEvent.click(await screen.findByRole('button', { name: /volver al seguimiento/i }, ESPERA))
    expect(await screen.findByText('Rosa Camones', {}, ESPERA)).toBeInTheDocument()
  })
})
