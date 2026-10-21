// F1 — Acceso por rol (CU001, CU002, CU003, CU010, CU011, CU012).
//
// Cada rol entra y llega a SU Inicio. La cuenta desactivada se rechaza sin
// emitir token. Sin reintentos: cada intento fallido suma al bloqueo de 5
// intentos en 15 minutos (CU002), que solo se limpia en el próximo despliegue.
import { expect, test } from '@playwright/test'
import { SEED } from './support/cuentas.js'
import { evidencia } from './support/evidencia.js'
import { CLAVE_TOKEN, enviarLogin, iniciarSesion, leerToken } from './support/sesion.js'
import { tarjetas, valorDeTarjeta } from './support/tarjetas.js'

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

  test('Supervisora: llega a Inicio con las tarjetas del resumen operativo y sus alertas (CU011)', async ({ page }) => {
    await iniciarSesion(page, 'supervisor')

    await expect(page.getByRole('heading', { name: 'Inicio', level: 1 })).toBeVisible()
    // Se valida la FORMA, no los números: dependen del calendario real
    // (periodo vigente, días de clase vencidos) y de lo que hagan otras pruebas.
    for (const etiqueta of [
      'Colegios registrados',
      'Docentes activos',
      'Con actividad en curso',
      'Registros vencidos',
      'Registros incompletos',
    ]) {
      await expect(valorDeTarjeta(page, etiqueta), `valor de «${etiqueta}»`).toHaveText(/^\d+$/)
    }
    // El seed garantiza al menos el colegio E2E activo.
    expect(Number(await valorDeTarjeta(page, 'Colegios registrados').innerText())).toBeGreaterThanOrEqual(1)

    // Alertas operativas: o la lista, con cada alerta redactada, o el aviso de
    // que no hay ninguna.
    const alertas = page.getByRole('list', { name: 'Alertas operativas' })
    const sinAlertas = page.getByText('No existen alertas operativas pendientes de atención.', { exact: true })
    await expect(alertas.or(sinAlertas)).toBeVisible()
    if (await alertas.isVisible()) {
      const items = alertas.getByRole('listitem')
      expect(await items.count(), 'alertas en la lista').toBeGreaterThan(0)
      for (const texto of await items.allInnerTexts()) expect(texto.trim(), 'mensaje de la alerta').not.toBe('')
    }

    // La Supervisora no abre actividades: ese botón es del Docente.
    await expect(page.getByRole('button', { name: 'Iniciar actividad' })).toHaveCount(0)
    await evidencia(page, 'inicio-supervisora')
  })

  test('Directivo: llega a Inicio con sus 2 tarjetas institucionales (CU012)', async ({ page }) => {
    await iniciarSesion(page, 'directivo')

    // CU012: 'Salud del sistema' retirada a pedido de QA (oct-2026); el CU aún la lista, pendiente de actualizar por analistas.
    await expect(tarjetas(page)).toHaveCount(2)
    for (const etiqueta of ['Total de beneficiarios activos', 'Total de colegios operando']) {
      await expect(valorDeTarjeta(page, etiqueta), `valor de «${etiqueta}»`).not.toBeEmpty()
    }
    await expect(page.getByRole('button', { name: 'Iniciar actividad' })).toHaveCount(0)
    await evidencia(page, 'inicio-directivo')
  })

  // test.fail(): HOY FALLA A PROPÓSITO. En qa, el 403 de la cuenta desactivada
  // llega con el cuerpo "Error" (text/plain) en vez del JSON del backend con
  // `motivo: cuenta_desactivada`. Lo reemplaza el Caddy del servidor: esa
  // respuesta no trae ninguna cabecera de nuestro Nginx (que las pone con
  // `always`), y directo al backend el error sí llega en JSON. Sin `detail`, la
  // UI muestra «Sin permiso para realizar esta acción» en vez del mensaje de
  // CU002. Cuando se corrija, Playwright avisará «expected to fail, but
  // passed»: entonces hay que quitar el test.fail().
  test('Cuenta inactiva: se rechaza con el mensaje de CU002 y sin token', async ({ page }) => {
    const bug =
      '[bug] El Caddy del servidor reemplaza el cuerpo de los errores de /api por "Error" (text/plain): ' +
      'el 403 de cuenta desactivada llega sin JSON y la UI muestra «Sin permiso para realizar esta acción» ' +
      'en vez del mensaje de CU002'
    test.fail(true, bug)
    test.info().annotations.push({ type: 'bug', description: bug })

    const respuesta = await enviarLogin(page, 'inactivo')

    // CU002 cuenta el login a una cuenta desactivada como intento fallido: tras
    // 5 seguidos el correo queda bloqueado 15 minutos y responde 429. Eso no es
    // un fallo de la app sino de este entorno de prueba (corridas previas sobre
    // la misma cuenta), así que se salta en vez de fallar. El seed limpia el
    // bloqueo en cada despliegue de qa.
    if (respuesta.status() === 429) {
      const razon = 'Cuenta inactivo bloqueada por intentos previos (CU002, 5 en 15 min); reintentar luego de 15 minutos'
      test.info().annotations.push({ type: 'limpieza', description: razon })
      await evidencia(page, 'login-cuenta-inactiva-bloqueada')
      test.skip(true, razon)
    }

    expect(respuesta.status(), 'una cuenta desactivada responde 403').toBe(403)
    const cuerpo = await respuesta.json().catch(() => null)
    expect(cuerpo, 'el 403 trae el JSON del backend, no el cuerpo de un proxy').not.toBeNull()
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
