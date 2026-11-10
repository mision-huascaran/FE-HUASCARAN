// El Select común: un filtro encadenado sin el anterior dice qué falta en vez
// de abrirse en blanco.
import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import Select from '../Select'

const GRADOS = [
  { value: '1', label: '1.° grado' },
  { value: '2', label: '2.° grado' },
]

describe('Select', () => {
  it('un filtro encadenado sin el anterior queda deshabilitado y dice qué falta', () => {
    render(
      <Select label="Grado" value="" placeholder="Selecciona" pendienteDe="colegio" onChange={() => {}} options={GRADOS} />,
    )
    const select = screen.getByLabelText('Grado')

    expect(select).toBeDisabled()
    expect(select).toHaveDisplayValue('Primero selecciona un colegio')
    expect(within(select).getAllByRole('option')).toHaveLength(1)
  })
  it('al elegir el anterior se habilita y muestra «Selecciona»', () => {
    const { rerender } = render(
      <Select label="Sección" value="" placeholder="Selecciona" pendienteDe="grado" onChange={() => {}} options={[]} />,
    )
    expect(screen.getByLabelText('Sección')).toHaveDisplayValue('Primero selecciona un grado')

    rerender(<Select label="Sección" value="" placeholder="Selecciona" pendienteDe={false} onChange={() => {}} options={GRADOS} />)
    const select = screen.getByLabelText('Sección')
    expect(select).toBeEnabled()
    expect(select).toHaveDisplayValue('Selecciona')
  })
})
