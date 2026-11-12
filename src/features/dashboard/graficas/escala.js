// El tamaño de las letras de las gráficas, según el ancho en que se dibujan.
//
// Las gráficas son un SVG de ancho fijo (680) con `viewBox`: el navegador lo
// estira o lo encoge entero para llenar su caja, y las letras con él. En una
// tarjeta del Dashboard la caja mide ~490 px, así que un `fontSize="10"` se
// leía a 7 px; en el Consolidado de libros, a ~1070 px, el mismo texto salía a
// 15 px. Antes solo se compensaba en el teléfono (por debajo de 640 px de
// pantalla), mirando la PANTALLA y no la caja.
//
// Ahora el marco (`Grafica`) mide su caja y cada gráfica dibuja las letras al
// tamaño que, tras la reducción, se lee como el de siempre. Nunca se achican:
// en una caja más ancha que el SVG se quedan en su tamaño base.
//
// Va en el ATRIBUTO `fontSize` y no en CSS a propósito: la descarga a PNG
// serializa el SVG suelto, sin hoja de estilos.

/** Tope del agrandado: más allá, las etiquetas ya no caben en su sitio. */
const MAXIMO = 1.9

/**
 * @param anchoBase ancho del `viewBox` de la gráfica.
 * @param anchoVisible ancho real de su caja en pantalla (0 si aún no se midió).
 * @param compacto pantalla de teléfono: sin medida, se agranda al máximo.
 */
export function factorDeLetra({ anchoBase, anchoVisible = 0, compacto = false }) {
  if (!anchoVisible) return compacto ? MAXIMO : 1
  return Math.min(MAXIMO, Math.max(1, anchoBase / anchoVisible))
}

/** El `fontSize` de una etiqueta de tamaño base `base`. */
export const letra = (factor, base) => String(Math.round(base * factor))

/** Ancho aproximado de un texto en unidades del SVG (Inter, ~0.58 em por carácter). */
export const anchoDeTexto = (texto, tamano) => String(texto).length * tamano * 0.58
