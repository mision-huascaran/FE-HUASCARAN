// F1 — Acceso por rol (CU001, CU002, CU003, CU010, CU011, CU012).
//
// Cada rol entra y llega a SU Inicio. La cuenta desactivada se rechaza sin
// emitir token. Sin reintentos: cada intento fallido suma al bloqueo de 5
// intentos en 15 minutos (CU002), que solo se limpia en el próximo despliegue.
import { expect, test } from '@playwright/test'
import { SEED } from './support/cuentas.js'
import { evidencia } from './support/evidencia.js'
import { CLAVE_TOKEN, enviarLogin, iniciarSesion, leerToken } from './support/sesion.js'
import { tarjeta, tarjetas, valorDeTarjeta } from './support/tarjetas.js'

test.describe.configure({ retries: 0 })

test.describe('F1 · Acceso por rol (CU001–CU003, CU010–CU012)', () => {
  test('Docente: llega a Inicio con sus asignaciones y el botón de actividad (CU010)', async ({ page }) => {
    await iniciarSesion(page, 'docente')

    const asignaciones = page.getByRole('heading', { name: 'Mis asignaciones' }).locator('xpath=ancestor::section[1]')
    await expect(asignaciones).toBeVisible()
    await expect(asignaciones).toContainText(SEED.colegio)
    await expect(page.getByRole('button', { name: /^(Iniciar|Finalizar) actividad$/ })).toBeVisible()
    expect(await leerToken(page), 'el token queda en sessionStorage').toBeTruthy()
    await evidencia(page, 'inicio-docente')
  })

  test('Supervisora: llega a Inicio con las tarjetas del resumen operativo (CU011)', async ({ page }) => {
    await iniciarSesion(page, 'supervisor')

    await expect(page.getByRole('heading', { name: 'Inicio', level: 1 })).toBeVisible()
    for (const etiqueta of [
      'Colegios registrados',
      'Docentes activos',
      'Con actividad en curso',
      'Registros pendientes',
      'Registros incompletos',
    ]) {
      await expect(tarjeta(page, etiqueta), `tarjeta «${etiqueta}»`).toBeVisible()
    }
    // El seed garantiza al menos el colegio E2E activo y el Docente E2E activo.
    expect(Number(await valorDeTarjeta(page, 'Colegios registrados').innerText())).toBeGreaterThanOrEqual(1)
    expect(Number(await valorDeTarjeta(page, 'Docentes activos').innerText())).toBeGreaterThanOrEqual(1)
    // La Supervisora no abre actividades: ese botón es del Docente.
    await expect(page.getByRole('button', { name: 'Iniciar actividad' })).toHaveCount(0)
    await evidencia(page, 'inicio-supervisora')
  })

  test('Directivo: llega a Inicio con sus 3 tarjetas institucionales (CU012)', async ({ page }) => {
    await iniciarSesion(page, 'directivo')

    await expect(tarjetas(page)).toHaveCount(3)
    for (const etiqueta of ['Total de beneficiarios activos', 'Total de colegios operando', 'Salud del sistema']) {
      await expect(valorDeTarjeta(page, etiqueta), `valor de «${etiqueta}»`).not.toBeEmpty()
    }
    await expect(page.getByRole('button', { name: 'Iniciar actividad' })).toHaveCount(0)
    await evidencia(page, 'inicio-directivo')
  })

  test('Cuenta inactiva: se rechaza con el mensaje de CU002 y sin token', async ({ page }) => {
    const respuesta = await enviarLogin(page, 'inactivo')

    expect(respuesta.status(), 'una cuenta desactivada responde 403').toBe(403)
    const cuerpo = await respuesta.json()
    expect(cuerpo).not.toHaveProperty('access_token')
    expect(cuerpo.motivo).toBe('cuenta_desactivada')

    await expect(page.getByRole('alert')).toHaveText(
      'Su cuenta se encuentra desactivada. Comuníquese con el Supervisor para solicitar su habilitación.',
    )
    await expect(page).toHaveURL(/\/login$/)
    expect(await page.evaluate((clave) => sessionStorage.getItem(clave), CLAVE_TOKEN)).toBeNull()
    await evidencia(page, 'login-cuenta-inactiva')
  })
})
