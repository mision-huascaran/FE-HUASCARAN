// La plantilla de Excel para "Importar nómina" (CU014).
//
// El import solo lee estas 4 columnas, por nombre de encabezado: II.EE,
// GRADO, NOMBRES Y APELLIDOS y DNI (ver ImportarNominaModal.jsx). La
// plantilla trae SOLO los títulos: el ejemplo de fila se muestra en el modal
// de "Importar nómina", porque una fila de ejemplo dentro del archivo se
// importaría como alumno (o daría "Colegio no registrado" en cada importación).
import * as XLSX from 'xlsx'

const ENCABEZADOS = ['II.EE', 'GRADO', 'NOMBRES Y APELLIDOS', 'DNI']

export function descargarPlantillaNomina() {
  const hoja = XLSX.utils.aoa_to_sheet([ENCABEZADOS])
  hoja['!cols'] = [{ wch: 22 }, { wch: 8 }, { wch: 28 }, { wch: 12 }]

  const libro = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(libro, hoja, 'Nombre del colegio')

  XLSX.writeFile(libro, 'plantilla_nomina.xlsx')
}
