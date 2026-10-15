// Pantalla de Asistencias (CU022).
import { expect, test } from '@playwright/test'
import { SEED } from './cuentas.js'
import { diaSemana, fechaLima, restarDias } from './fechas.js'
import { leerToken } from './sesion.js'

/** Día de clase de cada grado del Docente E2E en el colegio E2E (seed del backend). */
export const GRADO_DEL_DIA = new Map([
  [1, '1.º'],
  [2, '2.º'],
  [3, '3.º'],
])
export const SUBPROGRAMA = 'Alfabetización'
const VENTANA_DIAS = 14

/**
 * Lunes, martes o miércoles hasta hoy (hora de Lima) dentro del periodo
 * vigente, del más reciente al más antiguo, con el grado que tiene clase ese
 * día. El periodo vigente lo da el backend: nunca una fecha fija.
 */
export async function diasDeClaseCandidatos(page) {
  const token = await leerToken(page)
  const respuesta = await page.request.get('/api/periodos-academicos', { headers: { Authorization: `Bearer ${token}` } })
  expect(respuesta.ok(), 'GET /periodos-academicos').toBeTruthy()
  const cuerpo = await respuesta.json()
  const vigente = (Array.isArray(cuerpo) ? cuerpo : (cuerpo.items ?? [])).find((p) => p.vigente)
  if (!vigente) return []

  const hoy = fechaLima(Date.now())
  const candidatos = []
  for (let atras = 0; atras < VENTANA_DIAS; atras += 1) {
    const fecha = restarDias(hoy, atras)
    const dia = diaSemana(fecha)
    if (fecha >= vigente.fecha_inicio && fecha <= vigente.fecha_fin && GRADO_DEL_DIA.has(dia)) {
      candidatos.push({ fecha, grado: GRADO_DEL_DIA.get(dia) })
    }
  }
  return candidatos
}

/** Espera el próximo `GET /asistencias` de esa fecha. Registrarlo ANTES de lo que lo dispara. */
export const respuestaDeClase = (page, fecha) =>
  page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === '/api/asistencias' &&
      r.request().method() === 'GET' &&
      new URL(r.url()).searchParams.get('fecha') === fecha,
  )

/**
 * Elige la clase en los filtros y espera a que la pantalla la pinte. Devuelve
 * qué mostró: 'no_lectivo' (422 `fecha_no_lectiva`), 'vacia' o 'lista'.
 */
/**
 * La clase se pide fresca cada vez que se entra a la pantalla (staleTime 0) y,
 * mientras llega, se sigue viendo lo que había en caché: leer el estado antes
 * de la respuesta daría la lista vieja. Si la fecha del filtro cambia, la
 * espera se registra aquí; si no cambia (al volver a la pantalla o recargar),
 * quien llama pasa en `refresco` la espera registrada ANTES de navegar.
 */
export async function elegirClase(page, { docente = null, grado, fecha }, { refresco = null } = {}) {
  if (docente) await page.getByLabel('Docente', { exact: true }).selectOption({ label: docente })
  const colegio = page.getByLabel('Colegio', { exact: true })
  await expect(colegio.getByRole('option', { name: SEED.colegio, exact: true }), 'el colegio E2E en el filtro Colegio').toBeAttached()
  await colegio.selectOption({ label: SEED.colegio })
  await page.getByLabel('Grado', { exact: true }).selectOption({ label: grado })
  // La Sección se muestra para ubicarse (CU022) pero no se elige: es la del
  // colegio y no viaja en `GET /asistencias`.
  const seccion = page.getByLabel('Sección', { exact: true })
  await expect(seccion).toHaveValue('Única')
  await expect(seccion).toBeDisabled()
  await page.getByLabel('Subprograma', { exact: true }).selectOption({ label: SUBPROGRAMA })
  const campoFecha = page.getByLabel('Fecha', { exact: true })
  if (refresco && (await campoFecha.inputValue()) === fecha) {
    await refresco
  } else {
    // Si ya estaba en esa fecha, otro filtro pudo disparar un pedido que no se
    // está esperando: se pasa por el día anterior para forzar uno nuevo.
    if ((await campoFecha.inputValue()) === fecha) await campoFecha.fill(restarDias(fecha, 1))
    const nueva = respuestaDeClase(page, fecha)
    await campoFecha.fill(fecha)
    await nueva
  }

  const noLectivo = page.getByRole('heading', { name: 'Día no lectivo' })
  const vacia = page.getByRole('heading', { name: 'Sin alumnos en esta clase' })
  const lista = page.getByRole('heading', { name: /^\d+ alumnos?$/ })
  await expect(noLectivo.or(vacia).or(lista)).toBeVisible()
  if (await noLectivo.isVisible()) return 'no_lectivo'
  return (await vacia.isVisible()) ? 'vacia' : 'lista'
}

/** Cuenta las respuestas de `PUT /asistencias` desde ahora. */
export function contarGuardados(page) {
  const respuestas = []
  page.on('response', (r) => {
    if (new URL(r.url()).pathname === '/api/asistencias' && r.request().method() === 'PUT') respuestas.push(r.status())
  })
  return {
    respuestas,
    /** Espera `n` guardados más desde la última espera, todos 2xx. */
    async esperar(n, desde) {
      await expect.poll(() => respuestas.length - desde, { message: `${n} PUT /asistencias` }).toBeGreaterThanOrEqual(n)
      expect(respuestas.slice(desde).every((estado) => estado >= 200 && estado < 300), 'PUT /asistencias sin errores').toBe(true)
    },
  }
}

/** Botón del Segmented Control de un alumno («Presente: Nombres Apellidos»). */
export const lado = (page, etiqueta, nombre) => page.getByRole('button', { name: `${etiqueta}: ${nombre}`, exact: true })

/** Salta la prueba si no hay ningún día de clase posible. */
export function exigirDiaDeClase(candidatos) {
  // Se salta a propósito: CU022 solo deja registrar en días lectivos del periodo vigente, y en los últimos 14 días no hubo lunes, martes ni miércoles dentro de él.
  test.skip(candidatos.length === 0, 'Sin lunes, martes ni miércoles lectivo hasta hoy en el periodo vigente (CU022)')
}
