// Exportaciones de la interfaz: CSV, Excel, PNG de un gráfico e impresión a PDF.
//
// Sin dependencias nuevas (§2): cada formato se arma con APIs del navegador.
//
//  - CSV   UTF-8 con BOM, para que Excel en español muestre bien las tildes.
//  - Excel "Hoja de cálculo XML 2003" (SpreadsheetML). Es texto plano que Excel
//          abre de forma nativa con columnas numéricas de verdad. Contrapartida:
//          al abrir el .xls Excel avisa que el formato no coincide con la
//          extensión; basta aceptar. Un .xlsx real exigiría una librería de ZIP.
//  - PNG   se serializa el SVG que dibuja recharts y se rasteriza en un canvas.
//  - PDF   por el diálogo de impresión del navegador ("Guardar como PDF"), con
//          una hoja de estilos de impresión que oculta la navegación.
//
// RN-019: lo exportado es exactamente lo que la pantalla ya muestra; ninguna
// exportación agrega datos personales que la interfaz no enseñe.

/** Nombre de archivo seguro: sin tildes, espacios ni símbolos. */
export function nombreArchivo(base, extension) {
  const limpio = String(base || 'sicedu')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
  const fecha = new Date().toISOString().slice(0, 10)
  return `${limpio}-${fecha}.${extension}`
}

function descargarBlob(blob, nombre) {
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Valor de una celda para una columna: `valor` puede ser clave o función. */
const celda = (fila, columna) =>
  typeof columna.valor === 'function' ? columna.valor(fila) : fila[columna.valor ?? columna.clave]

/**
 * Texto CSV. `columnas` = [{ titulo, valor }], donde `valor` es la clave de la
 * fila o una función que la calcula.
 */
export function aCSV(filas = [], columnas = []) {
  const escapar = (valor) => {
    if (valor == null) return ''
    const texto = String(valor)
    return /[",\n;]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
  }
  const cabecera = columnas.map((c) => escapar(c.titulo)).join(',')
  const cuerpo = filas.map((fila) => columnas.map((c) => escapar(celda(fila, c))).join(','))
  return [cabecera, ...cuerpo].join('\r\n')
}

export function descargarCSV(filas, columnas, base) {
  // El BOM le dice a Excel que el archivo es UTF-8.
  const BOM = String.fromCharCode(0xfeff)
  descargarBlob(new Blob([BOM, aCSV(filas, columnas)], { type: 'text/csv;charset=utf-8' }), nombreArchivo(base, 'csv'))
}

const escaparXML = (valor) =>
  String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/** Hoja de cálculo XML 2003: los números viajan como números, no como texto. */
export function aSpreadsheetML(filas = [], columnas = [], hoja = 'SICEDU') {
  const fila = (valores, esCabecera = false) =>
    `<Row>${valores
      .map((v) => {
        const numero = !esCabecera && typeof v === 'number' && Number.isFinite(v)
        return `<Cell${esCabecera ? ' ss:StyleID="cab"' : ''}><Data ss:Type="${numero ? 'Number' : 'String'}">${escaparXML(v)}</Data></Cell>`
      })
      .join('')}</Row>`

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<?mso-application progid="Excel.Sheet"?>',
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">',
    '<Styles><Style ss:ID="cab"><Font ss:Bold="1"/></Style></Styles>',
    `<Worksheet ss:Name="${escaparXML(hoja).slice(0, 31)}"><Table>`,
    fila(columnas.map((c) => c.titulo), true),
    ...filas.map((f) => fila(columnas.map((c) => celda(f, c)))),
    '</Table></Worksheet></Workbook>',
  ].join('')
}

export function descargarExcel(filas, columnas, base, hoja) {
  descargarBlob(
    new Blob([aSpreadsheetML(filas, columnas, hoja)], { type: 'application/vnd.ms-excel' }),
    nombreArchivo(base, 'xls'),
  )
}

/**
 * PNG de un gráfico de recharts. Busca el SVG principal dentro de `contenedor`,
 * le pone fondo blanco y lo rasteriza al doble de resolución para que no se
 * vea borroso en un informe.
 */
export async function descargarPNG(contenedor, base) {
  const svg = contenedor?.querySelector('svg.recharts-surface')
  if (!svg) return false

  const { width, height } = svg.getBoundingClientRect()
  const copia = svg.cloneNode(true)
  copia.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  copia.setAttribute('width', width)
  copia.setAttribute('height', height)
  copia.style.fontFamily = 'Inter, system-ui, sans-serif'

  const datos = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(copia))}`
  const imagen = new Image()
  await new Promise((resolver, rechazar) => {
    imagen.onload = resolver
    imagen.onerror = rechazar
    imagen.src = datos
  })

  const escala = 2
  const canvas = document.createElement('canvas')
  canvas.width = width * escala
  canvas.height = height * escala
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.scale(escala, escala)
  ctx.drawImage(imagen, 0, 0, width, height)

  await new Promise((resolver) =>
    canvas.toBlob((blob) => {
      if (blob) descargarBlob(blob, nombreArchivo(base, 'png'))
      resolver()
    }, 'image/png'),
  )
  return true
}

/** "Exportar a PDF": abre el diálogo de impresión, donde se elige "Guardar como PDF". */
export function imprimirComoPDF() {
  window.print()
}
