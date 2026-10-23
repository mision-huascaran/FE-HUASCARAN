// El reloj de referencia (CU010 y CU022, Restricciones).
//
// Importa porque es la defensa contra algo muy fácil de hacer: cambiar la hora
// del portátil para registrar asistencia en un día que el backend rechazaría.
// Sin conexión no hay a quién preguntar, así que el frontend tira de un ANCLA
// monotónica, y si no la tiene, del desfase que guardó la última vez.
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

  it('cambiar el reloj DESPUÉS de sincronizar no mueve la hora', async () => {
    /**
     * Esto es lo que un desfase no podía hacer. Con `Date.now() + offset`, un
     * reloj adelantado después del anclaje adelantaba la hora con él: el
     * offset corrige el error que había al anclar, no los posteriores. El
     * contador monotónico sí es inmune.
     */
    const real = new Date('2026-10-13T15:00:00Z')
    vi.useFakeTimers()
    vi.setSystemTime(real)

    const { sincronizarReloj, hoy } = await import('../relojServidor')
    sincronizarReloj(real.toISOString())
    expect(hoy()).toBe('2026-10-13')

    // Alguien adelanta el reloj del equipo tres días. La hora no se mueve.
    vi.setSystemTime(new Date(real.getTime() + 3 * UN_DIA_MS))
    expect(hoy()).toBe('2026-10-13')
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

  it('sin hablar con el servidor NO hay continuidad temporal', async () => {
    // CU010: sin referencia verificable no se habilitan nuevas escrituras.
    const { hayContinuidad } = await import('../relojServidor')
    expect(hayContinuidad()).toBe(false)
  })

  it('la continuidad se gana al sincronizar y se pierde al recargar', async () => {
    const real = new Date('2026-10-13T15:00:00Z')

    const primera = await import('../relojServidor')
    primera.sincronizarReloj(real.toISOString())
    expect(primera.hayContinuidad()).toBe(true)

    /**
     * Otra carga de la página: `performance.now()` vuelve a cero, así que el
     * ancla anterior ya no sirve. Se puede seguir CONSULTANDO con el desfase
     * guardado, pero no escribir hasta que el servidor conteste otra vez.
     */
    vi.resetModules()
    const segunda = await import('../relojServidor')
    expect(segunda.hayContinuidad()).toBe(false)
    expect(segunda.hoy()).toBe('2026-10-13')

    // Y la primera respuesta del servidor la restablece sola.
    segunda.sincronizarReloj(real.toISOString())
    expect(segunda.hayContinuidad()).toBe(true)
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
