// CU012 / RN-033 — El Directivo no accede a datos de estudiantes.
//
// CU012 limita la vista del Directivo a sus indicadores y RN-033 le prohíbe ver
// alumnos. El Dashboard, que traía un buscador de estudiantes, se retiró
// (3070755); lo que queda con datos de un alumno es su ficha. Ocultarla del
// menú no basta: la prueba escribe la URL a mano, que es como se colaba antes.
//
// Las verificaciones son `expect.soft` para que el reporte muestre TODO lo que
// falla, no solo lo primero.
import { expect, test } from '@playwright/test'
import { evidencia } from './support/evidencia.js'
import { iniciarSesion, menu } from './support/sesion.js'

test('CU012/RN-033 – el Directivo no accede a datos de estudiantes', async ({ page }) => {
  await iniciarSesion(page, 'directivo')
  await expect.soft(menu(page).getByRole('link', { name: 'Alumnos', exact: true }), 'Alumnos en el menú').toHaveCount(0)
  await evidencia(page, 'directivo-menu')

  await page.goto('/estudiantes/1')
  await expect.soft(page, 'escribir /estudiantes/1 debería llevar a /403').toHaveURL(/\/403$/)
  await expect.soft(page.getByRole('heading', { name: 'Ficha del estudiante' }), 'ficha del estudiante').toHaveCount(0)
  await evidencia(page, 'directivo-ficha-estudiante')
})
