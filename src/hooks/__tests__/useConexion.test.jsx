// La conexión se recupera aunque el evento `online` se haya perdido.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import useConexion, { REVISAR_SIN_CONEXION_MS } from '../useConexion'

const fijarRed = (valor) => Object.defineProperty(window.navigator, 'onLine', { value: valor, configurable: true })

afterEach(() => {
  vi.useRealTimers()
  fijarRed(true)
})

describe('useConexion', () => {
  it('sigue los eventos online y offline', () => {
    const { result } = renderHook(() => useConexion())
    act(() => {
      fijarRed(false)
      window.dispatchEvent(new Event('offline'))
    })
    expect(result.current).toBe(false)
    act(() => {
      fijarRed(true)
      window.dispatchEvent(new Event('online'))
    })
    expect(result.current).toBe(true)
  })

  it.each([
    ['volver a la ventana', () => window.dispatchEvent(new Event('focus'))],
    ['volver a la pestaña', () => document.dispatchEvent(new Event('visibilitychange'))],
    ['restaurar la página', () => window.dispatchEvent(new Event('pageshow'))],
  ])('sin el evento online, se entera al %s', (_caso, disparar) => {
    const { result } = renderHook(() => useConexion())
    act(() => {
      fijarRed(false)
      window.dispatchEvent(new Event('offline'))
    })
    // Volvió la red, pero el aviso se perdió (pestaña congelada, equipo suspendido).
    fijarRed(true)
    expect(result.current).toBe(false)

    act(disparar)
    expect(result.current).toBe(true)
  })

  it('sin ningún evento, mientras está sin conexión vuelve a mirar cada pocos segundos', () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    const { result } = renderHook(() => useConexion())
    act(() => {
      fijarRed(false)
      window.dispatchEvent(new Event('offline'))
    })
    fijarRed(true)
    expect(result.current).toBe(false)

    act(() => vi.advanceTimersByTime(REVISAR_SIN_CONEXION_MS))
    expect(result.current).toBe(true)
  })
})
