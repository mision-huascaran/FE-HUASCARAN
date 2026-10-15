// CU012 / RN-033 — El Directivo no accede a datos de estudiantes.
//
// CORREGIDO: la matriz le daba al Directivo la sección Dashboard, que trae un
// buscador «Estudiante (nombre o código)». CU012 limita su vista a tres
// indicadores y RN-033 le prohíbe ver alumnos. Se quitó de la matriz Y de la
// tabla de rutas: ocultarlo del menú no impedía entrar escribiendo la URL, que
// es justo lo que comprueba la segunda mitad de esta prueba.
//
// Las verificaciones son `expect.soft` para que el reporte muestre TODO lo que
// falla, no solo lo primero.
//
// /dashboard sigue en mock en qa (VITE_USE_MOCK=true): aquí solo importa si el
// Directivo puede llegar a esa pantalla, no qué datos pinta.
import { expect, test } from '@playwright/test'
import { evidencia } from './support/evidencia.js'
import { iniciarSesion, menu } from './support/sesion.js'

test('CU012/RN-033 – el Directivo no accede a datos de estudiantes', async ({ page }) => {
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
