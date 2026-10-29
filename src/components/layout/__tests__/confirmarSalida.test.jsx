// D62 — CP09, CP20. El aviso de salir con pendientes decía "Quedan 1 cambio
// guardado… que todavía no llegaron" y trataba de usted.
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ConfirmarSalida from '../ConfirmarSalida'

const montar = (pendientes) =>
  render(<ConfirmarSalida abierto pendientes={pendientes} onSalir={vi.fn()} onCerrar={vi.fn()} />)

describe('Salir con cambios sin sincronizar (D62)', () => {
  it('con UN cambio, todo en singular', () => {
    montar(1)
    const dialogo = screen.getByRole('dialog')
    expect(dialogo).toHaveTextContent('Queda 1 cambio guardado en este dispositivo que todavía no llegó al servidor.')
    expect(dialogo).toHaveTextContent('Tienes cambios sin sincronizar')
  })

  it('con varios, todo en plural y tuteando', () => {
    montar(3)
    const dialogo = screen.getByRole('dialog')
    expect(dialogo).toHaveTextContent('Quedan 3 cambios guardados en este dispositivo que todavía no llegaron al servidor.')
    expect(dialogo).toHaveTextContent('la próxima vez que inicies sesión')
  })
})
