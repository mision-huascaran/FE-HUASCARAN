// F10 · La CSP no rompe la aplicación en el navegador.
//
// El stage 'Security Headers - CSP' comprueba la cabecera por HTTP; esto
// comprueba su efecto: recorre login, recuperar contraseña y las pantallas a
// las que llegan los demás flujos, y falla con cualquier violación de CSP
// (evento securitypolicyviolation), mensaje de CSP en la consola o petición
// bloqueada por la política. Solo navega: no crea ni modifica datos.
import { expect, test } from '@playwright/test'
import { cerrarSesion, iniciarSesion, irPorMenu } from './support/sesion.js'
import { valorDeTarjeta } from './support/tarjetas.js'

const titulo = (page, nombre) => page.getByRole('main').getByRole('heading', { name: nombre, level: 1 })

/**
 * Pantalla con tabla ya cargada: su título y la tabla o su vacío (mientras
 * carga, DataTable muestra un esqueleto). Es la condición de esperarAntesDeAbrirPopup.
 */
async function conTabla(page, nombre, vacio = 'Sin registros') {
  const principal = page.getByRole('main')
  await expect(titulo(page, nombre)).toBeVisible()
  await expect(principal.getByRole('table').or(principal.getByText(vacio, { exact: true })).first()).toBeVisible()
}

/**
 * Pantallas por rol, las mismas a las que llegan F1–F9 (más Colegios, también
 * real), cada una con su señal de carga: la que usan F1 y F5 en los Inicio, y
 * el título con su tabla en las demás.
 */
const PANTALLAS = {
  docente: {
    inicio: (page) => expect(page.getByRole('heading', { name: 'Mis asignaciones' })).toBeVisible(),
    menu: [
      ['Alumnos', '/alumnos', (page) => conTabla(page, 'Alumnos')],
      ['Asistencia', '/asistencia', (page) => expect(titulo(page, 'Asistencia')).toBeVisible()],
      ['Sesiones', '/sesiones', (page) => conTabla(page, 'Sesiones', 'No existen sesiones para consultar')],
    ],
  },
  supervisor: {
    inicio: (page) => expect(valorDeTarjeta(page, 'Colegios registrados')).toHaveText(/^\d+$/),
    menu: [
      ['Alumnos', '/alumnos', (page) => conTabla(page, 'Alumnos')],
      ['Usuarios', '/usuarios', (page) => conTabla(page, 'Usuarios')],
      ['Colegios', '/colegios', (page) => conTabla(page, 'Colegios')],
      ['Seguimiento', '/seguimiento', (page) => conTabla(page, 'Seguimiento')],
    ],
  },
  directivo: {
    // El valor de una tarjeta y no cuántas hay: el conteo lo validan F1 y F5.
    inicio: (page) => expect(valorDeTarjeta(page, 'Total de beneficiarios activos')).toHaveText(/^\d+$/),
    menu: [],
  },
}

/**
 * Las fuentes y las imágenes terminaron de cargar (o de fallar): son lo que una
 * CSP mala bloquearía sin romper la pantalla, así que sus violaciones ya se
 * registraron cuando esto vuelve.
 */
async function esperarFuentesEImagenes(page) {
  expect(await page.evaluate(async () => (await document.fonts.ready).status)).toBe('loaded')
  await expect
    .poll(() => page.evaluate(() => [...document.images].every((imagen) => imagen.complete)), {
      message: 'las imágenes terminaron de cargar',
    })
    .toBe(true)
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

test.describe('F10 · CSP en el navegador', () => {
  test('sin sesión: login y recuperar contraseña', async ({ page }) => {
    const problemas = await vigilarCsp(page)

    await page.goto('/login')
    await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible()
    await esperarFuentesEImagenes(page)
    await page.getByRole('button', { name: '¿Olvidó su contraseña?' }).click()
    await expect(page.getByText('Recuperar contraseña')).toBeVisible()
    await esperarFuentesEImagenes(page)

    expect(problemas, 'sin violaciones de CSP').toEqual([])
  })

  for (const [rol, { inicio, menu }] of Object.entries(PANTALLAS)) {
    test(`${rol}: Inicio y sus pantallas`, async ({ page }) => {
      const problemas = await vigilarCsp(page)

      await iniciarSesion(page, rol)
      await inicio(page)
      await esperarFuentesEImagenes(page)
      for (const [etiqueta, ruta, lista] of menu) {
        await irPorMenu(page, etiqueta, ruta)
        await lista(page)
        await esperarFuentesEImagenes(page)
      }
      await cerrarSesion(page)

      expect(problemas, 'sin violaciones de CSP').toEqual([])
    })
  }
})
