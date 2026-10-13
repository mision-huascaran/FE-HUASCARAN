// CU012 / RN-033 — El Directivo no accede a datos de estudiantes.
//
// test.fail(): HOY FALLA A PROPÓSITO (bug de severidad Alta). La matriz de
// permisos le da al Directivo la sección Dashboard (`auth/permisos.js`), que
// trae un buscador «Estudiante (nombre o código)». CU012 limita su vista a tres
// indicadores y RN-033 le prohíbe ver alumnos.
//
// Las verificaciones son `expect.soft` para que el reporte muestre TODO lo que
// falla, no solo lo primero. Cuando se corrija, Playwright avisará con
// «expected to fail, but passed»: entonces hay que quitar el test.fail().
//
// /dashboard sigue en mock en qa (VITE_USE_MOCK=true): aquí solo importa si el
// Directivo puede llegar a esa pantalla, no qué datos pinta.
import { expect, test } from '@playwright/test'
import { evidencia } from './support/evidencia.js'
import { iniciarSesion, menu } from './support/sesion.js'

test('CU012/RN-033 – el Directivo no accede a datos de estudiantes', async ({ page }) => {
  test.fail(true, 'Bug Alta: el Directivo tiene Dashboard en el menú y un buscador de estudiantes')

  await iniciarSesion(page, 'directivo')
  await expect.soft(menu(page).getByRole('link', { name: 'Dashboard', exact: true }), 'Dashboard en el menú').toHaveCount(0)
  await evidencia(page, 'directivo-menu')

  await page.goto('/dashboard')
  await expect.soft(page, 'escribir /dashboard debería llevar a /403').toHaveURL(/\/403$/)
  await expect
    .soft(page.getByRole('searchbox', { name: 'Estudiante (nombre o código)' }), 'buscador de estudiantes')
    .toHaveCount(0)
  await evidencia(page, 'directivo-dashboard')
})
