// CU012 / RN-033 — El Directivo no accede a datos de estudiantes.
//
// CU012 limita la vista del Directivo a sus indicadores y RN-033 le prohíbe ver
// alumnos. Ocultar una pantalla del menú no basta: la prueba escribe la URL a
// mano, que es como se colaba antes.
//
// EL DASHBOARD VOLVIÓ, y no es el que se retiró en `3070755`: aquel traía un
// buscador de estudiantes por nombre. El de CU035 no tiene ningún listado
// nominal —sus cinco endpoints con nombres le responden 403— así que el
// Directivo entra a `/dashboard`, pero no a `/dashboard/libros` (CU034), que es
// el que baja hasta el alumno.
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

  // CU034 llega hasta los libros de cada alumno: no es suyo.
  await page.goto('/dashboard/libros')
  await expect.soft(page, 'escribir /dashboard/libros debería llevar a /403').toHaveURL(/\/403$/)
  await evidencia(page, 'directivo-libros')

  await page.goto('/estudiantes/1')
  await expect.soft(page, 'escribir /estudiantes/1 debería llevar a /403').toHaveURL(/\/403$/)
  await expect.soft(page.getByRole('heading', { name: 'Ficha del estudiante' }), 'ficha del estudiante').toHaveCount(0)
  await evidencia(page, 'directivo-ficha-estudiante')
})
