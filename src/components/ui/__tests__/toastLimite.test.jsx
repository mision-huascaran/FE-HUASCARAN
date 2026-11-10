// Tope de avisos a la vez (BUG 6 del reporte de QA del 09/11/2026): una
// ráfaga de errores no debe apilar más de 8 avisos en pantalla.
import { describe, expect, it } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { ToastProvider, useToast } from '../Toast'

function Disparador({ cuantos }) {
  const toast = useToast()
  return (
    <button type="button" onClick={() => Array.from({ length: cuantos }).forEach((_, i) => toast.error(`Aviso ${i + 1}`))}>
      Disparar
    </button>
  )
}

describe('ToastProvider — tope de avisos', () => {
  it('con una ráfaga de 12 solo deja los 8 más nuevos', async () => {
    render(
      <ToastProvider>
        <Disparador cuantos={12} />
      </ToastProvider>,
    )

    act(() => screen.getByRole('button', { name: 'Disparar' }).click())

    const avisos = screen.getAllByRole('status')
    expect(avisos).toHaveLength(8)
    expect(screen.getByText('Aviso 12')).toBeInTheDocument()
    expect(screen.queryByText('Aviso 4')).not.toBeInTheDocument()
  })
})
