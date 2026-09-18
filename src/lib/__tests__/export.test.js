import { describe, expect, it } from 'vitest'
import { aCSV, aSpreadsheetML, nombreArchivo } from '../export'

const columnas = [
  { titulo: 'Colegio', valor: 'colegio' },
  { titulo: 'Total', valor: 'total' },
  { titulo: 'Doble', valor: (f) => f.total * 2 },
]

describe('aCSV', () => {
  it('arma cabecera y filas, con columnas calculadas', () => {
    const csv = aCSV([{ colegio: 'Tinco', total: 3 }], columnas)
    expect(csv).toBe('Colegio,Total,Doble\r\nTinco,3,6')
  })

  it('escapa comas, comillas y saltos de línea', () => {
    const csv = aCSV([{ colegio: 'I.E. "86021", Ranrahirca', total: 1 }], columnas)
    expect(csv.split('\r\n')[1]).toBe('"I.E. ""86021"", Ranrahirca",1,2')
  })

  it('deja vacías las celdas sin valor, no escribe "null"', () => {
    expect(aCSV([{ colegio: 'X', total: null }], columnas.slice(0, 2))).toBe('Colegio,Total\r\nX,')
  })
})

describe('aSpreadsheetML (Excel)', () => {
  it('los números viajan como números y el texto como texto', () => {
    const xml = aSpreadsheetML([{ colegio: 'Tinco', total: 3 }], columnas.slice(0, 2))
    expect(xml).toContain('<Data ss:Type="Number">3</Data>')
    expect(xml).toContain('<Data ss:Type="String">Tinco</Data>')
  })

  it('escapa los caracteres reservados de XML', () => {
    expect(aSpreadsheetML([{ colegio: 'A & B <C>', total: 1 }], columnas.slice(0, 1))).toContain('A &amp; B &lt;C&gt;')
  })
})

describe('nombreArchivo', () => {
  it('quita tildes y símbolos y añade la fecha', () => {
    expect(nombreArchivo('Consolidado de niveles · Julio', 'csv')).toMatch(/^consolidado-de-niveles-julio-\d{4}-\d{2}-\d{2}\.csv$/)
  })
})
