// "Exportar" en Alumnos: descarga en Excel lo que HOY se ve en la tabla.
//
// No es la plantilla de "Importar nómina" (esa es vacía, para llenar y subir
// de nuevo). Esto es al revés: la data real, ya filtrada por lo que el
// Supervisor o Docente puso en Colegio/Grado/Ciclo/Subprograma/Pertenencia/
// Buscar — los mismos `alumnos` que la tabla tiene cargados, nada más se
// escribe a un archivo.
import * as XLSX from 'xlsx'
import { etiquetaDe } from '../../lib/format'
import { hoy } from '../../lib/relojServidor'

const filaDe = (a) => ({
  Alumno: a.nombre,
  DNI: etiquetaDe(a.dni),
  Colegio: etiquetaDe(a.colegio),
  Grado: etiquetaDe(a.grado),
  Sección: etiquetaDe(a.seccion),
  Subprograma: etiquetaDe(a.programa ?? a.subprograma),
  Pertenencia: a.pertenencia_pendiente ? 'Pendiente' : 'Definida',
  Estado: a.activo === false ? 'Inactivo' : 'Activo',
})

export function exportarAlumnos(alumnos) {
  const hoja = XLSX.utils.json_to_sheet(alumnos.map(filaDe))
  hoja['!cols'] = [{ wch: 28 }, { wch: 12 }, { wch: 22 }, { wch: 8 }, { wch: 10 }, { wch: 18 }, { wch: 12 }, { wch: 10 }]

  const libro = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(libro, hoja, 'Alumnos')

  XLSX.writeFile(libro, `alumnos_${hoy()}.xlsx`)
}
