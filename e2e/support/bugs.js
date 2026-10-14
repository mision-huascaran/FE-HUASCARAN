// Bugs conocidos que algunos flujos tienen que rodear para poder seguir.
//
// Cada rodeo deja una anotación `bug` en el reporte (testInfo.annotations), con
// el nombre del bug, para que quede en la evidencia y no pase desapercibido.
import { expect, test } from '@playwright/test'
import { SEED } from './cuentas.js'

export const BUGS = {
  FORMULARIO_SE_VACIA:
    'Formulario de mantenimiento se vacía al volver a renderizarse (PopupMantenimiento repone `inicial` cuando cambian `campos`)',
  POPUP_NO_SE_CIERRA: 'Popup «Nuevo» no se cierra tras guardar con éxito (riesgo de alta duplicada)',
}

export function anotarBug(bug, rodeo) {
  test.info().annotations.push({ type: 'bug', description: `${bug}. Rodeo en la prueba: ${rodeo}` })
}

/** Espera la respuesta de cada llamada /api que la página ya hizo. */
async function respuestasPendientes(page) {
  const pedidas = (await page.requests()).filter((r) => new URL(r.url()).pathname.startsWith('/api/'))
  await Promise.all(pedidas.map((r) => r.response().catch(() => null)))
}

/**
 * `guardadoEn` de la precarga offline (idb-keyval: base `keyval-store`, almacén
 * `keyval`, clave `sicedu.precarga`) y el inicio de la actividad abierta
 * (`sicedu.actividad` en sessionStorage). No abre la base si todavía no existe:
 * crearla vacía rompería la que idb-keyval crea después.
 */
const leerPrecargaYActividad = () =>
  new Promise((resolver) => {
    const actividad = JSON.parse(sessionStorage.getItem('sicedu.actividad') ?? 'null')
    const fin = (guardadoEn) => resolver({ guardadoEn, inicio: actividad?.inicio ?? null })
    indexedDB.databases().then((bases) => {
      if (!bases.some((b) => b.name === 'keyval-store')) return fin(null)
      const apertura = indexedDB.open('keyval-store')
      apertura.onerror = () => fin(null)
      apertura.onsuccess = () => {
        const base = apertura.result
        if (!base.objectStoreNames.contains('keyval')) {
          base.close()
          return fin(null)
        }
        const lectura = base.transaction('keyval').objectStore('keyval').get('sicedu.precarga')
        lectura.onsuccess = () => {
          base.close()
          fin(lectura.result?.guardadoEn ?? null)
        }
        lectura.onerror = () => {
          base.close()
          fin(null)
        }
      }
    }, () => fin(null))
  })

/**
 * BUGS.FORMULARIO_SE_VACIA: el popup se vacía cada vez que la pantalla se
 * vuelve a renderizar. Antes de abrirlo se espera a que la pantalla termine de
 * cargar de verdad, con condiciones concretas:
 *
 *   1. La tabla (o su vacío) y el filtro Colegio con el colegio E2E: llegaron
 *      la lista, los catálogos y, para el Docente, sus asignaciones.
 *   2. Con una actividad abierta (Docente), la precarga offline de ESA
 *      actividad ya está guardada; si se guardó durante la espera, también la
 *      nueva consulta de alumnos que dispara.
 *   3. Respondieron todas las llamadas /api que la pantalla ya hizo (p. ej. los
 *      catálogos que se vuelven a pedir tras una inactivación).
 *
 * Después cada flujo comprueba lo escrito con toHaveValue antes de guardar: si
 * aun así se vaciara, la prueba falla en esa comprobación.
 */
export async function esperarAntesDeAbrirPopup(page) {
  anotarBug(BUGS.FORMULARIO_SE_VACIA, 'esperar a que la pantalla termine de cargar antes de abrir el popup y comprobar lo escrito antes de guardar')

  const principal = page.getByRole('main')
  await expect(principal.getByRole('table').or(principal.getByText('Sin registros'))).toBeVisible()
  await expect(principal.getByLabel('Colegio', { exact: true }).getByRole('option', { name: SEED.colegio })).toBeAttached()

  if (await page.getByRole('button', { name: 'Finalizar actividad' }).isVisible()) {
    const guardada = ({ guardadoEn, inicio }) => Boolean(guardadoEn && inicio && guardadoEn >= inicio)
    const antes = await page.evaluate(leerPrecargaYActividad)
    // La consulta de alumnos lleva en su clave si hay precarga: solo si la
    // precarga pasa de no existir a existir se vuelve a pedir la lista.
    const vuelvePedirLista = !antes.guardadoEn
    const consulta = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/alumnos' && r.request().method() === 'GET')
    await expect
      .poll(async () => guardada(await page.evaluate(leerPrecargaYActividad)), {
        message: 'la precarga offline de la actividad abierta se guarda',
      })
      .toBe(true)
    if (vuelvePedirLista) await consulta
    else consulta.catch(() => null)
  }

  await respuestasPendientes(page)
}

/**
 * BUGS.POPUP_NO_SE_CIERRA: Mantenimiento.jsx solo cierra el popup con
 * «Cancelar» o la X. Si sigue abierto se anota y se cierra a mano; si ya se
 * corrigió, no hace nada.
 */
export async function cerrarPopupTrasGuardar(popup) {
  if (!(await popup.isVisible())) return
  anotarBug(BUGS.POPUP_NO_SE_CIERRA, 'cerrarlo con «Cancelar» después de comprobar el alta')
  await popup.getByRole('button', { name: 'Cancelar' }).click()
  await expect(popup).toBeHidden()
}
