// Auditoría de UX #737: lo que queda en pie tras rearmar el Dashboard.
//
//   U10 — los ejes de las gráficas llevan valores redondos.
//   U12 — los vencidos por módulo llevan a su pantalla.
//
// U09 ("un solo aviso por subprograma cuando nadie está evaluado") y la parte
// de U10 que comprobaba la gráfica de un solo año se fueron con
// `BloqueResultados` y `BloqueEvolucion`: el Dashboard ya no tiene bloques por
// indicador, sino una tarjeta por módulo. Lo que esas dos pruebas sujetaban
// —no repetir el mismo aviso y no dibujar una línea de un punto— vive ahora en
// `TarjetaRubrica` y `TarjetaVuelo`, y está cubierto en `dashboard.test.jsx`.
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { topeRedondo } from '../graficas/GraficaLineas'
import DesglosePorModulo from '../../inicio/DesglosePorModulo'
import { ToastProvider } from '../../../components/ui'

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

describe('U10 — Evolución anual', () => {
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
    montar(<DesglosePorModulo vencidos={{ asistencias: 3, rubrica: 0 }} incompletos={null} />)
    expect(screen.getByRole('link', { name: /Vencidos en Asistencias: 3/ })).toHaveAttribute('href', '/asistencia')
    expect(screen.queryByRole('link', { name: /Rúbrica/ })).toBeNull()
    expect(screen.getByRole('columnheader', { name: 'Rúbrica' })).toBeInTheDocument()
  })

  it('sin desglose del servidor no pinta nada', () => {
    const { container } = montar(<DesglosePorModulo vencidos={null} incompletos={null} />)
    expect(container).toBeEmptyDOMElement()
  })
})
