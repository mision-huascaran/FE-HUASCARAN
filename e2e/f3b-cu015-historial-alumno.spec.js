// CU015 — El historial del alumno registra su creación.
//
// D29 CORREGIDO: `PestanaAuditoria` le pasaba a `DataTable` la respuesta
// paginada entera (`{items, total, …}`) en vez de la lista, y la tabla llamaba
// a `.slice()` sobre un objeto: la pantalla entera se caía con "No se pudo
// mostrar esta pantalla". Ahora el recurso normaliza y se lee `cambios[]`, que
// es donde viene el detalle de cada edición.
//
// Solo lectura: usa el alumno que creó (e inactivó) F3.
//
// La pestaña «Auditoría» está oculta mientras MOSTRAR_AUDITORIA sea false
// (src/config/funcionalidades.js, 8219262): la prueba lee esa misma constante
// y vuelve a correr sola cuando se active.
import { expect, test } from '@playwright/test'
import { MOSTRAR_AUDITORIA } from '../src/config/funcionalidades.js'
import { exigirEstadoDeF3 } from './support/estado.js'
import { evidencia } from './support/evidencia.js'
import { iniciarSesion, irPorMenu } from './support/sesion.js'

test('CU015 – historial registra la creación (D29)', async ({ page }) => {
  // Se salta a propósito: la pestaña Auditoría está oculta en la app hasta que la auditoría cubra todas las entidades.
  test.skip(!MOSTRAR_AUDITORIA, 'Pestaña «Auditoría» oculta: MOSTRAR_AUDITORIA = false en src/config/funcionalidades.js')
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
