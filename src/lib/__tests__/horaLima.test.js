// El backend manda los instantes en UTC con `Z` y exige mostrarlos en hora de
// Lima. Sin fijar la zona se usaría la del navegador, y las horas de esta
// aplicación son la prueba de cuándo se trabajó: no pueden depender de cómo
// tenga configurado el reloj quien mira.
import { describe, expect, it } from 'vitest'
import { fechaIsoLima, formatearFecha, formatearFechaHora, formatearHora } from '../format'

describe('Horas en zona de Lima', () => {
  it('convierte un instante UTC a hora de Lima (UTC-5)', () => {
    expect(formatearHora('2026-10-08T19:10:00Z')).toBe('14:10')
    expect(formatearFechaHora('2026-10-08T19:10:00Z')).toBe('08/10/2026 14:10')
  })

  it('cruza bien el cambio de día', () => {
    // Las 02:00 UTC del día 9 son todavía las 21:00 del día 8 en Lima.
    expect(formatearFechaHora('2026-10-09T02:00:00Z')).toBe('08/10/2026 21:00')
  })

  it('un día de calendario NO se convierte: ya es un día de Lima', () => {
    // Convertirlo lo movería al día anterior, que es el error clásico.
    expect(formatearFecha('2026-10-08')).toBe('08/10/2026')
  })

  it('sin valor no inventa una fecha', () => {
    expect(formatearFechaHora(null)).toBe('—')
    expect(formatearFecha(undefined)).toBe('—')
    expect(formatearHora('')).toBe('—')
  })

  it('la fecha AAAA-MM-DD de un instante es la de Lima, también de noche', () => {
    expect(fechaIsoLima('2026-10-08T13:00:00Z')).toBe('2026-10-08')
    // Las 02:00 UTC del día 9 son las 21:00 del día 8 en Lima: recortar el
    // texto daría el 9.
    expect(fechaIsoLima('2026-10-09T02:00:00Z')).toBe('2026-10-08')
    expect(fechaIsoLima('2026-10-08T23:59:00-05:00')).toBe('2026-10-08')
  })

  it('la fecha AAAA-MM-DD de un día de calendario no se convierte', () => {
    expect(fechaIsoLima('2026-10-08')).toBe('2026-10-08')
    expect(fechaIsoLima(null)).toBe('')
  })
})
