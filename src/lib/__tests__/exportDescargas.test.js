// Descargas de lib/export.js: CSV, Excel, PNG de un gráfico e impresión.
// Se interceptan las APIs del navegador que jsdom no trae (URL de objetos,
// canvas, Image) para comprobar QUÉ se descarga sin generar archivos.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { aCSV, aSpreadsheetML, descargarCSV, descargarExcel, descargarPNG, imprimirComoPDF, nombreArchivo } from '../export'

const COLUMNAS = [
  { titulo: 'Colegio', valor: 'colegio' },
  { titulo: 'Total', clave: 'total' },
]
const FILAS = [{ colegio: 'I.E. Señor de Mayo', total: 12 }]

let descargado

/**
 * jsdom no sabe leer un Blob de forma síncrona: se intercepta su constructor
 * para quedarse con las partes y el tipo, que es lo que importa comprobar.
 */
const BlobOriginal = globalThis.Blob

beforeEach(() => {
  descargado = null
  vi.useFakeTimers()
  globalThis.Blob = vi.fn(function BlobDePrueba(partes, opciones) {
    return { partes, type: opciones?.type }
  })
  URL.createObjectURL = vi.fn((blob) => {
    descargado = { blob }
    return 'blob:prueba'
  })
  URL.revokeObjectURL = vi.fn()
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function registrar() {
    descargado.nombre = this.download
    descargado.enDocumento = document.body.contains(this)
  })
})

afterEach(() => {
  globalThis.Blob = BlobOriginal
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('descargarCSV', () => {
  it('descarga un CSV UTF-8 con BOM y libera la URL del objeto', () => {
    descargarCSV(FILAS, COLUMNAS, 'Ranking de colegios')

    expect(descargado.nombre).toMatch(/^ranking-de-colegios-\d{4}-\d{2}-\d{2}\.csv$/)
    expect(descargado.enDocumento).toBe(true)
    expect(descargado.blob.type).toBe('text/csv;charset=utf-8')
    // El BOM va primero: así Excel en español lee bien las tildes.
    expect(descargado.blob.partes).toEqual([String.fromCodePoint(0xfeff), 'Colegio,Total\r\nI.E. Señor de Mayo,12'])

    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1000)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:prueba')
    // El enlace temporal no queda colgado en el documento.
    expect(document.querySelectorAll('a[download]')).toHaveLength(0)
  })

  /**
   * HALLAZGO DE SEGURIDAD (REPORTE_CALIDAD.md): un texto que empieza por =, +,
   * - o @ (por ejemplo una observación del docente) se exporta tal cual y Excel
   * lo ejecuta como fórmula al abrir el CSV ("CSV injection", CWE-1236).
   */
  it.fails('neutraliza las celdas que Excel interpretaría como fórmula', () => {
    const csv = aCSV([{ colegio: '=HYPERLINK("http://malicioso.example","ver")' }], [COLUMNAS[0]])
    expect(csv.split('\r\n')[1]).not.toMatch(/^"?=/)
  })
})

describe('descargarExcel', () => {
  it('descarga SpreadsheetML con la extensión .xls', () => {
    descargarExcel(FILAS, COLUMNAS, 'Consolidado', 'Hoja')
    expect(descargado.nombre).toMatch(/^consolidado-.*\.xls$/)
    expect(descargado.blob.type).toBe('application/vnd.ms-excel')
    expect(descargado.blob.partes[0]).toContain('<Data ss:Type="Number">12</Data>')
  })

  it('el nombre de la hoja se recorta a 31 caracteres, el máximo de Excel', () => {
    const xml = aSpreadsheetML([], COLUMNAS, 'Consolidado de niveles por grado y programa')
    expect(xml).toContain('ss:Name="Consolidado de niveles por grad"')
  })

  /**
   * BUG LATENTE (REPORTE_CALIDAD.md): el nombre se escapa ANTES de recortarlo,
   * así que un "&" cerca del carácter 31 queda partido ("&am") y el archivo
   * deja de ser XML válido. Hoy ningún reporte lleva "&" en el título.
   */
  it.fails('recortar el nombre de la hoja nunca rompe el XML', () => {
    const xml = aSpreadsheetML([], COLUMNAS, `${'x'.repeat(28)} & y`)
    const documento = new DOMParser().parseFromString(xml, 'application/xml')
    expect(documento.querySelector('parsererror')).toBeNull()
  })

  it('un número no finito viaja como texto, no como número inválido', () => {
    const xml = aSpreadsheetML([{ colegio: 'X', total: Number.NaN }], COLUMNAS)
    expect(xml).toContain('<Data ss:Type="String">NaN</Data>')
  })
})

describe('nombreArchivo', () => {
  it('sin base usa "sicedu"', () => {
    expect(nombreArchivo('', 'csv')).toMatch(/^sicedu-\d{4}-\d{2}-\d{2}\.csv$/)
  })
})

describe('descargarPNG', () => {
  it('sin gráfico dibujado no descarga nada y lo dice', async () => {
    await expect(descargarPNG(document.createElement('div'), 'grafico')).resolves.toBe(false)
    await expect(descargarPNG(null, 'grafico')).resolves.toBe(false)
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('rasteriza el SVG de recharts al doble de resolución sobre fondo blanco', async () => {
    const contenedor = document.createElement('div')
    contenedor.innerHTML = '<svg class="recharts-surface"><rect width="10" height="10"/></svg>'
    vi.spyOn(SVGElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 300, height: 150 })

    const ctx = { fillRect: vi.fn(), scale: vi.fn(), drawImage: vi.fn(), fillStyle: null }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback({ type: 'image/png' }))
    // jsdom no carga imágenes: se dispara `onload` en cuanto se asigna `src`.
    vi.spyOn(globalThis, 'Image').mockImplementation(function Imagen() {
      return Object.defineProperty({}, 'src', {
        set: function cargar() {
          queueMicrotask(() => this.onload())
        },
      })
    })

    await expect(descargarPNG(contenedor, 'Evolución')).resolves.toBe(true)

    expect(ctx.fillStyle).toBe('#FFFFFF')
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 600, 300)
    expect(ctx.scale).toHaveBeenCalledWith(2, 2)
    expect(descargado.nombre).toMatch(/^evolucion-.*\.png$/)
  })

  it('si el navegador no genera la imagen, no intenta descargarla', async () => {
    const contenedor = document.createElement('div')
    contenedor.innerHTML = '<svg class="recharts-surface"></svg>'
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ fillRect() {}, scale() {}, drawImage() {} })
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(null))
    vi.spyOn(globalThis, 'Image').mockImplementation(function Imagen() {
      return Object.defineProperty({}, 'src', {
        set: function cargar() {
          queueMicrotask(() => this.onload())
        },
      })
    })

    await expect(descargarPNG(contenedor, 'x')).resolves.toBe(true)
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })
})

describe('imprimirComoPDF', () => {
  it('abre el diálogo de impresión del navegador', () => {
    window.print = vi.fn()
    imprimirComoPDF()
    expect(window.print).toHaveBeenCalled()
  })
})
