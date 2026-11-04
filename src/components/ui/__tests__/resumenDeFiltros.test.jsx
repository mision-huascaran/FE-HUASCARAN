// Auditoría de UX #737, U18: en el celular, junto al botón «Filtros», una
// línea con lo que está filtrado.
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import FilterBar from '../FilterBar'
import Input from '../Input'
import Select from '../Select'
import resumenDeFiltros from '../resumenDeFiltros'

const filtros = (
  <>
    <Select label="Colegio" value="2" onChange={() => {}} options={[{ value: 1, label: 'Amashca' }, { value: 2, label: 'Ranrahirca' }]} />
    <Select label="Sección" value="" placeholder="Selecciona" onChange={() => {}} options={['Única']} />
    <Select label="Grado" value="3.º" onChange={() => {}} options={['3.º', '4.º']} />
    <Input label="Fecha" type="date" value="2026-11-03" onChange={() => {}} />
    <Input label="Buscar" value="Ana" onChange={() => {}} />
    texto suelto
  </>
)

describe('resumenDeFiltros', () => {
  it('nombra lo elegido en el orden de los filtros y salta lo vacío', () => {
    expect(resumenDeFiltros(filtros.props.children)).toBe('Ranrahirca · 3.º · 03/11')
  })

  it('un valor que no está entre las opciones no se inventa', () => {
    const hijos = <Select label="Colegio" value="9" onChange={() => {}} options={[{ value: 1, label: 'Amashca' }]} />
    expect(resumenDeFiltros(hijos)).toBe('')
  })
})

describe('FilterBar en el celular', () => {
  it('muestra el resumen junto al botón Filtros', () => {
    render(<FilterBar>{filtros.props.children}</FilterBar>)
    expect(screen.getByRole('button', { name: /filtros/i })).toBeInTheDocument()
    expect(screen.getByText('Ranrahirca · 3.º · 03/11')).toBeInTheDocument()
  })

  it('un resumen explícito manda sobre el deducido', () => {
    render(<FilterBar resumen="3.º Única · mar 03/11">{filtros.props.children}</FilterBar>)
    expect(screen.getByText('3.º Única · mar 03/11')).toBeInTheDocument()
  })
})
