// El Dashboard en un teléfono.
//
// Lo que se sujeta aquí es lo que se rompe al tocar estilos sin abrir el móvil:
//
//   · la gráfica entra ENTERA, sin desplazamiento lateral, y para eso sus
//     letras se dibujan más grandes (si se encogieran con el SVG se leerían a
//     5 px, que fue justo la razón por la que antes se desplazaba);
//   · el enlace al módulo es un objetivo de 44 px y ocupa el ancho, porque se
//     pulsa con el pulgar;
//   · y nada de eso cambia en escritorio.
//
// `matchMedia` se simula a mano: jsdom lo tiene, pero siempre responde que no
// coincide, así que sin esto la versión móvil no se probaría nunca.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '../../../components/ui'
import Grafica from '../graficas/Grafica'
import GraficaBarras from '../graficas/GraficaBarras'
import TarjetaModulo from '../TarjetaModulo'

/** Pone el ancho de pantalla: `true` = teléfono (por debajo de `sm`). */
function pantalla(esMovil) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: esMovil && query.includes('max-width'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

const DATOS = [
  { nombre: 'Marzo', cantidad: 12 },
  { nombre: 'Abril', cantidad: 30 },
]

const montar = (ui) =>
  render(
    <ToastProvider>
      <MemoryRouter>{ui}</MemoryRouter>
    </ToastProvider>,
  )

/** El contenedor que, en escritorio, fuerza el ancho mínimo y el desplazamiento. */
const cajaDeLaGrafica = (contenedor) => contenedor.querySelector('.overflow-x-auto > div')

const tamanosDeLetra = (contenedor) =>
  [...contenedor.querySelectorAll('text')].map((t) => Number(t.getAttribute('font-size')))

afterEach(() => vi.restoreAllMocks())

describe('La gráfica en un teléfono', () => {
  it('entra entera: ni ancho mínimo ni desplazamiento lateral', () => {
    pantalla(true)
    const { container } = montar(
      <Grafica titulo="Libros por mes">
        <GraficaBarras datos={DATOS} campo="cantidad" />
      </Grafica>,
    )
    expect(cajaDeLaGrafica(container).className).not.toMatch(/min-w-/)
  })

  it('y sus letras se dibujan más grandes, para que al reducirse se lean', () => {
    pantalla(true)
    const { container: movil } = montar(
      <Grafica titulo="Libros por mes">
        <GraficaBarras datos={DATOS} campo="cantidad" />
      </Grafica>,
    )
    pantalla(false)
    const { container: escritorio } = montar(
      <Grafica titulo="Libros por mes">
        <GraficaBarras datos={DATOS} campo="cantidad" />
      </Grafica>,
    )

    expect(Math.min(...tamanosDeLetra(movil))).toBeGreaterThan(Math.min(...tamanosDeLetra(escritorio)))
  })

  it('el tamaño va en el ATRIBUTO, que es lo que sobrevive a la descarga a PNG', () => {
    pantalla(true)
    const { container } = montar(
      <Grafica titulo="Libros por mes">
        <GraficaBarras datos={DATOS} campo="cantidad" />
      </Grafica>,
    )
    // Si estuviera en una clase de CSS, el SVG serializado saldría sin tamaños.
    expect(tamanosDeLetra(container).every((n) => Number.isFinite(n))).toBe(true)
  })

  it('en escritorio se conserva el ancho mínimo de siempre', () => {
    pantalla(false)
    const { container } = montar(
      <Grafica titulo="Libros por mes">
        <GraficaBarras datos={DATOS} campo="cantidad" />
      </Grafica>,
    )
    expect(cajaDeLaGrafica(container).className).toMatch(/min-w-\[560px\]/)
  })
})

describe('El enlace al módulo en un teléfono', () => {
  it('ocupa el ancho y mide 44 px: se pulsa con el pulgar', () => {
    pantalla(true)
    montar(
      <TarjetaModulo
        titulo="Asistencias"
        consulta={{ data: {} }}
        cifra="92,0 %"
        enlace={{ a: '/asistencia', texto: 'Ver en Asistencias' }}
      />,
    )

    const enlace = screen.getByRole('link', { name: 'Ver en Asistencias' })
    expect(enlace.className).toMatch(/h-11/)
    expect(enlace.className).toMatch(/w-full/)
    // Y en pantalla ancha vuelve a ser un botón discreto al lado del título.
    expect(enlace.className).toMatch(/sm:h-9/)
    expect(enlace.className).toMatch(/sm:w-auto/)
  })
})
