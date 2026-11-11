// El Dashboard del Directivo, que es su pantalla de entrada.
//
// Decisión S36 (docs/decisiones-externas-y-pendientes-de-backend.md): el
// Directivo perdió su Inicio de tres tarjetas institucionales y aterriza en
// /dashboard, armado con UNA TARJETA POR MÓDULO. Para él las tarjetas informan
// pero no llevan al módulo: los cuatro son `[DIRECTIVO]: null` en la matriz.
import { expect } from '@playwright/test'

/** Las cuatro tarjetas, con el título del módulo tal como sale en el menú (S36). */
export const MODULOS_DEL_DASHBOARD = ['Asistencias', 'Seguimiento de Lectura', 'Rúbrica', 'Registro de Vuelo']

/** La tarjeta de un módulo: la sección cuyo título es el nombre del módulo. */
export const tarjetaDeModulo = (page, modulo) =>
  page
    .getByRole('main')
    .getByRole('heading', { name: modulo, exact: true, level: 3 })
    .locator('xpath=ancestor::section[1]')

/**
 * Espera el Dashboard del Directivo con sus cuatro tarjetas ya resueltas: cada
 * una termina de cargar y muestra su cifra, "Sin información" o el aviso de
 * la consulta (vacío, sin calendario o error). Los valores dependen del
 * calendario y de lo que hayan registrado otras pruebas: se valida la forma.
 */
export async function esperarDashboardDelDirectivo(page) {
  await expect(page.getByRole('main').getByRole('heading', { name: 'Dashboard del Directivo', level: 1 })).toBeVisible()
  for (const modulo of MODULOS_DEL_DASHBOARD) {
    const tarjeta = tarjetaDeModulo(page, modulo)
    await expect(tarjeta, `tarjeta «${modulo}»`).toBeVisible()
    // Mientras carga, BloqueDashboard pinta esqueletos (`animate-pulse`).
    await expect(tarjeta.locator('.animate-pulse'), `«${modulo}» terminó de cargar`).toHaveCount(0)
  }
}
