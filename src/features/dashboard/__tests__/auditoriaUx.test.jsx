// Auditoría de UX #737 en el Dashboard y el Inicio del Supervisor:
//   U09 — un solo aviso por subprograma cuando nadie está evaluado.
//   U10 — sin gráfica de línea con un solo año, y ejes con valores redondos.
//   U12 — los vencidos por módulo llevan a su pantalla.
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import BloqueResultados from '../BloqueResultados'
import BloqueEvolucion from '../BloqueEvolucion'
import { topeRedondo } from '../graficas/GraficaLineas'
import DesglosePorModulo from '../../inicio/DesglosePorModulo'
import { obtenerEvolucionAnual, obtenerResultadosAprendizaje } from '../../../api/resources/dashboard'
import { ToastProvider } from '../../../components/ui'

vi.mock('../../../api/resources/dashboard', async () => {
  const real = await vi.importActual('../../../api/resources/dashboard')
  return { ...real, obtenerResultadosAprendizaje: vi.fn(), obtenerEvolucionAnual: vi.fn() }
})

const ESPERA = { timeout: 8000 }
const FILTROS = { id_anio_escolar: 1 }

function montar(elemento) {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={cliente}>
      <ToastProvider>
        <MemoryRouter>{elemento}</MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

const vacia = (clave, pendientes) => ({ clave, nombre: clave, niveles: [], evaluados: 0, pendientes })

describe('U09 — Resultados de aprendizaje', () => {
  it('sin evaluados en ninguna dimensión, un solo aviso por subprograma', async () => {
    obtenerResultadosAprendizaje.mockResolvedValue({
      programas: [
        { id_programa: 1, nombre: 'Alfabetización', dimensiones: [vacia('global', 24), vacia('fluidez', 20), vacia('comprension', 24)] },
      ],
    })
    montar(<BloqueResultados filtros={FILTROS} contexto={[]} />)
    expect(await screen.findByText('24 alumnos pendientes de evaluar.', {}, ESPERA)).toBeInTheDocument()
    expect(screen.getAllByText('No hay evaluaciones completas para esta selección.')).toHaveLength(1)
  })

  it('con alguna dimensión evaluada, las vacías se dicen en una línea', async () => {
    obtenerResultadosAprendizaje.mockResolvedValue({
      programas: [
        {
          id_programa: 2,
          nombre: 'Comprensión Lectora',
          dimensiones: [
            { clave: 'fluidez', nombre: 'Fluidez', evaluados: 2, pendientes: 0, a_evaluar: 2, niveles: [{ nombre: 'Logrado', cantidad: 2, porcentaje: 100 }] },
            vacia('comprension', 1),
          ],
        },
      ],
    })
    montar(<BloqueResultados filtros={FILTROS} contexto={[]} />)
    expect(await screen.findByText(/1 alumno pendiente de evaluar\./, {}, ESPERA)).toBeInTheDocument()
    expect(screen.getByText('Logrado')).toBeInTheDocument()
  })
})

describe('U10 — Evolución anual', () => {
  const anio = (id, alumnos) => ({ id_anio_escolar: id, nombre: String(2024 + id), alumnos_atendidos: alumnos, colegios_atendidos: 3, libros: 10 })

  it('con un solo año no dibuja la línea: la cifra está en la tabla', async () => {
    obtenerEvolucionAnual.mockResolvedValue({ anios: [anio(1, 687)], mensaje: 'No hay información de otros años.' })
    montar(<BloqueEvolucion filtros={FILTROS} contexto={[]} conLibros />)
    expect(await screen.findByText('687', {}, ESPERA)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /descargar gráfica/i })).toBeNull()
    expect(screen.getAllByText('No hay información de otros años.')).toHaveLength(1)
  })

  it('con varios años sí la dibuja', async () => {
    obtenerEvolucionAnual.mockResolvedValue({ anios: [anio(1, 687), anio(2, 2747)] })
    montar(<BloqueEvolucion filtros={FILTROS} contexto={[]} conLibros />)
    expect(await screen.findAllByRole('button', { name: /descargar gráfica/i }, ESPERA)).toHaveLength(2)
  })

  it('el tope del eje es redondo y sus cuartos también', () => {
    expect(topeRedondo(2747)).toBe(3200)
    expect(topeRedondo(687)).toBe(800)
    expect(topeRedondo(100)).toBe(100)
    expect(topeRedondo(3)).toBe(4)
    expect(topeRedondo(Number.NaN)).toBe(4)
  })
})

describe('U12 — Vencidos por módulo', () => {
  it('un módulo con vencidos lleva a su pantalla; uno en cero no', () => {
    montar(<DesglosePorModulo titulo="Vencidos por módulo" desglose={{ asistencias: 3, rubrica: 0 }} />)
    expect(screen.getByRole('link', { name: /Asistencias/ })).toHaveAttribute('href', '/asistencia')
    expect(screen.queryByRole('link', { name: /Rúbrica/ })).toBeNull()
    expect(screen.getByText('Rúbrica')).toBeInTheDocument()
  })

  it('sin desglose del servidor no pinta nada', () => {
    const { container } = montar(<DesglosePorModulo titulo="Vencidos" desglose={null} />)
    expect(container).toBeEmptyDOMElement()
  })
})
