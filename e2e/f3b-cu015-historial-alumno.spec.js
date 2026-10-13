// CU015 — El historial del alumno registra su creación (bug conocido D29).
//
// test.fail(): HOY FALLA A PROPÓSITO. `PestanaAuditoria` le pasa a `DataTable`
// la respuesta paginada entera (`{items, total, …}`) en vez de `respuesta.items`,
// así que la pestaña nunca muestra filas. Cuando se corrija D29 esta prueba
// pasará y Playwright la marcará como «expected to fail, but passed»: entonces
// hay que quitar el test.fail().
//
// Solo lectura: usa el alumno que creó (e inactivó) F3.
import { expect, test } from '@playwright/test'
import { exigirEstadoDeF3 } from './support/estado.js'
import { evidencia } from './support/evidencia.js'
import { iniciarSesion, irPorMenu } from './support/sesion.js'

test('CU015 – historial registra la creación (D29)', async ({ page }) => {
  test.fail(true, 'D29: PestanaAuditoria pasa el objeto paginado a DataTable en vez de respuesta.items')
  const { alumno } = exigirEstadoDeF3('alumno')

  await iniciarSesion(page, 'docente')
  await irPorMenu(page, 'Alumnos', '/alumnos')
  await page.getByLabel('Buscar').fill(alumno)
  await page.getByLabel('Estado', { exact: true }).selectOption({ label: 'Inactivos' })
  await page.getByRole('button', { name: 'Filtrar' }).click()

  const fila = page.getByRole('row').filter({ hasText: alumno })
  await expect(fila).toHaveCount(1)
  await fila.getByRole('button', { name: /^Visualizar/ }).click()

  const popup = page.getByRole('dialog', { name: 'Visualizar alumno' })
  await popup.getByRole('tab', { name: 'Auditoría' }).click()
  await evidencia(page, 'historial-alumno')

  // Lo que pide CU015: al menos la fila de su creación, hecha por el Docente E2E.
  await expect(popup.getByRole('row').filter({ hasText: 'E2E Docente' }).first()).toBeVisible()
  await expect(popup.getByText('Sin cambios registrados')).toHaveCount(0)
})
