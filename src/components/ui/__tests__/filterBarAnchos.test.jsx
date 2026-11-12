// N006 — La barra de filtros de Asistencias, Lectura, Rúbrica y Registro de
// Vuelo da a cada filtro el ancho de su contenido, como la de los
// mantenimientos (D007), en vez de cuatro columnas iguales.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import FilterBar from '../FilterBar'
import Select from '../Select'

const OPCIONES = [{ value: '1', label: 'Uno' }]

function escritorio(sí) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: sí && query.includes('min-width'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

const barra = () => (
  <FilterBar>
    {[
      <Select key="colegio" ancho="largo" label="Colegio" value="" onChange={() => {}} options={OPCIONES} />,
      <Select key="grado" ancho="corto" label="Grado" value="" onChange={() => {}} options={OPCIONES} />,
    ]}
    <Select label="Semana" value="" onChange={() => {}} options={OPCIONES} />
  </FilterBar>
)

afterEach(() => vi.restoreAllMocks())

describe('FilterBar en escritorio (N006)', () => {
  it('cada filtro va en una celda de su ancho, y sin pedirlo es «normal»', () => {
    escritorio(true)
    render(barra())
    const celda = (etiqueta) => screen.getByLabelText(etiqueta).closest('.flex-1')
    expect(celda('Colegio').className).toMatch(/basis-\[230px\]/)
    expect(celda('Grado').className).toMatch(/basis-\[140px\]/)
    expect(celda('Semana').className).toMatch(/basis-\[170px\]/)
  })

  it('ya no es una rejilla de columnas iguales', () => {
    escritorio(true)
    const { container } = render(barra())
    expect(container.querySelector('[class*="grid-cols-"]')).toBeNull()
  })

  it('el ancho no llega al DOM como atributo, ni en escritorio ni en el panel del celular', () => {
    escritorio(true)
    const { container, unmount } = render(barra())
    expect(container.querySelector('[ancho]')).toBeNull()
    unmount()
    escritorio(false)
    render(barra())
    expect(document.querySelector('[ancho]')).toBeNull()
  })
})
