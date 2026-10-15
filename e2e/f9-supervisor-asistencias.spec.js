// F9 — La Supervisora audita la jornada de asistencias en solo lectura
// (CU020, CU021, CU022).
//
// En Seguimiento encuentra la jornada de F8 con su productividad («2
// Asistencias», siempre en plural) y entra por el atajo «Ver Asistencias», que
// lleva la fecha de ESA sesión en hora de Lima. En la clase ve lo que registró
// el Docente —la tardanza, la presencia y la observación— sin poder cambiar
// nada: los controles están deshabilitados, no hay «Marcar todos» y no sale
// ningún PUT /asistencias.
import { expect, test } from '@playwright/test'
import { SUBPROGRAMA, elegirClase, lado } from './support/asistencia.js'
import { SEED } from './support/cuentas.js'
import { exigirEstadoDe } from './support/estado.js'
import { evidencia } from './support/evidencia.js'
import { fechaHoraLima, fechaLima } from './support/fechas.js'
import { iniciarSesion, irPorMenu } from './support/sesion.js'

/** La fila de la jornada: su hora de inicio y exactamente «2 Asistencias». */
const jornadaDe = (page, inicio) =>
  page.getByRole('row').filter({ hasText: fechaHoraLima(inicio) }).filter({ hasText: /(^|\D)2 Asistencias/ })

test('F9 · Supervisora: la jornada de asistencias en Seguimiento y en Asistencias, solo lectura (CU020, CU021, CU022)', async ({ page }) => {
  const { asistencia } = exigirEstadoDe('F8', 'asistencia')

  const escrituras = []
  page.on('request', (peticion) => {
    if (new URL(peticion.url()).pathname === '/api/asistencias' && peticion.method() === 'PUT') escrituras.push(peticion.url())
  })

  await iniciarSesion(page, 'supervisor')
  await irPorMenu(page, 'Seguimiento', '/seguimiento')

  await test.step('En la bitácora del Docente E2E, la jornada muestra «2 Asistencias» (CU021)', async () => {
    await page.getByLabel('Colegio').selectOption({ label: SEED.colegio })
    // Seguimiento filtra al pulsar, no al cambiar el control.
    await page.getByRole('button', { name: 'Filtrar' }).click()
    const docente = page.getByRole('row').filter({ hasText: SEED.docente })
    await expect(docente).toHaveCount(1)
    await docente.getByRole('button', { name: 'Ver detalle' }).click()
    await expect(page.getByRole('heading', { name: SEED.docente, level: 1 })).toBeVisible()

    // La jornada se reconoce por su hora de inicio y su productividad: la
    // actividad de preparación de F8 («2 Alumnos») puede caer en el mismo minuto.
    // Productividad: siempre en plural y en orden fijo (Asistencias primero).
    await expect(jornadaDe(page, asistencia.inicio).first()).toBeVisible()
    await evidencia(page, 'seguimiento-jornada-asistencias')
  })

  await test.step('«Ver Asistencias» lleva a la fecha de la sesión en hora de Lima (CU021)', async () => {
    await jornadaDe(page, asistencia.inicio).first().getByRole('button', { name: 'Ver Asistencias' }).click()
    await expect(page).toHaveURL((url) => url.pathname === '/asistencia')
    expect(new URL(page.url()).searchParams.get('fecha'), 'fecha del atajo').toBe(fechaLima(asistencia.inicio))
  })

  await test.step('En la clase registrada ve todo y no puede cambiar nada (CU022)', async () => {
    expect(await elegirClase(page, { docente: SEED.docente, grado: asistencia.grado, fecha: asistencia.fecha })).toBe('lista')
    await expect(lado(page, 'Tardanza', asistencia.tarde)).toHaveAttribute('aria-pressed', 'true')
    await expect(lado(page, 'Presente', asistencia.observado)).toHaveAttribute('aria-pressed', 'true')
    for (const nombre of [asistencia.tarde, asistencia.observado]) {
      for (const etiqueta of ['Presente', 'Tardanza', 'Ausente']) await expect(lado(page, etiqueta, nombre)).toBeDisabled()
    }
    // La observación se puede LEER (el globo con nota se abre), pero no editar.
    const globo = page.getByRole('button', { name: `Ver observación de ${asistencia.observado}`, exact: true })
    await expect(globo).toHaveAttribute('title', asistencia.observacion)
    await globo.click()
    const modal = page.getByRole('dialog', { name: 'Observación' })
    const texto = modal.getByLabel('Motivo o justificación')
    await expect(texto).toHaveValue(asistencia.observacion)
    await expect(texto).not.toBeEditable()
    await expect(modal.getByRole('button', { name: 'Guardar observación' })).toHaveCount(0)
    await evidencia(page, 'supervisora-observacion-solo-lectura')
    await modal.getByRole('button', { name: 'Cerrar' }).last().click()
    await expect(modal).toBeHidden()
    // CU022: el botón de lote se OCULTA para el Supervisor, no se deshabilita.
    await expect(page.getByRole('button', { name: 'Marcar todos como presentes' })).toHaveCount(0)
    expect(escrituras, 'PUT /asistencias de la Supervisora').toEqual([])
    await evidencia(page, 'supervisora-asistencia-solo-lectura')
  })

  test.info().annotations.push({ type: 'clase', description: `${asistencia.fecha} · ${asistencia.grado} · ${SUBPROGRAMA}` })
})
