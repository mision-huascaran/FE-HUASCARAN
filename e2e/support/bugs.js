// Bugs conocidos que algunos flujos tienen que rodear para poder seguir.
//
// Cada rodeo deja una anotación `bug` en el reporte (testInfo.annotations), con
// el nombre del bug, para que quede en la evidencia y no pase desapercibido.
import { expect, test } from '@playwright/test'

export const BUGS = {
  FORMULARIO_SE_VACIA:
    'Formulario de mantenimiento se vacía al volver a renderizarse (PopupMantenimiento repone `inicial` cuando cambian `campos`)',
  POPUP_NO_SE_CIERRA: 'Popup «Nuevo» no se cierra tras guardar con éxito (riesgo de alta duplicada)',
}

export function anotarBug(bug, rodeo) {
  test.info().annotations.push({ type: 'bug', description: `${bug}. Rodeo en la prueba: ${rodeo}` })
}

/**
 * BUGS.FORMULARIO_SE_VACIA: antes de abrir el popup se espera a que la red
 * quede quieta (precarga, catálogos), como haría quien espera a que la pantalla
 * termine de cargar. Después de llenarlo, cada flujo comprueba lo escrito.
 */
export async function esperarAntesDeAbrirPopup(page) {
  anotarBug(BUGS.FORMULARIO_SE_VACIA, 'esperar a que la red quede quieta antes de abrir el popup y comprobar lo escrito antes de guardar')
  await page.waitForLoadState('networkidle')
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
