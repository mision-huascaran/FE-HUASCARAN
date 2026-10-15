// F2 — Control de acceso (CU001, CU013, CU016, CU020, CU022, RN-033).
//
// Docente y Directivo escriben a mano la URL de secciones que no son suyas:
// deben terminar en /403 sin que la aplicación llegue a pedir esos datos a la
// API, y esas secciones no deben aparecer en su menú.
import { expect, test } from '@playwright/test'
import { evidencia } from './support/evidencia.js'
import { esApi, iniciarSesion, menu } from './support/sesion.js'

const PROHIBIDO = 'No tiene permisos para acceder a esta sección'

/**
 * Espera la respuesta de cada llamada /api que hizo el documento ACTUAL. Las
 * del documento anterior que se cortaron al navegar no responden nunca: se
 * descartan por haber empezado antes de `performance.timeOrigin`.
 */
async function respuestasPendientes(page) {
  const origen = await page.evaluate(() => performance.timeOrigin)
  const pedidas = (await page.requests()).filter(
    (r) => new URL(r.url()).pathname.startsWith('/api/') && r.timing().startTime >= origen,
  )
  await Promise.all(pedidas.map((r) => r.response().catch(() => null)))
}

const PROHIBIDAS = {
  docente: [
    { ruta: '/usuarios', menu: 'Usuarios', api: 'usuarios' },
    { ruta: '/colegios', menu: 'Colegios', api: 'colegios' },
    { ruta: '/seguimiento', menu: 'Seguimiento', api: 'seguimiento' },
  ],
  directivo: [
    { ruta: '/usuarios', menu: 'Usuarios', api: 'usuarios' },
    { ruta: '/colegios', menu: 'Colegios', api: 'colegios' },
    { ruta: '/seguimiento', menu: 'Seguimiento', api: 'seguimiento' },
    // RN-033: el Directivo nunca accede a datos de alumnos.
    { ruta: '/alumnos', menu: 'Alumnos', api: 'alumnos' },
    // CU022: Asistencias es del Docente (registra) y del Supervisor (lee).
    { ruta: '/asistencia', menu: 'Asistencia', api: 'asistencias' },
  ],
}

const NOMBRE = { docente: 'Docente', directivo: 'Directivo' }

for (const [rol, secciones] of Object.entries(PROHIBIDAS)) {
  test(`F2 · ${NOMBRE[rol]}: las secciones ajenas terminan en /403 sin pedir datos (CU001, CU013, CU016, CU020, CU022, RN-033)`, async ({ page }) => {
    await iniciarSesion(page, rol)

    // Ni rastro en el menú.
    await expect(menu(page)).toBeVisible()
    for (const { menu: etiqueta } of secciones) {
      await expect(menu(page).getByRole('link', { name: etiqueta, exact: true }), `«${etiqueta}» en el menú`).toHaveCount(0)
    }
    await evidencia(page, `menu-${rol}`)

    // Lo que Inicio haya pedido al entrar (la precarga offline del Docente pide
    // colegios y alumnos) no cuenta. Se pasa primero por /403, que está fuera
    // del armazón y no pide datos: al recargar, el documento de Inicio y sus
    // peticiones desaparecen, y recién entonces se empieza a escuchar.
    await page.goto('/403')
    await expect(page.getByRole('heading', { name: PROHIBIDO })).toBeVisible()
    const pedidas = []
    page.on('request', (peticion) => {
      const { pathname } = new URL(peticion.url())
      if (pathname.startsWith('/api/')) pedidas.push(pathname)
    })

    for (const { ruta, api } of secciones) {
      await test.step(`${ruta} → /403`, async () => {
        pedidas.length = 0
        // Al recargar, la app pide /me antes de que RoleRoute decida: su
        // respuesta marca que la guarda ya resolvió con el rol real.
        const perfil = page.waitForResponse((r) => esApi(r, '/me'))
        await page.goto(ruta)

        await expect(page).toHaveURL(/\/403$/)
        await expect(page.getByRole('heading', { name: PROHIBIDO })).toBeVisible()
        await perfil
        await respuestasPendientes(page)
        const prohibidas = pedidas.filter((p) => p === `/api/${api}` || p.startsWith(`/api/${api}/`))
        expect(prohibidas, `peticiones a /api/${api} al abrir ${ruta}`).toEqual([])
        await evidencia(page, `${rol}${ruta.replace('/', '-')}-403`)
      })
    }
  })
}
