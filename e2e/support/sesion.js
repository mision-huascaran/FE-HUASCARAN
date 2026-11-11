// Inicio y cierre de sesión por rol.
//
// El token vive en sessionStorage (`sicedu.token`), así que storageState no
// sirve: cada prueba inicia sesión desde la pantalla de login.
//
// LA CONTRASEÑA NO PASA POR EL NAVEGADOR. Con trace, video y capturas en
// "on", lo que se escribe en el formulario y el cuerpo de `POST /api/login`
// quedarían guardados en los artifacts de Jenkins. Por eso el navegador escribe
// un marcador y la petición se reenvía desde Node con la contraseña real (Node
// no queda en el trace). La respuesta del backend se devuelve tal cual: estado,
// cuerpo y mensajes son los reales.
import { expect } from '@playwright/test'
import { cuentaDe } from './cuentas.js'

export const MARCADOR_PASSWORD = 'oculta-por-e2e'
/**
 * Marcador para la contraseña NUEVA del primer ingreso. Cumple la política de
 * CU006 (mayúscula, minúscula, número y especial) porque el modal no habilita
 * «Establecer y entrar» hasta que la cumple.
 */
export const MARCADOR_PASSWORD_NUEVA = 'Marcador-E2E-1'
export const CLAVE_TOKEN = 'sicedu.token'

export const esApi = (respuesta, ruta, metodo = 'GET') =>
  new URL(respuesta.url()).pathname === `/api${ruta}` && respuesta.request().method() === metodo

/**
 * Intercepta un POST y lo reenvía desde Node con `cambios` aplicados al cuerpo
 * JSON. Lo que el navegador mandó (marcadores) es lo único que queda en el
 * trace; la respuesta del backend se devuelve tal cual.
 */
async function reenviarDesdeNode(page, patron, cambiar) {
  await page.route(
    patron,
    async (route) => {
      const peticion = route.request()
      if (peticion.method() !== 'POST') return route.continue()
      const respuesta = await fetch(peticion.url(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cambiar(peticion.postDataJSON() ?? {})),
      })
      return route.fulfill({
        status: respuesta.status,
        contentType: respuesta.headers.get('content-type') ?? 'application/json',
        body: await respuesta.text(),
      })
    },
    { times: 1 },
  )
}

/** Reenvía el `POST /api/login` desde Node con la contraseña real. */
const sustituirPassword = (page, password) =>
  reenviarDesdeNode(page, '**/api/login', (cuerpo) => ({ ...cuerpo, password }))

/**
 * Reenvía `POST /api/password/primer-ingreso` con las contraseñas reales. El
 * navegador escribió marcadores: la temporal sale del formulario de login (el
 * modal la reutiliza) y la nueva, del propio modal.
 */
export const sustituirPrimerIngreso = (page, { temporal, nueva }) =>
  reenviarDesdeNode(page, '**/api/password/primer-ingreso', (cuerpo) => ({
    ...cuerpo,
    'contraseña_temporal': temporal,
    'contraseña_nueva': nueva,
    'confirmar_contraseña_nueva': nueva,
  }))

/**
 * Llena y envía el formulario de login con unas credenciales dadas. Devuelve
 * la respuesta de `/api/login`. No comprueba el resultado.
 */
export async function enviarLoginCon(page, { usuario, password }) {
  await sustituirPassword(page, password)

  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible()
  await page.getByLabel('Correo', { exact: true }).fill(usuario)
  await page.getByLabel('Contraseña', { exact: true }).fill(MARCADOR_PASSWORD)

  const respuesta = page.waitForResponse((r) => esApi(r, '/login', 'POST'))
  await page.getByRole('button', { name: 'Ingresar' }).click()
  return respuesta
}

/** Igual, con la cuenta E2E de un rol (credenciales del entorno). */
export const enviarLogin = (page, rol) => enviarLoginCon(page, cuentaDe(rol))

/**
 * Dónde aterriza cada rol tras el login.
 *
 * El Directivo entra a /dashboard, no a /inicio: decisión S36 de
 * docs/decisiones-externas-y-pendientes-de-backend.md ("El Dashboard se rearma
 * por MÓDULO, y el Directivo pierde su Inicio"). Sus indicadores los da el
 * Dashboard, y la guarda de /inicio ya no lo admite.
 */
export const aterrizajeDe = (rol) => (rol === 'directivo' ? '/dashboard' : '/inicio')

/**
 * Inicia sesión y espera a estar en la pantalla de entrada del rol
 * (`aterrizajeDe`). Para el Docente devuelve además `GET /inicio/docente`
 * (asignaciones y actividad abierta), que deciden si se puede trabajar hoy.
 */
export async function iniciarSesion(page, rol) {
  const destino = aterrizajeDe(rol)
  const inicioDocente =
    rol === 'docente' ? page.waitForResponse((r) => esApi(r, '/inicio/docente') && r.ok()) : null

  // Tras el 200 la app pide GET /me antes de entrar: si no llega a su destino,
  // el error dice qué respondió /me y qué aviso quedó en el login, en vez de
  // solo «sigue en /login».
  const perfil = []
  const alResponder = (r) => esApi(r, '/me') && perfil.push(String(r.status()))
  const alFallar = (p) => new URL(p.url()).pathname === '/api/me' && perfil.push(`sin respuesta (${p.failure()?.errorText})`)
  page.on('response', alResponder)
  page.on('requestfailed', alFallar)
  try {
    const respuesta = await enviarLogin(page, rol)
    expect(respuesta.status(), `POST /login de la cuenta ${rol}`).toBe(200)
    try {
      await expect(page).toHaveURL((url) => url.pathname === destino)
    } catch (error) {
      const avisos = (await page.getByRole('alert').allInnerTexts()).join(' · ') || 'ninguno'
      error.message += `\n\nEl login de ${rol} respondió 200 pero la app no llegó a ${destino}. GET /api/me: ${perfil.join(', ') || 'sin respuesta todavía'}. Aviso en el login: «${avisos}»`
      throw error
    }
  } finally {
    page.off('response', alResponder)
    page.off('requestfailed', alFallar)
  }

  return { inicio: inicioDocente ? await (await inicioDocente).json() : null }
}

/** El menú lateral (solo visible desde `lg`; el viewport de escritorio lo cumple). */
export const menu = (page) => page.getByRole('navigation', { name: 'Menú principal' })

export async function irPorMenu(page, etiqueta, ruta) {
  await menu(page).getByRole('link', { name: etiqueta, exact: true }).click()
  await expect(page).toHaveURL((url) => url.pathname === ruta)
}

/** Cierra sesión desde el menú de usuario de la barra lateral (CU008). */
export async function cerrarSesion(page) {
  const salida = page.waitForResponse((r) => esApi(r, '/logout', 'POST'))
  // El botón con el nombre y el rol es el único de la barra con aria-expanded.
  await page.locator('aside').getByRole('button', { expanded: false }).click()
  await page.getByRole('menuitem', { name: 'Cerrar sesión' }).click()

  // Con cambios sin sincronizar, CU007 pide confirmar antes de salir.
  const confirmar = page.getByRole('button', { name: 'Finalizar sesión igualmente' })
  if (await confirmar.isVisible().catch(() => false)) await confirmar.click()

  const respuesta = await salida
  await expect(page).toHaveURL(/\/login$/)
  return respuesta
}

export const leerToken = (page) => page.evaluate((clave) => sessionStorage.getItem(clave), CLAVE_TOKEN)

