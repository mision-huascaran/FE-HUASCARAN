// "Descargar gráfica" (CU033, CU034, CU035) — sin cobertura hasta ahora, y es
// justo donde se coló un bug real: la imagen se cargaba desde una URL
// `blob:`, que la CSP del servidor (RNF-003) no autoriza —solo `data:`—, así
// que en cualquier sitio que sirviera esa cabecera (qa, producción) el
// navegador bloqueaba la carga en silencio y la descarga "no funcionaba".
//
// Como jsdom no rasteriza canvas de verdad, se sustituyen `Image` y
// `document.createElement('canvas')` por dobles mínimos: lo que se sujeta es
// la SECUENCIA DE LLAMADAS —qué URL carga la imagen, que se dibuja sobre el
// lienzo, que se descarga con el nombre correcto—, no el PNG en sí.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { descargarGrafica, nombreDeArchivo } from '../descargarGrafica'

function svgDePrueba() {
  const ns = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(ns, 'svg')
  svg.setAttribute('viewBox', '0 0 680 240')
  const texto = document.createElementNS(ns, 'text')
  texto.textContent = 'Diciembre'
  svg.appendChild(texto)
  return svg
}

describe('nombreDeArchivo', () => {
  it('limpia tildes, espacios y mayúsculas, y añade el año escolar', () => {
    expect(nombreDeArchivo('Asistencia mensual · en Pariacaca', '2026')).toBe('asistencia-mensual-en-pariacaca-2026.png')
  })

  it('sin título propone un nombre genérico', () => {
    expect(nombreDeArchivo(undefined, undefined)).toBe('grafica.png')
  })
})

describe('descargarGrafica', () => {
  let imagenesCreadas
  let contextoCanvas
  let enlaceCreado

  beforeEach(() => {
    imagenesCreadas = []
    enlaceCreado = null

    // Un `Image` que "carga" en cuanto se le asigna `src`, como hace el
    // navegador para una URL `data:` (no hay red de por medio).
    global.Image = class {
      set src(valor) {
        this._src = valor
        imagenesCreadas.push(this)
        Promise.resolve().then(() => this.onload?.())
      }
      get src() {
        return this._src
      }
    }

    contextoCanvas = {
      fillStyle: null,
      font: null,
      fillRect: vi.fn(),
      fillText: vi.fn(),
      scale: vi.fn(),
      drawImage: vi.fn(),
    }

    const crearOriginal = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((etiqueta) => {
      if (etiqueta === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: () => contextoCanvas,
          toBlob: (cb) => cb(new Blob(['png-de-prueba'], { type: 'image/png' })),
        }
      }
      if (etiqueta === 'a') {
        const real = crearOriginal('a')
        vi.spyOn(real, 'click').mockImplementation(() => {})
        enlaceCreado = real
        return real
      }
      return crearOriginal(etiqueta)
    })

    // jsdom no implementa `URL.createObjectURL`: se define, no se espía.
    URL.createObjectURL = vi.fn(() => 'blob:descarga-del-png')
    URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sin gráfica, falla con un mensaje claro en vez de intentarlo igual', async () => {
    await expect(descargarGrafica(null)).rejects.toThrow('No hay gráfica que descargar')
  })

  it('carga la imagen desde una URL data:, nunca blob: (regresión del bug de la CSP)', async () => {
    await descargarGrafica(svgDePrueba(), { titulo: 'Asistencia mensual' })

    expect(imagenesCreadas).toHaveLength(1)
    const [imagen] = imagenesCreadas
    expect(imagen.src.startsWith('data:image/svg+xml')).toBe(true)
    expect(imagen.src.startsWith('blob:')).toBe(false)
    // Y la URL contiene el SVG de verdad, no una referencia vacía.
    expect(decodeURIComponent(imagen.src)).toContain('Diciembre')
  })

  it('dibuja la gráfica en el lienzo y descarga el PNG con el nombre de la gráfica', async () => {
    await descargarGrafica(svgDePrueba(), { titulo: 'Asistencia mensual', anioEscolar: '2026' })

    expect(contextoCanvas.drawImage).toHaveBeenCalledTimes(1)
    expect(enlaceCreado.download).toBe('asistencia-mensual-2026.png')
    expect(enlaceCreado.click).toHaveBeenCalledTimes(1)
  })

  it('escribe el título y el encabezado antes de dibujar la gráfica', async () => {
    await descargarGrafica(svgDePrueba(), {
      titulo: 'Asistencia mensual',
      encabezado: ['Año escolar 2026', 'en todos los colegios'],
      pie: ['Información incompleta: hay clases con asistencias pendientes.'],
    })

    const textos = contextoCanvas.fillText.mock.calls.map((llamada) => llamada[0])
    expect(textos).toContain('Asistencia mensual')
    expect(textos).toContain('Año escolar 2026')
    expect(textos).toContain('en todos los colegios')
    expect(textos).toContain('Información incompleta: hay clases con asistencias pendientes.')
  })

  it('si el navegador rechaza la imagen, lanza para que la pantalla ofrezca reintentar', async () => {
    global.Image = class {
      set src(valor) {
        Promise.resolve().then(() => this.onerror?.())
      }
    }

    await expect(descargarGrafica(svgDePrueba(), { titulo: 'Asistencia mensual' })).rejects.toThrow(
      /bloqueó la imagen/,
    )
  })

  it('si el navegador no da contexto 2D, lanza en vez de descargar una imagen en blanco', async () => {
    contextoCanvas = null
    const crearOriginal = document.createElement.bind(document)
    document.createElement.mockImplementation((etiqueta) =>
      etiqueta === 'canvas'
        ? { width: 0, height: 0, getContext: () => null, toBlob: vi.fn() }
        : crearOriginal(etiqueta),
    )

    await expect(descargarGrafica(svgDePrueba(), { titulo: 'Asistencia mensual' })).rejects.toThrow(
      'El navegador no permite generar la imagen',
    )
  })
})
