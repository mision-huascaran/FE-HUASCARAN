// Actividad de trabajo del Docente (CU009, CU010).
import { expect, test } from '@playwright/test'
import { esApi } from './sesion.js'
import { evidencia } from './evidencia.js'
import { fechaHoraLima } from './fechas.js'

/**
 * Lo que muestra el Inicio del Docente según `motivo_no_puede_iniciar` de
 * `GET /inicio/docente` (literales de CU010). El motivo lo decide el servidor:
 * el calendario operativo vive en su base de datos.
 */
export const MOTIVO_NO_PUEDE_INICIAR = new Map([
  [
    'sin_asignaciones',
    'No puedes iniciar una actividad porque no tienes asignaciones activas, ya sea para el periodo académico actual o de receso.',
  ],
  ['fuera_de_periodo', 'No puedes iniciar una actividad fuera del calendario operativo.'],
])
export const FUERA_DE_PERIODO = 'fuera de periodo académico (CU010)'

// El de la barra superior. Con el modal «Necesitas una actividad de trabajo»
// abierto hay otro botón con el mismo nombre, en el pie del modal.
const botonIniciar = (page) => page.getByRole('banner').getByRole('button', { name: 'Iniciar actividad' })
const botonFinalizar = (page) => page.getByRole('banner').getByRole('button', { name: 'Finalizar actividad' })

/**
 * Sin periodo académico vigente CU010 impide iniciar actividad: se verifica el
 * motivo que da el servidor, el texto que lo explica y el botón deshabilitado,
 * y se salta la prueba. `sin_asignaciones` NO se salta: el seed le da al
 * Docente E2E 1.º a 3.º en todos los periodos, así que sería un fallo real.
 */
export async function exigirPeriodoVigente(page, inicio) {
  const motivo = inicio?.motivo_no_puede_iniciar ?? null
  if (motivo === null || motivo === 'actividad_activa') return
  await expect(page.getByText(MOTIVO_NO_PUEDE_INICIAR.get(motivo) ?? motivo, { exact: true })).toBeVisible()
  await expect(botonIniciar(page)).toBeDisabled()
  await evidencia(page, `no-puede-iniciar-${motivo}`)
  expect(motivo, 'motivo_no_puede_iniciar del Docente E2E (el seed le da asignaciones)').toBe('fuera_de_periodo')
  test.info().annotations.push({ type: 'skip', description: FUERA_DE_PERIODO })
  // Se salta a propósito: sin periodo académico vigente CU010 impide iniciar actividad, así que el flujo no se puede ejecutar; ya se verificaron el motivo y su mensaje.
  test.skip(true, `Sin periodo académico vigente no se puede iniciar actividad: ${FUERA_DE_PERIODO}`)
}

/** Si una corrida anterior dejó una actividad abierta, se finaliza antes de empezar. */
export async function cerrarActividadPendiente(page, inicio) {
  if (!inicio?.actividad_activa) return
  test.info().annotations.push({
    type: 'setup',
    description: `Había una actividad abierta (${inicio.actividad_activa.id}); se finalizó antes de empezar.`,
  })
  await finalizarActividad(page)
}

export async function iniciarActividad(page) {
  const respuesta = page.waitForResponse((r) => esApi(r, '/actividades', 'POST'))
  await botonIniciar(page).click()
  const r = await respuesta
  expect(r.ok(), 'POST /actividades').toBeTruthy()
  // Petición `{id_actividad}`; respuesta `{actividad: {id, inicio, …}, sesion_expira}`.
  const { actividad } = await r.json()
  expect(actividad?.id, 'id de la actividad creada').toBeTruthy()
  await expect(botonFinalizar(page)).toBeVisible()
  return { id: actividad.id, inicio: actividad.inicio }
}

export async function finalizarActividad(page) {
  const respuesta = page.waitForResponse(
    (r) => /\/api\/actividades\/[^/]+\/finalizar$/.test(new URL(r.url()).pathname) && r.request().method() === 'POST',
  )
  await botonFinalizar(page).click()
  expect((await respuesta).ok(), 'POST /actividades/{id}/finalizar').toBeTruthy()
  await expect(botonIniciar(page)).toBeVisible()
}

/** Id de la actividad cuyo detalle pide el diálogo (`GET /api/actividades/{id}`), o null. */
const idDelDetalle = (respuesta) => {
  const ruta = new URL(respuesta.url()).pathname
  return respuesta.request().method() === 'GET' && /^\/api\/actividades\/[^/]+$/.test(ruta) ? ruta.split('/').at(-1) : null
}

/**
 * En Sesiones ni la tabla ni el detalle muestran el id: desde U28 el subtítulo
 * dice «Actividad del <fecha y hora>», y dos actividades pueden empezar en el
 * mismo minuto (la preparación y la jornada de F8). Se abre el detalle de cada
 * fila y se reconoce la actividad por la petición que hace el diálogo,
 * `GET /api/actividades/{id}`. Devuelve el diálogo abierto.
 */
export async function abrirDetalleDeSesion(page, idActividad) {
  const botones = page.getByRole('button', { name: 'Ver detalle' })
  await expect(botones.first()).toBeVisible()
  const total = Math.min(await botones.count(), 10)
  for (let i = 0; i < total; i += 1) {
    // Un detalle ya visto sale de la caché y no hace petición: no es el buscado.
    const pedido = page.waitForResponse((r) => idDelDetalle(r) !== null, { timeout: 10_000 }).catch(() => null)
    await botones.nth(i).click()
    const dialogo = page.getByRole('dialog', { name: 'Detalle de la actividad' })
    await expect(dialogo).toBeVisible()
    const respuesta = await pedido
    if (respuesta && idDelDetalle(respuesta) === idActividad) return dialogo
    await dialogo.getByRole('button', { name: 'Cerrar' }).last().click()
  }
  throw new Error(`La actividad ${idActividad} no aparece entre las ${total} sesiones más recientes`)
}

/** Valor de un dato `<dt>/<dd>` dentro de un contenedor. */
export const dato = (contenedor, etiqueta) =>
  contenedor.locator(`xpath=.//dt[normalize-space()="${etiqueta}"]/following-sibling::dd[1]`)

/**
 * Las filas de una bitácora de actividades que empezaron en `inicio`, al
 * minuto. La fecha y la hora de inicio van en celdas SEPARADAS, así que el
 * texto de la fila las une sin espacio («05/11/202600:47»): se buscan las dos
 * celdas, no el texto «fecha hora».
 */
export function filasQueEmpiezan(page, inicio) {
  const [fecha, hora] = fechaHoraLima(inicio).split(' ')
  return page
    .getByRole('row')
    .filter({ has: page.getByRole('cell', { name: fecha, exact: true }) })
    .filter({ has: page.getByRole('cell', { name: hora, exact: true }) })
}
