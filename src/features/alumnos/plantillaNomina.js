// "Descargar plantilla" de "Importar nómina" (CU014).
//
// La plantilla la genera el backend (`GET /alumnos/importaciones/plantilla`):
// trae los encabezados que lee la importación (II.EE, GRADO, SUBPROGRAMA,
// NOMBRES Y APELLIDOS y DNI) y una lista desplegable con los subprogramas del
// catálogo en SUBPROGRAMA, que SheetJS no sabe escribir. Aquí solo se descarga.
//
// Sigue trayendo SOLO los títulos: el ejemplo de fila se muestra en el modal de
// "Importar nómina", porque una fila de ejemplo dentro del archivo se importaría
// como alumno.
import { obtenerPlantillaNomina } from '../../api/resources/administracion'

export const NOMBRE_PLANTILLA = 'plantilla_nomina.xlsx'

/** Cuánto vive la URL del archivo después del clic: lo que tarda en empezar la descarga. */
const VIDA_URL_MS = 1000

export async function descargarPlantillaNomina() {
  const archivo = await obtenerPlantillaNomina()
  const url = URL.createObjectURL(archivo)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = NOMBRE_PLANTILLA
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  setTimeout(() => URL.revokeObjectURL(url), VIDA_URL_MS)
}
