// D012 del reporte de UX (11/11): el DNI aceptaba cualquier largo y letras, y
// el modal no avisaba que al cambiar de grupo se pide una fecha.
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import CampoMantenimiento from '../CampoMantenimiento'

const DNI = { nombre: 'dni', etiqueta: 'DNI', maximo: 8, inputMode: 'numeric', soloDigitos: true }

describe('Campo DNI del alumno (D012)', () => {
  it('no deja escribir más de 8 caracteres y abre el teclado numérico', () => {
    render(<CampoMantenimiento campo={DNI} valor="" onCambio={() => {}} modo="editar" />)
    const input = screen.getByLabelText('DNI')
    expect(input).toHaveAttribute('maxLength', '8')
    expect(input).toHaveAttribute('inputMode', 'numeric')
  })

  it('descarta lo que no sea número al escribir o pegar', () => {
    const onCambio = vi.fn()
    render(<CampoMantenimiento campo={DNI} valor="" onCambio={onCambio} modo="editar" />)
    fireEvent.change(screen.getByLabelText('DNI'), { target: { value: '12a34-567 8' } })
    expect(onCambio).toHaveBeenCalledWith('dni', '12345678')
  })

  it('un campo de texto sin esas opciones no cambia de comportamiento', () => {
    const onCambio = vi.fn()
    render(<CampoMantenimiento campo={{ nombre: 'nombres', etiqueta: 'Nombres' }} valor="" onCambio={onCambio} modo="editar" />)
    const input = screen.getByLabelText('Nombres')
    expect(input).not.toHaveAttribute('maxLength')
    fireEvent.change(input, { target: { value: 'Ana 2' } })
    expect(onCambio).toHaveBeenCalledWith('nombres', 'Ana 2')
  })
})
