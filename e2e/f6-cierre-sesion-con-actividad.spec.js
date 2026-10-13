// F6 — Cierre de sesión con actividad abierta (CU007, CU008, CU009).
//
// Cerrar sesión con una actividad en curso: el servidor la finaliza como
// «Forzado por cierre de sesión», el token muere al instante y el navegador no
// conserva nada de la sesión (RNF-003).
import { expect, test } from '@playwright/test'
import {
  abrirDetalleDeSesion,
  cerrarActividadPendiente,
  dato,
  exigirPeriodoVigente,
  iniciarActividad,
} from './support/actividad.js'
import { evidencia } from './support/evidencia.js'
import { CLAVE_TOKEN, cerrarSesion, iniciarSesion, irPorMenu, leerToken } from './support/sesion.js'

test('F6 · Cerrar sesión con una actividad abierta la fuerza a cerrar e invalida el token (CU007, CU008, CU009)', async ({ page }) => {
  const { inicio } = await iniciarSesion(page, 'docente')
  await exigirPeriodoVigente(page, inicio)
  await cerrarActividadPendiente(page, inicio)

  const actividad = await iniciarActividad(page)
  const tokenAnterior = await leerToken(page)
  expect(tokenAnterior, 'hay token antes de salir').toBeTruthy()
  await evidencia(page, 'actividad-abierta-antes-de-salir')

  await test.step('Cerrar sesión lleva al login (CU008)', async () => {
    // Una pantalla protegida en el historial, para que «atrás» tenga adónde
    // volver: la app navega con `replace` y si no, atrás sale de la aplicación.
    await irPorMenu(page, 'Alumnos', '/alumnos')
    const salida = await cerrarSesion(page)
    expect(salida.status(), 'POST /logout').toBeLessThan(300)
    await evidencia(page, 'login-tras-cerrar-sesion')
  })

  await test.step('El navegador no conserva la sesión (RNF-003)', async () => {
    const almacenamiento = await page.evaluate((clave) => ({
      local: Object.keys(localStorage),
      token: sessionStorage.getItem(clave),
      actividad: sessionStorage.getItem('sicedu.actividad'),
    }), CLAVE_TOKEN)
    expect(almacenamiento.local, 'claves en Local Storage').toEqual([])
    expect(almacenamiento.token, 'sicedu.token en sessionStorage').toBeNull()
    expect(almacenamiento.actividad, 'sicedu.actividad en sessionStorage').toBeNull()
  })

  await test.step('Atrás y /inicio vuelven al login', async () => {
    await page.goBack()
    await expect(page).toHaveURL(/\/login$/)
    await page.goto('/inicio')
    await expect(page).toHaveURL(/\/login$/)
    await evidencia(page, 'inicio-redirige-a-login')
  })

  await test.step('El token anterior ya no sirve: /api/me responde 401', async () => {
    const me = await page.request.get('/api/me', { headers: { Authorization: `Bearer ${tokenAnterior}` } })
    expect(me.status()).toBe(401)
  })

  await test.step('Al volver a entrar, Sesiones la muestra «Forzado por cierre de sesión» (CU009, CU017)', async () => {
    await iniciarSesion(page, 'docente')
    await irPorMenu(page, 'Sesiones', '/sesiones')
    const detalle = await abrirDetalleDeSesion(page, actividad.id)
    await expect(dato(detalle, 'Estado')).toHaveText('Finalizada')
    await expect(dato(detalle, 'Tipo de cierre')).toHaveText('Forzado por cierre de sesión')
    await evidencia(page, 'sesion-forzada')
  })
})
