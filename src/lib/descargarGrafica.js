// "Descargar gráfica" — el flujo alternativo que CU033, CU034 y CU035 piden
// para CADA gráfica cargada correctamente.
//
// Las tres condiciones que vienen del caso de uso y no son negociables:
//
//   · PNG CON FONDO BLANCO. Un PNG transparente pegado en un informe con fondo
//     oscuro deja los textos invisibles, y lo que se exporta es para pegarlo.
//   · LA GRÁFICA COMPLETA, con su título, el año escolar, el periodo, los
//     colegios, los ejes, los valores, la leyenda y las advertencias de
//     información incompleta. Sin botones ni menús de la interfaz.
//   · LO QUE SE VE APLICADO, no los filtros pendientes. Eso se cumple solo:
//     se exporta el SVG que está en pantalla, y ese se dibuja con los filtros
//     de la consulta mostrada.
//
// POR QUÉ LAS GRÁFICAS LLEVAN LOS COLORES EN ATRIBUTOS Y NO EN CLASES DE
// TAILWIND: un SVG serializado viaja SIN la hoja de estilos de la página. Un
// `class="fill-ink-500"` se queda sin definición dentro del PNG y el texto sale
// negro o invisible. Por eso `graficas/paleta.js` existe y por eso cada `fill`
// y cada `stroke` van escritos en el elemento.

/** Nombre de archivo que identifica la gráfica y el año escolar (CU033). */
export function nombreDeArchivo(titulo, anioEscolar) {
  const limpio = String(titulo ?? 'grafica')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
  const sufijo = anioEscolar ? `-${anioEscolar}` : ''
  return `${limpio || 'grafica'}${sufijo}.png`
}

/** Alto de cada línea de texto del encabezado y del pie, en unidades del SVG. */
const LINEA = 18
const MARGEN = 14

/** Escribe las líneas de contexto y devuelve la Y en la que se quedó. */
function escribirLineas(ctx, lineas, { x, y, tamano, color, negrita = false }) {
  ctx.fillStyle = color
  ctx.font = `${negrita ? '600 ' : ''}${tamano}px Inter, system-ui, sans-serif`
  let cursor = y
  for (const linea of lineas) {
    cursor += tamano
    ctx.fillText(linea, x, cursor)
    cursor += 6
  }
  return cursor
}

/**
 * Convierte un `<svg>` del DOM en un PNG y lo descarga.
 *
 * `encabezado` y `pie` son las líneas de contexto que el CU exige dentro de la
 * imagen: el título, el año escolar, el periodo o intervalo, los colegios
 * incluidos, la fecha de la consulta y las advertencias de información
 * incompleta. Se dibujan en el lienzo, no en el SVG, para que cada gráfica se
 * ocupe solo de sus datos.
 *
 * Lanza si algo falla, para que la pantalla pueda mostrar el literal del CU
 * ("No se pudo descargar la gráfica. Inténtalo nuevamente.") y permitir
 * reintentar. No se traga el error en silencio: una descarga que no ocurre y
 * no avisa parece un botón roto.
 */
export async function descargarGrafica(
  svg,
  { titulo, anioEscolar, encabezado = [], pie = [], escala = 2 } = {},
) {
  if (!svg) throw new Error('No hay gráfica que descargar')

  const caja = svg.viewBox?.baseVal
  const ancho = caja?.width || svg.clientWidth || 800
  const altoGrafica = caja?.height || svg.clientHeight || 400

  const lineasArriba = [titulo, ...encabezado].filter(Boolean)
  const altoArriba = lineasArriba.length ? MARGEN + lineasArriba.length * LINEA + 6 : 0
  const altoAbajo = pie.length ? MARGEN + pie.length * LINEA : MARGEN
  const alto = altoArriba + altoGrafica + altoAbajo

  const copia = svg.cloneNode(true)
  copia.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  copia.setAttribute('width', String(ancho))
  copia.setAttribute('height', String(altoGrafica))

  const fuente = new XMLSerializer().serializeToString(copia)
  const url = URL.createObjectURL(new Blob([fuente], { type: 'image/svg+xml;charset=utf-8' }))

  try {
    const imagen = await new Promise((resolver, rechazar) => {
      const img = new Image()
      img.onload = () => resolver(img)
      img.onerror = () => rechazar(new Error('No se pudo rasterizar la gráfica'))
      img.src = url
    })

    const lienzo = document.createElement('canvas')
    lienzo.width = Math.round(ancho * escala)
    lienzo.height = Math.round(alto * escala)
    const ctx = lienzo.getContext('2d')
    if (!ctx) throw new Error('El navegador no permite generar la imagen')

    // El fondo blanco va ANTES del dibujo: el PNG nace transparente.
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, lienzo.width, lienzo.height)
    ctx.scale(escala, escala)

    let cursor = 0
    if (lineasArriba.length) {
      cursor = escribirLineas(ctx, [titulo].filter(Boolean), {
        x: MARGEN,
        y: MARGEN - 6,
        tamano: 14,
        color: '#0F1E3D',
        negrita: true,
      })
      escribirLineas(ctx, encabezado.filter(Boolean), {
        x: MARGEN,
        y: cursor - 4,
        tamano: 11,
        color: '#5B6577',
      })
    }

    ctx.drawImage(imagen, 0, altoArriba, ancho, altoGrafica)

    if (pie.length) {
      escribirLineas(ctx, pie.filter(Boolean), {
        x: MARGEN,
        y: altoArriba + altoGrafica,
        tamano: 11,
        color: '#5B6577',
      })
    }

    const blob = await new Promise((resolver, rechazar) =>
      lienzo.toBlob((b) => (b ? resolver(b) : rechazar(new Error('No se pudo generar el PNG'))), 'image/png'),
    )

    const enlace = document.createElement('a')
    enlace.href = URL.createObjectURL(blob)
    enlace.download = nombreDeArchivo(titulo, anioEscolar)
    enlace.click()
    URL.revokeObjectURL(enlace.href)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export default descargarGrafica
