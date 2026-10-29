// D58 — "Semana undefined · 22 – 22 oct" (CU010).
//
// `GET /semanas` pasó a devolver `numero_semana`, `fecha_inicio` y
// `fecha_fin`; antes eran `numero`, `inicio` y `fin`. Leer solo los viejos
// daba dos errores a la vez: el número salía `undefined` y las dos fechas
// caían en `Invalid Date`, que dayjs resuelve al día de hoy sin quejarse, así
// que el rango se pintaba como "hoy – hoy".
import { describe, expect, it } from 'vitest'
import { etiquetaDeSemana, formatearRangoSemana } from '../format'

describe('La etiqueta de una semana', () => {
  it('lee los nombres NUEVOS del contrato', () => {
    const etiqueta = etiquetaDeSemana({
      numero_semana: 23,
      fecha_inicio: '2026-06-15',
      fecha_fin: '2026-06-19',
    })
    expect(etiqueta).toBe('Semana 23 · 15 – 19 jun')
    expect(etiqueta).not.toContain('undefined')
  })

  it('sigue leyendo los viejos, que el simulador todavía manda', () => {
    expect(etiquetaDeSemana({ numero: 23, inicio: '2026-06-15', fin: '2026-06-19' })).toBe('Semana 23 · 15 – 19 jun')
  })

  it('una semana que CRUZA DE MES se escribe con las fechas completas', () => {
    /**
     * Desde la tanda B una semana vive en un solo mes aunque sus días caigan
     * en dos. "29 jun – 3 jul" se lee bien, pero el caso de uso pide las
     * fechas completas justo ahí, que es donde la gente se pierde al buscar
     * en qué mes está su tabla.
     */
    expect(
      etiquetaDeSemana({ numero_semana: 27, fecha_inicio: '2026-06-29', fecha_fin: '2026-07-03' }),
    ).toBe('Semana 27 · 29/06/2026 – 03/07/2026')
  })

  it('sin número NO escribe "Semana undefined"', () => {
    // Se dice solo el rango, que es lo que de verdad ubica a la persona.
    expect(etiquetaDeSemana({ fecha_inicio: '2026-06-15', fecha_fin: '2026-06-19' })).toBe('15 – 19 jun')
  })

  it('con fechas inválidas no inventa un rango', () => {
    // dayjs resuelve `Invalid Date` al día de hoy sin quejarse: era lo que
    // pintaba "22 – 22 oct" para una semana de junio.
    expect(formatearRangoSemana({ numero_semana: 1 })).toBe('')
    expect(etiquetaDeSemana({ numero_semana: 1 })).toBe('Semana 1')
  })

  it('sin semana devuelve vacío', () => {
    expect(etiquetaDeSemana(null)).toBe('')
    expect(formatearRangoSemana(undefined)).toBe('')
  })
})
