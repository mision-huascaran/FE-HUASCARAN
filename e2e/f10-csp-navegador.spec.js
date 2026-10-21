// F10 · La CSP no rompe la aplicación en el navegador.
//
// El stage 'Security Headers - CSP' comprueba la cabecera por HTTP; esto
// comprueba su efecto: recorre login, recuperar contraseña y las pantallas a
// las que llegan los demás flujos, y falla con cualquier violación de CSP
// (evento securitypolicyviolation), mensaje de CSP en la consola o petición
// bloqueada por la política. Solo navega: no crea ni modifica datos.
import { expect, test } from '@playwright/test'
import { cerrarSesion, iniciarSesion, irPorMenu } from './support/sesion.js'

/** Pantallas por rol, las mismas a las que llegan F1–F9 (más Colegios, también real). */
const PANTALLAS = {
  docente: [
    ['Alumnos', '/alumnos'],
    ['Asistencia', '/asistencia'],
    ['Sesiones', '/sesiones'],
  ],
  supervisor: [
    ['Alumnos', '/alumnos'],
    ['Usuarios', '/usuarios'],
    ['Colegios', '/colegios'],
    ['Seguimiento', '/seguimiento'],
  ],
  directivo: [],
}

/**
 * Junta los problemas de CSP de toda la prueba. El aviso del evento llega por
 * exposeFunction, que sigue funcionando después de navegar; el listener se
 * instala en cada documento antes de que cargue la aplicación.
 */
async function vigilarCsp(page) {
  const problemas = []
  await page.exposeFunction('__avisarViolacionCsp', (texto) => problemas.push(`violación: ${texto}`))
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      window.__avisarViolacionCsp(
        `${e.effectiveDirective} bloqueó ${e.blockedURI || '(en línea)'} en ${e.sourceFile || 'el documento'}:${e.lineNumber}`,
      )
    })
  })
  page.on('console', (mensaje) => {
    if (/Content[- ]Security[- ]Policy/i.test(mensaje.text())) problemas.push(`consola: ${mensaje.text()}`)
  })
  page.on('requestfailed', (peticion) => {
    const motivo = peticion.failure()?.errorText ?? ''
    if (/csp/i.test(motivo)) problemas.push(`bloqueada: ${peticion.url()} (${motivo})`)
  })
  return problemas
}

/** Espera a que la pantalla termine de pedir lo suyo (chunks, fuentes, /api). */
async function esperarPantalla(page) {
  await expect(page.getByRole('main')).toBeVisible()
  await page.waitForLoadState('networkidle')
}

test.describe('F10 · CSP en el navegador', () => {
  test('sin sesión: login y recuperar contraseña', async ({ page }) => {
    const problemas = await vigilarCsp(page)

    await page.goto('/login')
    await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible()
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: '¿Olvidó su contraseña?' }).click()
    await expect(page.getByText('Recuperar contraseña')).toBeVisible()
    await page.waitForLoadState('networkidle')

    expect(problemas, 'sin violaciones de CSP').toEqual([])
  })

  for (const [rol, pantallas] of Object.entries(PANTALLAS)) {
    test(`${rol}: Inicio y sus pantallas`, async ({ page }) => {
      const problemas = await vigilarCsp(page)

      await iniciarSesion(page, rol)
      await esperarPantalla(page)
      for (const [etiqueta, ruta] of pantallas) {
        await irPorMenu(page, etiqueta, ruta)
        await esperarPantalla(page)
      }
      await cerrarSesion(page)

      expect(problemas, 'sin violaciones de CSP').toEqual([])
    })
  }
})
