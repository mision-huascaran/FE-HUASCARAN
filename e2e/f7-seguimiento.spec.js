// F7 — Seguimiento de docentes (CU020, CU021).
//
// La Supervisora encuentra al Docente E2E conectado hoy y, en su bitácora, la
// actividad que hizo F3 con su cierre manual.
import { expect, test } from '@playwright/test'
import { SEED } from './support/cuentas.js'
import { exigirEstadoDeF3 } from './support/estado.js'
import { evidencia } from './support/evidencia.js'
import { fechaHoraLima, hoyLima } from './support/fechas.js'
import { iniciarSesion, irPorMenu } from './support/sesion.js'

test('F7 · Seguimiento: el Docente E2E aparece conectado hoy y con la actividad de F3 (CU020, CU021)', async ({ page }) => {
  const { idActividad, inicioActividad } = exigirEstadoDeF3('idActividad', 'inicioActividad')

  await iniciarSesion(page, 'supervisor')
  await irPorMenu(page, 'Seguimiento', '/seguimiento')

  const fila = page.getByRole('row').filter({ hasText: SEED.docente })

  await test.step('El Docente E2E, con su colegio y su última conexión de hoy (CU020)', async () => {
    await page.getByLabel('Colegio').selectOption({ label: SEED.colegio })
    // Seguimiento filtra al pulsar, no al cambiar el control.
    await page.getByRole('button', { name: 'Filtrar' }).click()
    await expect(fila).toHaveCount(1)
    await expect(fila).toContainText(SEED.colegio)
    // Columnas: Docente, Colegios asignados, Última conexión, Sincronización, Pendientes.
    await expect(fila.getByRole('cell').nth(2), 'última conexión').toContainText(hoyLima())
    await evidencia(page, 'seguimiento-docente-e2e')
  })

  await test.step('En su bitácora está la actividad de F3, cerrada a mano (CU021)', async () => {
    const bitacora = page.waitForResponse((r) => /\/api\/seguimiento\/docentes\/\d+\/actividades$/.test(new URL(r.url()).pathname))
    await fila.getByRole('button', { name: 'Ver detalle' }).click()
    const items = (await (await bitacora).json()).items ?? []
    expect(items.map((a) => a.id), 'actividades que devuelve el backend').toContain(idActividad)

    await expect(page.getByRole('heading', { name: SEED.docente, level: 1 })).toBeVisible()
    // La tabla no muestra el id: se reconoce por su hora de inicio.
    // La tabla no muestra el id: se reconoce por su hora de inicio y su cierre.
    // Solo la hora no basta: F6 puede abrir otra sesión en el mismo minuto.
    const sesion = page
      .getByRole('row')
      .filter({ hasText: fechaHoraLima(inicioActividad) })
      .filter({ hasText: 'Manual por finalización de actividad' })
    await expect(sesion.first()).toBeVisible()
    await evidencia(page, 'seguimiento-bitacora')
  })
})
