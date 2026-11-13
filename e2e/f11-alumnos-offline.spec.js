// F11 — Alumnos sin conexión muestra lo mismo que con conexión (CU014, D61).
//
// El caso del probador: con "Todos" y una búsqueda, la lista muestra a un
// alumno INACTIVO. Se corta la red sin recargar y la tabla quedaba en "Sin
// registros" (la precarga solo traía activos), y su detalle decía "No se
// encontró al alumno".
//
// Para no depender de los datos de otras pruebas, crea su propio alumno y lo
// inactiva (queda inactivo: es una baja lógica).
import { expect, test } from '@playwright/test'
import { cerrarActividadPendiente, exigirPeriodoVigente, finalizarActividad, iniciarActividad } from './support/actividad.js'
import { crearAlumno, filtrarAlumnos, inactivarAlumno, marcaEnLetras } from './support/alumnos.js'
import { iniciarSesion, irPorMenu } from './support/sesion.js'

const AVISO_SIN_CONEXION = /Se muestra la última información guardada en este equipo/

/** Los nombres de la tabla (la columna Alumno), en orden. */
const nombresDeLaTabla = (page) => page.getByRole('row').getByRole('link', { name: /./ }).allInnerTexts()

test('F11 · Alumnos sin conexión: los mismos alumnos que con conexión (inactivo incluido) y su detalle se abre (CU014, D61)', async ({ page, context }) => {
  test.setTimeout(240_000)
  const { inicio } = await iniciarSesion(page, 'docente')
  await exigirPeriodoVigente(page, inicio)
  await cerrarActividadPendiente(page, inicio)
  await iniciarActividad(page)
  await irPorMenu(page, 'Alumnos', '/alumnos')

  const marca = `Offlineprueba${marcaEnLetras(Date.now())}`
  await test.step('Con conexión: un alumno de la prueba, inactivo', async () => {
    await crearAlumno(page, { nombres: 'Inactivo', apellidos: marca, grado: '1.º', subprograma: 'Alfabetización' })
    await filtrarAlumnos(page, marca)
    await inactivarAlumno(page, page.getByRole('row').filter({ hasText: marca }))
  })

  const conConexion = await test.step('Con conexión, "Todos" y la búsqueda lo muestran', async () => {
    await page.getByLabel('Estado', { exact: true }).selectOption({ label: 'Todos' })
    await filtrarAlumnos(page, marca)
    const fila = page.getByRole('row').filter({ hasText: marca })
    await expect(fila).toHaveCount(1)
    await expect(fila.getByText('Inactivo', { exact: true })).toBeVisible()
    return nombresDeLaTabla(page)
  })

  await test.step('Sin conexión y sin recargar: la tabla muestra lo mismo', async () => {
    await context.setOffline(true)
    await expect(page.getByText(AVISO_SIN_CONEXION).first()).toBeVisible()
    await expect(page.getByText('Sin registros')).toHaveCount(0)
    await expect.poll(() => nombresDeLaTabla(page), { message: 'los mismos alumnos que con conexión' }).toEqual(conConexion)
    await expect(page.getByRole('row').filter({ hasText: marca }).getByText('Inactivo', { exact: true })).toBeVisible()
  })

  await test.step('Sin conexión, el detalle del alumno se abre', async () => {
    await page.getByRole('row').filter({ hasText: marca }).getByRole('link').click()
    await expect(page).toHaveURL(/\/estudiantes\/\d+$/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(marca)
    await expect(page.getByText('No se encontró al alumno')).toHaveCount(0)
    await expect(page.getByText('Inactivo', { exact: true }).first()).toBeVisible()
  })

  await context.setOffline(false)
  await finalizarActividad(page)
})
