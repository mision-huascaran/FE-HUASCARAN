// D010 del reporte de UX (11/11): el cambio de tema se notaba trabado con
// tablas grandes porque animaba el color de cada elemento. Ahora es un solo
// fundido de la página (View Transitions) o, si no se puede, instantáneo.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import useTema from '../useTema'

afterEach(() => {
  delete document.startViewTransition
  document.documentElement.classList.remove('dark')
})

describe('useTema — cambio de tema (D010)', () => {
  it('con View Transitions, el cambio de clase va dentro de un solo fundido', () => {
    document.startViewTransition = vi.fn((cambiar) => cambiar())
    const { result } = renderHook(() => useTema())

    act(() => result.current.alternar())

    expect(document.startViewTransition).toHaveBeenCalledTimes(1)
    // Y ya no se marca cada elemento para animar su color.
    expect(document.documentElement.classList.contains('sicedu-tema-transicion')).toBe(false)
  })

  it('sin View Transitions, el tema cambia al instante', () => {
    const { result } = renderHook(() => useTema())
    const antes = result.current.preferencia

    act(() => result.current.alternar())

    expect(result.current.preferencia).not.toBe(antes)
    expect(document.documentElement.classList.contains('sicedu-tema-transicion')).toBe(false)
  })

  it('el oscuro pone .dark en <html>', () => {
    const { result } = renderHook(() => useTema())
    // claro → oscuro → sistema: se avanza (al menos una vez) hasta 'oscuro'.
    for (let i = 0; i < 3; i++) {
      act(() => result.current.alternar())
      if (result.current.preferencia === 'oscuro') break
    }

    expect(result.current.preferencia).toBe('oscuro')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })
})
