// La plantilla del simulador (sin backend): los mismos encabezados que la real,
// que el backend genera con la lista desplegable de SUBPROGRAMA.
import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import handlers from '../../../api/mock/handlers'

/** El contenido del Blob (el de jsdom no trae `arrayBuffer`). */
const leer = (blob) =>
  new Promise((resolve, reject) => {
    const lector = new FileReader()
    lector.onload = () => resolve(new Uint8Array(lector.result))
    lector.onerror = () => reject(lector.error)
    lector.readAsArrayBuffer(blob)
  })

describe('plantilla de la nómina en el simulador', () => {
  it('trae solo los encabezados que lee la importación, con SUBPROGRAMA junto a GRADO', async () => {
    const archivo = await handlers.administracion.plantillaNomina()
    const libro = XLSX.read(await leer(archivo), { type: 'array' })
    const hoja = libro.Sheets[libro.SheetNames[0]]

    expect(XLSX.utils.sheet_to_json(hoja, { header: 1 })).toEqual([['II.EE', 'GRADO', 'SUBPROGRAMA', 'NOMBRES Y APELLIDOS', 'DNI']])
  })
})
