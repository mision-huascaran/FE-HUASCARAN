// RNF-004 / matriz de permisos: el Directivo solo ve métricas agregadas y NUNCA
// nombres de alumnos (`sinNombresDeAlumnos` en auth/permisos.js).
//
// Se recorre cada ruta a la que entra el Directivo con los datos del mock, se
// espera a que terminen TODAS sus consultas y se busca en el documento el
// nombre y el código de cada alumno. También se revisan las descargas.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RUTAS_PROTEGIDAS } from '../../rutas'
import { ALUMNOS } from '../../api/mock/db'
import { ROLES } from '../../auth/roles'
import { MATRIZ } from '../../auth/permisos'
import { descargarCSV, descargarExcel } from '../../lib/export'
import { renderConProveedores } from '../../test/renderConProveedores'

// Las descargas se interceptan para leer las filas sin generar archivos.
vi.mock('../../lib/export', async (importOriginal) => ({
  ...(await importOriginal()),
  descargarCSV: vi.fn(),
  descargarExcel: vi.fn(),
}))

const RUTAS_DEL_DIRECTIVO = RUTAS_PROTEGIDAS.filter((r) => r.allow.includes(ROLES.DIRECTIVO)).map((r) =>
  r.path.replace(':id', '1'),
)

/** Las dos formas en que una pantalla podría pintar a un alumno, y su código. */
const RASTROS_DE_ALUMNOS = ALUMNOS.flatMap((a) => [`${a.nombres} ${a.apellidos}`, `${a.apellidos}, ${a.nombres}`, a.codigo])

const rastrosEn = (texto) => RASTROS_DE_ALUMNOS.filter((rastro) => texto.includes(rastro))

async function montarYEsperar(ruta, rol = ROLES.DIRECTIVO) {
  const { cliente } = renderConProveedores(null, { ruta, rol })
  await waitFor(() => expect(screen.getByLabelText('ruta actual')).toHaveTextContent(ruta))
  // Espera a que no quede ninguna consulta en vuelo: lo que se vaya a pintar ya está.
  await waitFor(() => expect(cliente.isFetching()).toBe(0), { timeout: 8000 })
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('El Directivo no ve nombres de alumnos (RNF-004)', () => {
  it('la matriz de permisos lo declara para su única sección con datos', () => {
    expect(MATRIZ.dashboard[ROLES.DIRECTIVO].sinNombresDeAlumnos).toBe(true)
    expect(RUTAS_DEL_DIRECTIVO.length).toBeGreaterThan(0)
  })

  it('control: el mismo detector SÍ encuentra alumnos en /alumnos del Supervisor', async () => {
    // Sin este control, una pantalla en blanco haría pasar las pruebas de abajo.
    await montarYEsperar('/alumnos', ROLES.SUPERVISOR)
    await waitFor(() => expect(rastrosEn(document.body.textContent).length).toBeGreaterThan(0))
  })

  it.each(RUTAS_DEL_DIRECTIVO)('en %s no aparece ningún nombre ni código de alumno', async (ruta) => {
    await montarYEsperar(ruta)
    expect(rastrosEn(document.body.textContent)).toEqual([])
  })

  it('las descargas de /reportes son agregadas: ninguna fila nombra a un alumno', async () => {
    await montarYEsperar('/reportes')
    const descargas = () => [...descargarCSV.mock.calls, ...descargarExcel.mock.calls]

    const botones = screen.getAllByRole('button', { name: /csv|excel/i })
    expect(botones.length).toBeGreaterThan(0)
    // Mientras una descarga se genera los demás botones se deshabilitan:
    // se espera a que termine cada una antes de pulsar la siguiente.
    for (const [i, boton] of botones.entries()) {
      await waitFor(() => expect(boton).toBeEnabled())
      await userEvent.click(boton)
      await waitFor(() => expect(descargas()).toHaveLength(i + 1))
    }

    const exportado = JSON.stringify(descargas().map(([filas]) => filas))
    expect(rastrosEn(exportado)).toEqual([])
  })
})
