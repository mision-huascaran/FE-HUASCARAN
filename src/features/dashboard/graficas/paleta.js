// Los tokens de §4.1 en hexadecimal, para los atributos de las gráficas.
//
// No es una paleta nueva: son los MISMOS colores de `tailwind.config.js`. Van
// aquí en hex porque un SVG que se exporta a PNG viaja sin la hoja de estilos
// (ver `lib/descargarGrafica.js`), así que `fill` y `stroke` tienen que ir
// escritos en el elemento. Si un color de estos deja de coincidir con su token,
// la gráfica en pantalla y la del informe dejan de ser la misma.

export const TINTA = { fuerte: '#0F1E3D', media: '#5B6577', suave: '#8A94A6' }
export const LINEA = '#E2E8F2'
export const MARCA = '#1D4ED8'

/** Los cuatro niveles de desempeño, en el orden del índice 1 a 4 de CU033. */
export const COLOR_NIVEL_DESEMPENO = {
  Inicio: '#B3261E',
  'En proceso': '#946200',
  Logrado: '#17795A',
  Avanzado: '#10428F',
}

/** Los dos subprogramas de la dona de CU033. */
export const COLOR_SUBPROGRAMA = {
  Alfabetización: '#1D4ED8',
  'Comprensión Lectora': '#17795A',
}

/** Serie de apoyo para cualquier reparto sin color propio, estable por índice. */
const SERIE = ['#1D4ED8', '#17795A', '#946200', '#6D28D9', '#B3261E', '#10428F']

export const colorDeSerie = (i) => SERIE[i % SERIE.length]

export const colorDeNivelDesempeno = (nombre, i = 0) =>
  COLOR_NIVEL_DESEMPENO[nombre] ?? colorDeSerie(i)

export const colorDeSubprograma = (nombre, i = 0) => COLOR_SUBPROGRAMA[nombre] ?? colorDeSerie(i)
