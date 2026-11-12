// Las letras de las gráficas según el ancho real de su caja, y el eje redondo
// de las barras (N002 y N005 de la revisión de UX).
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import GraficaBarras from '../graficas/GraficaBarras'
import GraficaLineas from '../graficas/GraficaLineas'
import { factorDeLetra } from '../graficas/escala'

const MESES = ['Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const CANTIDADES = [null, null, null, null, null, 4553, 6510, 1185, null]
const LIBROS = MESES.map((nombre, i) => ({ nombre, anio: 2026, cantidad: CANTIDADES.at(i) }))

const textos = (contenedor) => [...contenedor.querySelectorAll('text')]
const letraDe = (contenedor, texto) => Number(textos(contenedor).find((t) => t.textContent === texto)?.getAttribute('font-size'))

describe('factorDeLetra', () => {
  it('agranda en una caja más angosta que el SVG y nunca achica en una más ancha', () => {
    expect(factorDeLetra({ anchoBase: 680, anchoVisible: 490 })).toBeCloseTo(680 / 490)
    expect(factorDeLetra({ anchoBase: 680, anchoVisible: 1070 })).toBe(1)
    expect(factorDeLetra({ anchoBase: 680, anchoVisible: 200 })).toBe(1.9)
  })

  it('sin medida (jsdom, primer pintado) usa el tamaño base, o el de teléfono si es compacto', () => {
    expect(factorDeLetra({ anchoBase: 680 })).toBe(1)
    expect(factorDeLetra({ anchoBase: 680, compacto: true })).toBe(1.9)
  })
})

describe('GraficaBarras en una tarjeta del Dashboard', () => {
  it('dibuja las letras más grandes que en una caja ancha, para que se lean a su tamaño', () => {
    const { container: tarjeta } = render(<GraficaBarras datos={LIBROS} anchoVisible={490} />)
    const { container: ancha } = render(<GraficaBarras datos={LIBROS} anchoVisible={1070} />)
    expect(letraDe(tarjeta, '6510')).toBeGreaterThan(letraDe(ancha, '6510'))
  })

  it('si los nombres no caben en su barra, se abrevian y se omite el año', () => {
    const { container } = render(<GraficaBarras datos={LIBROS} anchoVisible={490} />)
    const etiquetas = textos(container).map((t) => t.textContent)
    expect(etiquetas).toContain('Sep')
    expect(etiquetas).not.toContain('Septiembre')
    expect(etiquetas).not.toContain('2026')
  })

  it('en una caja ancha los meses van completos, con su año', () => {
    const { container } = render(<GraficaBarras datos={LIBROS} anchoVisible={1070} />)
    const etiquetas = textos(container).map((t) => t.textContent)
    expect(etiquetas).toContain('Septiembre')
    expect(etiquetas).toContain('2026')
  })

  it('el eje marca números redondos, no cuartos del máximo', () => {
    const { container } = render(<GraficaBarras datos={LIBROS} />)
    const eje = textos(container)
      .filter((t) => t.getAttribute('text-anchor') === 'end')
      .map((t) => t.textContent)
    expect(eje).toEqual(['0', '2000', '4000', '6000', '8000'])
  })
})

describe('GraficaLineas en una tarjeta del Dashboard', () => {
  it('también agranda sus letras, y el margen derecho crece con ellas', () => {
    const datos = [
      { nombre: 'Octubre', porcentaje: 85 },
      { nombre: 'Noviembre', porcentaje: 79.7 },
      { nombre: 'Diciembre', porcentaje: null },
    ]
    const { container: tarjeta } = render(<GraficaLineas datos={datos} maximo={100} anchoVisible={490} />)
    const { container: ancha } = render(<GraficaLineas datos={datos} maximo={100} anchoVisible={1070} />)
    expect(letraDe(tarjeta, 'Diciembre')).toBeGreaterThan(letraDe(ancha, 'Diciembre'))

    const ultimo = textos(tarjeta).find((t) => t.textContent === 'Diciembre')
    const mitad = (letraDe(tarjeta, 'Diciembre') * 0.58 * 'Diciembre'.length) / 2
    expect(Number(ultimo.getAttribute('x')) + mitad).toBeLessThanOrEqual(680)
  })
})
