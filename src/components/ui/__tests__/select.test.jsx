// El Select común: la indicación «Selecciona» no es una opción, el vacío que
// sí significa algo («Todos») se puede elegir, y un filtro encadenado sin el
// anterior dice qué falta en vez de abrirse en blanco.
import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Select from '../Select'

const GRADOS = [
  { value: '1', label: '1.° grado' },
  { value: '2', label: '2.° grado' },
]

/** Las opciones que una persona puede ver y elegir en la lista abierta. */
const elegibles = (select) =>
  within(select)
    .queryAllByRole('option')
    .filter((o) => !o.disabled)
    .map((o) => o.textContent)

describe('Select', () => {
  it('sin nada elegido muestra «Selecciona», pero no como opción', () => {
    render(<Select label="Grado" value="" placeholder="Selecciona" onChange={() => {}} options={GRADOS} />)
    const select = screen.getByLabelText('Grado')

    expect(select).toHaveDisplayValue('Selecciona')
    expect(elegibles(select)).toEqual(['1.° grado', '2.° grado'])
  })

  it('con un grado elegido, «Selecciona» no aparece en la lista', () => {
    render(<Select label="Grado" value="2" placeholder="Selecciona" onChange={() => {}} options={GRADOS} />)
    const select = screen.getByLabelText('Grado')

    expect(select).toHaveDisplayValue('2.° grado')
    expect(elegibles(select)).toEqual(['1.° grado', '2.° grado'])
  })

  it('sin `value` arranca en la indicación, no en la primera opción', () => {
    render(<Select label="Grado" placeholder="Selecciona" options={GRADOS} />)
    expect(screen.getByLabelText('Grado')).toHaveDisplayValue('Selecciona')
  })

  it('con `vacioElegible` el vacío es una opción de verdad («Todos»)', async () => {
    const alCambiar = vi.fn()
    render(
      <Select
        label="Subprograma"
        value="1"
        placeholder="Todos"
        vacioElegible
        onChange={(e) => alCambiar(e.target.value)}
        options={GRADOS}
      />,
    )
    const select = screen.getByLabelText('Subprograma')

    expect(elegibles(select)).toEqual(['Todos', '1.° grado', '2.° grado'])
    await userEvent.selectOptions(select, 'Todos')
    expect(alCambiar).toHaveBeenCalledWith('')
  })

  it('un filtro encadenado sin el anterior queda deshabilitado y dice qué falta', () => {
    render(
      <Select label="Grado" value="" placeholder="Selecciona" pendienteDe="colegio" onChange={() => {}} options={GRADOS} />,
    )
    const select = screen.getByLabelText('Grado')

    expect(select).toBeDisabled()
    expect(select).toHaveDisplayValue('Elige un colegio')
    // Corto para que quepa en la celda angosta; la frase entera, al pasar el mouse.
    expect(select).toHaveAttribute('title', 'Primero selecciona un colegio')
    expect(within(select).getAllByRole('option')).toHaveLength(1)
  })

  it('al elegir el anterior se habilita y muestra «Selecciona»', () => {
    const { rerender } = render(
      <Select label="Sección" value="" placeholder="Selecciona" pendienteDe="grado" onChange={() => {}} options={[]} />,
    )
    expect(screen.getByLabelText('Sección')).toHaveDisplayValue('Elige un grado')

    rerender(<Select label="Sección" value="" placeholder="Selecciona" pendienteDe={false} onChange={() => {}} options={GRADOS} />)
    const select = screen.getByLabelText('Sección')
    expect(select).toBeEnabled()
    expect(select).toHaveDisplayValue('Selecciona')
  })
})
