// Las tablas de registro por alumno (Lectura, Rúbrica y Registro de Vuelo) en
// el celular (auditoría de UX #737, U04).
//
// A 390 px se desplazan en horizontal, y al hacerlo se perdía de vista de
// quién era la fila que se estaba llenando. En pantallas angostas la columna
// Alumno queda FIJA a la izquierda, con un ancho acotado, y el resto se
// desplaza debajo de ella. En escritorio no cambia nada.
const FIJA = 'max-md:sticky max-md:left-0 max-md:z-10 max-md:min-w-[8rem] max-md:max-w-[9rem] max-md:shadow-[inset_-1px_0_0_#E2E8F2]'

/** La celda de cabecera de la columna Alumno. */
export const CABECERA_ALUMNO = `${FIJA} max-md:bg-surface-100`

/** La celda de cada fila con el nombre del alumno. */
export const CELDA_ALUMNO = `${FIJA} max-md:bg-surface-0`
