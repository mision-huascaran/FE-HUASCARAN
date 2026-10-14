// El reloj de referencia (CU022, Restricciones).
//
// Importa porque es la defensa contra algo muy fácil de hacer: cambiar la hora
// del portátil para registrar asistencia en un día que el backend rechazaría.
// Sin conexión no hay a quién preguntar, así que el frontend tira del desfase
// que guardó la última vez que sí la hubo.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const UN_DIA_MS = 24 * 60 * 60 * 1000

beforeEach(() => {
  vi.resetModules()
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Reloj de referencia del servidor', () => {
  it('sin haber hablado con el servidor, usa la hora del dispositivo', async () => {
    const { ahora } = await import('../relojServidor')
    expect(Math.abs(ahora().getTime() - Date.now())).toBeLessThan(1000)
  })

  it('un reloj local adelantado no adelanta el día lectivo', async () => {
    const { sincronizarReloj, hoy, esFutura } = await import('../relojServidor')

    // El servidor dice que es el 13; el equipo, que el 14.
    const real = new Date('2026-10-13T15:00:00Z')
    vi.useFakeTimers()
    vi.setSystemTime(new Date(real.getTime() + UN_DIA_MS))
    sincronizarReloj(real.toISOString())

    expect(hoy()).toBe('2026-10-13')
    // Y por tanto el 14 sigue siendo futuro, aunque el equipo lo dé por hoy.
    expect(esFutura('2026-10-14')).toBe(true)
    expect(esFutura('2026-10-13')).toBe(false)
  })

  it('el desfase sobrevive al cierre del navegador', async () => {
    const real = new Date('2026-10-13T15:00:00Z')
    vi.useFakeTimers()
    vi.setSystemTime(new Date(real.getTime() + UN_DIA_MS))

    const primera = await import('../relojServidor')
    primera.sincronizarReloj(real.toISOString())

    // Otra carga de la aplicación, con el reloj del equipo igual de mal.
    vi.resetModules()
    const segunda = await import('../relojServidor')
    expect(segunda.hoy()).toBe('2026-10-13')
  })

  it('una fecha que no se entiende no toca el desfase', async () => {
    const { sincronizarReloj, hoy } = await import('../relojServidor')
    const antes = hoy()
    sincronizarReloj('no es una fecha')
    sincronizarReloj(undefined)
    expect(hoy()).toBe(antes)
  })

  it('el día se cuenta en Lima, no en UTC', async () => {
    const { sincronizarReloj, hoy } = await import('../relojServidor')
    // Las 02:00 UTC del 14 son todavía las 21:00 del 13 en Lima (UTC-5).
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-14T02:00:00Z'))
    sincronizarReloj('2026-10-14T02:00:00Z')
    expect(hoy()).toBe('2026-10-13')
  })
})
