// Tope de avisos a la vez (BUG 6 del reporte de QA del 09/11/2026): una
// ráfaga de errores no debe apilar más de 8 avisos en pantalla.
import { describe, expect, it, vi } from 'vitest'
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

/** D009 del reporte de UX (11/11): spam de avisos al iniciar y finalizar. */
describe('ToastProvider — avisos que no se apilan (D009)', () => {
  function Botones() {
    const toast = useToast()
    return (
      <>
        <button type="button" onClick={() => toast.success('Actividad iniciada', 'Ya puedes registrar.', { clave: 'actividad' })}>
          Iniciar
        </button>
        <button type="button" onClick={() => toast.success('Actividad finalizada', undefined, { clave: 'actividad' })}>
          Finalizar
        </button>
        <button type="button" onClick={() => toast.error('Sin conexión')}>Error</button>
      </>
    )
  }

  it('los avisos con la misma clave se reemplazan: queda solo el último', () => {
    render(
      <ToastProvider>
        <Botones />
      </ToastProvider>,
    )
    for (let i = 0; i < 3; i++) {
      act(() => screen.getByRole('button', { name: 'Iniciar' }).click())
      act(() => screen.getByRole('button', { name: 'Finalizar' }).click())
    }
    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(screen.getByText('Actividad finalizada')).toBeInTheDocument()
  })

  it('un aviso idéntico al que ya se ve no se repite', () => {
    render(
      <ToastProvider>
        <Botones />
      </ToastProvider>,
    )
    act(() => screen.getByRole('button', { name: 'Error' }).click())
    act(() => screen.getByRole('button', { name: 'Error' }).click())
    expect(screen.getAllByRole('status')).toHaveLength(1)
  })

  it('un aviso nuevo no reinicia el tiempo de los que ya estaban', () => {
    vi.useFakeTimers()
    try {
      render(
        <ToastProvider>
          <Botones />
        </ToastProvider>,
      )
      act(() => screen.getByRole('button', { name: 'Error' }).click())
      act(() => vi.advanceTimersByTime(3000))
      act(() => screen.getByRole('button', { name: 'Iniciar' }).click())
      act(() => vi.advanceTimersByTime(1500))
      // El primero ya cumplió sus 4 s; el segundo lleva 1,5 s.
      expect(screen.queryByText('Sin conexión')).not.toBeInTheDocument()
      expect(screen.getByText('Actividad iniciada')).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
})
