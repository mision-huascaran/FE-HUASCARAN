// D012 del reporte de UX (11/11): al abrir un modal la tabla de atrás se
// corría el ancho de la barra de scroll.
import { afterEach, describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import useBloqueoScroll from '../useBloqueoScroll'

function simularBarra(ancho) {
  Object.defineProperty(document.documentElement, 'clientWidth', { value: 1440 - ancho, configurable: true })
  Object.defineProperty(window, 'innerWidth', { value: 1440, configurable: true })
}

afterEach(() => {
  delete document.documentElement.clientWidth
  document.body.style.overflow = ''
  document.body.style.paddingRight = ''
})

describe('useBloqueoScroll (D012)', () => {
  it('bloquea el scroll y compensa el ancho de la barra mientras está activo', () => {
    simularBarra(15)
    const { unmount } = renderHook(() => useBloqueoScroll(true))
    expect(document.body.style.overflow).toBe('hidden')
    expect(document.body.style.paddingRight).toBe('15px')

    unmount()
    expect(document.body.style.overflow).toBe('')
    expect(document.body.style.paddingRight).toBe('')
  })

  it('con barras superpuestas (sin ancho) no agrega relleno', () => {
    simularBarra(0)
    renderHook(() => useBloqueoScroll(true))
    expect(document.body.style.overflow).toBe('hidden')
    expect(document.body.style.paddingRight).toBe('')
  })

  it('inactivo no toca la página', () => {
    simularBarra(15)
    renderHook(() => useBloqueoScroll(false))
    expect(document.body.style.overflow).toBe('')
  })
})
