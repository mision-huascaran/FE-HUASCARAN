// Sesiones mostraba "7 h 60 min" para una actividad de 12:45 a 20:45 que el
// servidor midió en 7 h 59 min y pico (revisión del reporte de UX, 11/11).
import { describe, expect, it } from 'vitest'
import { duracion } from '../SesionesPage'

describe('duracion de una sesión', () => {
  it('nunca muestra 60 minutos: los redondea a la hora siguiente', () => {
    expect(duracion(8 * 3600 - 20)).toBe('8 h 0 min')
    expect(duracion(3600 + 59 * 60 + 45)).toBe('2 h 0 min')
  })

  it('casos normales', () => {
    expect(duracion(4 * 3600)).toBe('4 h 0 min')
    expect(duracion(3600 + 25 * 60)).toBe('1 h 25 min')
    expect(duracion(25 * 60 + 20)).toBe('25 min')
    expect(duracion(59 * 60 + 40)).toBe('1 h 0 min')
  })

  it('sin dato, guion', () => {
    expect(duracion(null)).toBe('—')
    expect(duracion(undefined)).toBe('—')
  })
})
