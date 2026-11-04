// Auditoría de UX #737, U05: un lado SIN MARCAR no puede verse igual que uno
// DESHABILITADO, o con la actividad iniciada el docente no sabe si ya puede
// marcar.
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import ControlSegmentado from '../ControlSegmentado'

const lado = (nombre) => screen.getByRole('button', { name: `${nombre}: Ana` })

describe('ControlSegmentado', () => {
  it('sin marcar y habilitado: texto oscuro, sin apagarse', () => {
    render(<ControlSegmentado valor={null} nombre="Ana" onElegir={vi.fn()} />)
    expect(lado('Presente').className).toContain('text-ink-700')
    expect(lado('Presente').className).not.toContain('opacity-')
  })

  it('deshabilitado: se apaga y no deja elegir', () => {
    const onElegir = vi.fn()
    render(<ControlSegmentado valor="presente" nombre="Ana" deshabilitado onElegir={onElegir} />)
    expect(lado('Ausente').className).toContain('opacity-50')
    expect(lado('Ausente').className).toContain('text-ink-400')
    // El lado elegido conserva su color, aunque atenuado.
    expect(lado('Presente').className).toContain('bg-success-100')
    expect(lado('Presente').className).toContain('opacity-60')
    fireEvent.click(lado('Ausente'))
    expect(onElegir).not.toHaveBeenCalled()
  })

  it('elegir otro lado avisa; volver a pulsar el elegido no hace nada', () => {
    const onElegir = vi.fn()
    render(<ControlSegmentado valor="presente" nombre="Ana" onElegir={onElegir} />)
    expect(lado('Presente')).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(lado('Presente'))
    expect(onElegir).not.toHaveBeenCalled()
    fireEvent.click(lado('Tardanza'))
    expect(onElegir).toHaveBeenCalledWith('tardanza')
  })
})
