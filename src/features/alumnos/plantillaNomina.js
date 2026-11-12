// La plantilla de Excel para "Importar nómina" (CU014).
//
// El import solo lee estas 4 columnas, por nombre de encabezado: II.EE,
// GRADO, NOMBRES Y APELLIDOS y DNI (ver ImportarNominaModal.jsx). La
// plantilla trae un ejemplo para que quede claro el formato de cada una.
import * as XLSX from 'xlsx'

const ENCABEZADOS = ['II.EE', 'GRADO', 'NOMBRES Y APELLIDOS', 'DNI']

const EJEMPLO = ['I.E. Amashca', 1, 'Pérez Quispe, Juan', '12345678']

export function descargarPlantillaNomina() {
  const hoja = XLSX.utils.aoa_to_sheet([ENCABEZADOS, EJEMPLO])
  hoja['!cols'] = [{ wch: 22 }, { wch: 8 }, { wch: 28 }, { wch: 12 }]

  const libro = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(libro, hoja, 'Nombre del colegio')

  XLSX.writeFile(libro, 'plantilla_nomina.xlsx')
}
