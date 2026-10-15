// Selección múltiple del popup de mantenimiento (grados de un docente).
//
// Antes era un <select multiple> nativo: había que mantener Ctrl para elegir
// varios y un clic suelto borraba lo anterior. Ahora son recuadros con casilla.
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import CampoMantenimiento from '../CampoMantenimiento'

const GRADOS = {
  nombre: 'grados',
  etiqueta: 'Grados',
  tipo: 'multiple',
  opciones: ['1.º', '2.º', '3.º', '4.º', '5.º', '6.º'].map((label, i) => ({ value: String(i + 1), label })),
}

function montar(valor = [], modo = 'editar') {
  const onCambio = vi.fn()
  render(<CampoMantenimiento campo={GRADOS} valor={valor} onCambio={onCambio} modo={modo} />)
  return onCambio
}

describe('Selección múltiple como recuadros', () => {
  it('pinta una casilla por opción, con las elegidas marcadas', () => {
    montar(['3', '4'])
    expect(screen.getAllByRole('checkbox')).toHaveLength(6)
    expect(screen.getByRole('checkbox', { name: '3.º' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: '1.º' })).not.toBeChecked()
  })

  it('un clic AÑADE a la selección, sin borrar lo anterior, y conserva el orden', () => {
    const onCambio = montar(['4'])
    fireEvent.click(screen.getByRole('checkbox', { name: '1.º' }))
    expect(onCambio).toHaveBeenCalledWith('grados', ['1', '4'])
  })

  it('un clic sobre uno marcado lo quita', () => {
    const onCambio = montar(['1', '4'])
    fireEvent.click(screen.getByRole('checkbox', { name: '4.º' }))
    expect(onCambio).toHaveBeenCalledWith('grados', ['1'])
  })

  it('"Marcar todos" y "Quitar todos"', () => {
    const onCambio = montar(['2'])
    fireEvent.click(screen.getByRole('button', { name: 'Marcar todos' }))
    expect(onCambio).toHaveBeenCalledWith('grados', ['1', '2', '3', '4', '5', '6'])
  })

  it('en modo "ver" no se puede cambiar nada', () => {
    montar(['1'], 'ver')
    screen.getAllByRole('checkbox').forEach((casilla) => expect(casilla).toBeDisabled())
    expect(screen.queryByRole('button', { name: /todos/i })).not.toBeInTheDocument()
  })
})
