// CU018 — Los filtros se conservan entre visitas y un rango invertido no se
// envía: el backend respondería 422 `rango_fechas_invalido`, pero gastar una
// petición para que te diga lo que ya se sabe es peor experiencia.
import { beforeEach, describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import useFiltrosSesiones from '../useFiltrosSesiones'

beforeEach(() => localStorage.clear())

describe('Filtros del Módulo de Sesiones (CU018)', () => {
  it('detecta el rango invertido sin llamar al servidor', () => {
    const { result } = renderHook(() => useFiltrosSesiones())

    act(() => result.current.cambiar('desde', '2026-10-10'))
    act(() => result.current.cambiar('hasta', '2026-10-01'))
    expect(result.current.rangoInvalido).toBe(true)

    act(() => result.current.cambiar('hasta', '2026-10-20'))
    expect(result.current.rangoInvalido).toBe(false)
  })

  it('una sola fecha no es un rango invertido', () => {
    const { result } = renderHook(() => useFiltrosSesiones())
    act(() => result.current.cambiar('desde', '2026-10-10'))
    expect(result.current.rangoInvalido).toBe(false)
  })

  it('conserva los filtros entre visitas al módulo', () => {
    const { result, unmount } = renderHook(() => useFiltrosSesiones())
    act(() => result.current.cambiar('estado', 'finalizada'))
    unmount()

    const segunda = renderHook(() => useFiltrosSesiones())
    expect(segunda.result.current.filtros.estado).toBe('finalizada')
  })

  it('"Limpiar filtros" los borra también de localStorage', () => {
    const { result } = renderHook(() => useFiltrosSesiones())
    act(() => result.current.cambiar('estado', 'en_curso'))
    act(() => result.current.limpiar())

    expect(result.current.filtros.estado).toBe('')
    expect(localStorage.getItem('sicedu.filtros.sesiones')).toBeNull()
  })

  it('unos filtros guardados por una versión anterior no dejan campos sin definir', () => {
    localStorage.setItem('sicedu.filtros.sesiones', JSON.stringify({ estado: 'finalizada' }))
    const { result } = renderHook(() => useFiltrosSesiones())

    // Si quedara `undefined`, React trataría el select como no controlado.
    expect(result.current.filtros.sincronizacion).toBe('')
    expect(result.current.filtros.tipo_cierre).toBe('')
  })
})
