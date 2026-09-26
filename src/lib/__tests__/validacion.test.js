import { describe, expect, it } from 'vitest'
import { esCorreoValido } from '../validacion'

describe('esCorreoValido', () => {
  it('acepta los correos con los que se trabaja', () => {
    expect(esCorreoValido('rosa.quispe@sicedu.test')).toBe(true)
    expect(esCorreoValido('jefa@mision-huascaran.pe')).toBe(true)
    expect(esCorreoValido('  docente@colegio.edu.pe  ')).toBe(true)
  })

  it('rechaza lo que no tiene forma de correo', () => {
    expect(esCorreoValido('')).toBe(false)
    expect(esCorreoValido(null)).toBe(false)
    expect(esCorreoValido('sin-arroba.pe')).toBe(false)
    expect(esCorreoValido('sin@punto')).toBe(false)
    expect(esCorreoValido('@colegio.pe')).toBe(false)
    expect(esCorreoValido('dos@@colegio.pe')).toBe(false)
  })

  it('rechaza el texto que solo lleva un correo dentro', () => {
    // La versión anterior daba esto por bueno: le bastaba encontrar "perez@colegio.pe".
    expect(esCorreoValido('juan perez@colegio.pe')).toBe(false)
    expect(esCorreoValido('correo: rosa@colegio.pe')).toBe(false)
  })

  it('responde al instante con un texto largo sin arroba', () => {
    // El patrón anterior probaba todos los cortes posibles y el tiempo crecía con el
    // cuadrado de la longitud: esta misma entrada lo dejaba pensando (hotspot ReDoS).
    const inicio = performance.now()
    expect(esCorreoValido('a'.repeat(50_000))).toBe(false)
    expect(performance.now() - inicio).toBeLessThan(50)
  })
})
