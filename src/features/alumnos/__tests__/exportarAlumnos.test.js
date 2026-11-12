// "Exportar": ningún texto sale como fórmula ejecutable. Datos inventados.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { exportarAlumnos } from '../exportarAlumnos'

const escribir = vi.fn()
vi.mock('xlsx', async (importOriginal) => {
  const original = await importOriginal()
  return { ...original, writeFile: (...a) => escribir(...a) }
})

const alumno = (nombre, extra = {}) => ({
  nombre, dni: null, colegio: { id: 1, nombre: 'I.E. Inventada' }, grado: { id: 1, nombre: '1.º' },
  seccion: 'Única', programa: { id: 1, nombre: 'Alfabetización' }, pertenencia_pendiente: false, activo: true, ...extra,
})

beforeEach(() => escribir.mockReset())

describe('exportarAlumnos', () => {
  it('neutraliza los valores que empiezan con =, +, - o @ y deja igual el resto', () => {
    exportarAlumnos([
      alumno('=HYPERLINK("http://ejemplo.invalid","clic")'),
      alumno('+SUM(1, 1)'),
      alumno('-2+3'),
      alumno('@SUM(1)'),
      alumno('Quispe, Rosa', { colegio: { id: 2, nombre: '=1+1' } }),
    ])
    const [libro] = escribir.mock.calls[0]
    const hoja = libro.Sheets.Alumnos
    expect(hoja.A1.v).toBe('Alumno')
    expect([hoja.A2.v, hoja.A3.v, hoja.A4.v, hoja.A5.v, hoja.A6.v]).toEqual([
      '\'=HYPERLINK("http://ejemplo.invalid","clic")',
      "'+SUM(1, 1)",
      "'-2+3",
      "'@SUM(1)",
      'Quispe, Rosa',
    ])
    expect(hoja.C6.v).toBe("'=1+1")
    // Y nada se escribe como fórmula.
    expect(Object.values(hoja).some((celda) => celda && typeof celda === 'object' && 'f' in celda)).toBe(false)
  })
})
