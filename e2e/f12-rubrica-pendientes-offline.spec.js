// F12 — Rúbrica: lo editado sin conexión no desaparece al reconectar (CU029).
//
// Se cambia la Fluidez de un alumno sin red. Al reconectar el servidor
// responde 500 a ese envío (queda en la cola reintentando): la tabla se
// refresca sola con lo que tiene el servidor, y tiene que seguir mostrando el
// valor nuevo con su indicador, no el viejo. Lo mismo al salir del módulo y
// volver con conexión mientras siga pendiente.
//
// Al final se deja la fila como estaba.
import { expect, test } from '@playwright/test'
import { cerrarActividadPendiente, exigirPeriodoVigente, finalizarActividad, iniciarActividad } from './support/actividad.js'
import { elegirGrupo } from './support/grupo.js'
import { esApi, iniciarSesion, irPorMenu } from './support/sesion.js'

const INDICADOR = /Pendiente de sincronizar|Error al sincronizar/
const badge = (page) => page.getByRole('button', { name: /^Estado de sincronización:/ })

/**
 * Espera a que la cola se vacíe. Si ya agotó sus reintentos automáticos (el
 * indicador dice "sin enviar"), los relanza desde el panel de sincronización.
 */
async function esperarSincronizado(page) {
  if (/sin enviar/.test((await badge(page).getAttribute('aria-label')) ?? '')) {
    await badge(page).click()
    await page.getByRole('button', { name: 'Reintentar ahora' }).click()
    await page.getByRole('button', { name: 'Cerrar', exact: true }).click()
  }
  await expect(badge(page)).toHaveAccessibleName(/Todo sincronizado/, { timeout: 30_000 })
}

test('F12 · Rúbrica: lo editado sin conexión sigue en la tabla al reconectar con el servidor fallando y al volver al módulo (CU029)', async ({ page, context }) => {
  test.setTimeout(240_000)
  const { inicio } = await iniciarSesion(page, 'docente')
  await exigirPeriodoVigente(page, inicio)
  await cerrarActividadPendiente(page, inicio)
  await iniciarActividad(page)
  await irPorMenu(page, 'Rúbrica', '/rubrica')

  const cargada = page.waitForResponse((r) => esApi(r, '/rubricas') && r.ok())
  await elegirGrupo(page, { grado: '1.º' })
  await cargada
  await expect(page.getByRole('heading', { name: /^\d+ alumnos?$/ })).toBeVisible()

  const fluidez = page.getByRole('combobox', { name: /^Fluidez de / }).first()
  // Se salta a propósito: el Docente E2E solo escribe en la Rúbrica si tiene habilitación y el calendario lo permite este mes; si no, no hay qué probar sin conexión.
  test.skip(await fluidez.isDisabled(), 'El Docente E2E no puede escribir en la Rúbrica de este mes (habilitación o calendario)')
  const nombre = (await fluidez.getAttribute('aria-label')).replace(/^Fluidez de /, '')
  const campo = page.getByRole('combobox', { name: `Fluidez de ${nombre}`, exact: true })
  const fila = page.getByRole('row').filter({ has: campo })
  const original = await campo.inputValue()
  const valores = await campo.locator('option').evaluateAll((opciones) => opciones.map((o) => o.value).filter(Boolean))
  const nuevo = valores.find((v) => v !== original)

  await test.step('Sin conexión: cambiar la Fluidez', async () => {
    await context.setOffline(true)
    await campo.selectOption(nuevo)
    await expect(campo).toHaveValue(nuevo)
  })

  // El servidor falla los envíos de la Rúbrica: la operación queda en la cola.
  await page.route('**/api/rubricas**', (route) =>
    route.request().method() === 'PUT' ? route.fulfill({ status: 500, body: '{"detail":"Error simulado"}' }) : route.continue(),
  )

  await test.step('Al reconectar con el servidor respondiendo 500, la tabla sigue con el valor nuevo', async () => {
    const refresco = page.waitForResponse((r) => esApi(r, '/rubricas') && r.ok())
    const fallo = page.waitForResponse((r) => esApi(r, '/rubricas', 'PUT') && r.status() === 500)
    await context.setOffline(false)
    await refresco
    await fallo
    await expect(campo, 'sigue el valor editado sin conexión').toHaveValue(nuevo)
    await expect(fila.getByText(INDICADOR)).toBeVisible()
  })

  await test.step('Salir y volver con conexión, todavía pendiente: sigue el valor nuevo', async () => {
    await irPorMenu(page, 'Alumnos', '/alumnos')
    const refresco = page.waitForResponse((r) => esApi(r, '/rubricas') && r.ok())
    await irPorMenu(page, 'Rúbrica', '/rubrica')
    await refresco
    await expect(campo).toHaveValue(nuevo)
    await expect(fila.getByText(INDICADOR)).toBeVisible()
  })

  await test.step('El servidor se recupera: se sincroniza y la fila queda confirmada', async () => {
    await page.unroute('**/api/rubricas**')
    await esperarSincronizado(page)
    await expect(campo).toHaveValue(nuevo)
    await expect(fila.getByText(INDICADOR)).toHaveCount(0)
  })

  await test.step('Dejar la fila como estaba', async () => {
    await campo.selectOption(original)
    await expect(badge(page)).toHaveAccessibleName(/Todo sincronizado/, { timeout: 30_000 })
  })
  await finalizarActividad(page)
})
