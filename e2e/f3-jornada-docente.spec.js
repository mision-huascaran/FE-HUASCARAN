// F3 — Jornada del Docente (CU009, CU010, CU014, CU017, CU019).
//
// Antes de empezar se inactivan los alumnos «E2E-» que hayan quedado activos en
// el colegio E2E por corridas que fallaron a medias.
//
// Una jornada completa: sin actividad no se puede registrar; se inicia la
// actividad, se registra un alumno en su colegio y grado, se encuentra, se
// inactiva (limpieza) y se finaliza la actividad. Al final, Sesiones muestra
// esa actividad con sus cambios contados por módulo.
//
// Deja en test-results/e2e-state.json el alumno y la actividad, que F5 y F7
// vuelven a buscar.
import { expect, test } from '@playwright/test'
import {
  abrirDetalleDeSesion,
  cerrarActividadPendiente,
  dato,
  exigirPeriodoVigente,
  finalizarActividad,
  iniciarActividad,
} from './support/actividad.js'
import { cerrarPopupTrasGuardar, esperarAntesDeAbrirPopup } from './support/bugs.js'
import { SEED } from './support/cuentas.js'
import { guardarEstado } from './support/estado.js'
import { evidencia } from './support/evidencia.js'
import { esApi, iniciarSesion, irPorMenu } from './support/sesion.js'

// Textos ACTUALES de la pantalla. Se reportan como bugs: CU014 llama «Agregar»
// al botón y CU010 pide «Inicia una actividad de trabajo para habilitar el
// registro de datos.» como aviso.
const BOTON_NUEVO = 'Nuevo'
const AVISO_SIN_ACTIVIDAD = 'Pulse "Iniciar actividad" para poder registrar.'
const PREFIJO = 'E2E-'

/** El badge de estado, exacto: «Activo» como texto suelto también está dentro de «Inactivo». */
const activas = (page, filas) => filas.filter({ has: page.getByText('Activo', { exact: true }) })

async function inactivarAlumno(page, fila) {
  await fila.getByRole('button', { name: /^Inactivar/ }).click()
  const baja = page.waitForResponse(
    (r) => /\/api\/alumnos\/[^/]+\/desactivar$/.test(new URL(r.url()).pathname) && r.request().method() === 'PATCH',
  )
  await page.getByRole('dialog', { name: 'Inactivar alumno' }).getByRole('button', { name: 'Inactivar' }).click()
  expect((await baja).ok(), 'PATCH /alumnos/{id}/desactivar').toBeTruthy()
  await expect(page.getByRole('status').filter({ hasText: 'Alumno inactivado' }).first()).toBeVisible()
}

test('F3 · Jornada del Docente: actividad, alta y baja de un alumno, y su rastro en Sesiones (CU009, CU010, CU014, CU017, CU019)', async ({ page }) => {
  const { inicio } = await iniciarSesion(page, 'docente')
  await exigirPeriodoVigente(page, inicio)
  await cerrarActividadPendiente(page, inicio)

  await test.step(`Limpieza: inactivar alumnos «${PREFIJO}» que hayan quedado activos en ${SEED.colegio}`, async () => {
    await irPorMenu(page, 'Alumnos', '/alumnos')
    await page.getByLabel('Buscar').fill(PREFIJO)
    await page.getByLabel('Colegio', { exact: true }).selectOption({ label: SEED.colegio })
    await page.getByRole('button', { name: 'Filtrar' }).click()
    const restos = activas(page, page.getByRole('row').filter({ hasText: PREFIJO }))
    await expect(restos.first().or(page.getByText('Sin registros'))).toBeVisible()

    const cantidad = await restos.count()
    if (cantidad > 0) {
      // Inactivar es una escritura del Docente: exige una actividad abierta
      // (CU010). Se usa una aparte para no mezclar sus cambios con los de la
      // jornada que se verifica después en Sesiones.
      await iniciarActividad(page)
      for (let i = 0; i < cantidad; i += 1) {
        await inactivarAlumno(page, restos.first())
        await expect(restos).toHaveCount(cantidad - i - 1)
      }
      await finalizarActividad(page)
    }
    test.info().annotations.push({ type: 'limpieza', description: `${cantidad} alumno(s) ${PREFIJO} inactivado(s) antes de empezar` })
  })

  const nombres = `${PREFIJO}${Date.now()}`
  const apellidos = 'Playwright'
  const filaDelAlumno = () => page.getByRole('row').filter({ hasText: nombres })

  await test.step('Sin actividad, no se puede registrar (CU010)', async () => {
    await irPorMenu(page, 'Alumnos', '/alumnos')
    await expect(page.getByRole('button', { name: BOTON_NUEVO, exact: true })).toBeDisabled()
    await expect(page.getByRole('note')).toHaveText(AVISO_SIN_ACTIVIDAD)
    await evidencia(page, 'alumnos-sin-actividad')
  })

  const actividad = await test.step('Iniciar actividad (CU009)', async () => {
    const iniciada = await iniciarActividad(page)
    await irPorMenu(page, 'Inicio', '/inicio')
    // CU010: hora de inicio y de fin como texto fijo, sin cronómetro.
    await expect(
      page.getByText(/^Actividad iniciada a las \d{2}:\d{2}\. La sesión finaliza a las \d{2}:\d{2}\.$/),
    ).toBeVisible()
    await evidencia(page, 'actividad-iniciada')
    return iniciada
  })
  guardarEstado({ idActividad: actividad.id, inicioActividad: actividad.inicio })

  await test.step(`Registrar el alumno ${nombres} en ${SEED.colegio}, 1.º, Alfabetización (CU014)`, async () => {
    await irPorMenu(page, 'Alumnos', '/alumnos')
    await expect(page.getByRole('note')).toHaveCount(0)
    // BUGS.FORMULARIO_SE_VACIA: en Alumnos `campos` es un array nuevo en cada
    // render, y al iniciar la actividad corre la precarga offline.
    await esperarAntesDeAbrirPopup(page)
    await page.getByRole('button', { name: BOTON_NUEVO, exact: true }).click()

    const popup = page.getByRole('dialog', { name: 'Nuevo alumno' })
    await popup.getByLabel('Nombres').fill(nombres)
    await popup.getByLabel('Apellidos').fill(apellidos)
    await popup.getByLabel('Colegio').selectOption({ label: SEED.colegio })
    await popup.getByLabel('Grado').selectOption({ label: '1.º' })
    await popup.getByLabel('Subprograma').selectOption({ label: 'Alfabetización' })
    await expect(popup.getByLabel('Nombres')).toHaveValue(nombres)
    await expect(popup.getByLabel('Colegio')).not.toHaveValue('')
    await expect(popup.getByLabel('Subprograma')).not.toHaveValue('')
    await evidencia(page, 'alumno-formulario')

    const alta = page.waitForResponse((r) => esApi(r, '/alumnos', 'POST'))
    await popup.getByRole('button', { name: 'Guardar' }).click()
    expect((await alta).status(), 'POST /alumnos').toBe(201)
    await expect(page.getByRole('status').filter({ hasText: 'Alumno registrado' })).toBeVisible()
    await cerrarPopupTrasGuardar(popup)
  })
  guardarEstado({ alumno: nombres })

  await test.step('El alumno aparece al buscarlo', async () => {
    await page.getByLabel('Buscar').fill(nombres)
    await page.getByRole('button', { name: 'Filtrar' }).click()
    await expect(filaDelAlumno()).toHaveCount(1)
    await expect(filaDelAlumno()).toContainText(SEED.colegio)
    await expect(filaDelAlumno().getByText('Activo', { exact: true })).toBeVisible()
    await evidencia(page, 'alumno-encontrado')
  })

  await test.step('Inactivar el alumno (limpieza; su historial se conserva)', async () => {
    await inactivarAlumno(page, filaDelAlumno())
    // El filtro sigue en «Activos»: ya no debe estar.
    await expect(filaDelAlumno()).toHaveCount(0)
    await evidencia(page, 'alumno-inactivado')
  })

  await test.step('Finalizar actividad (CU009)', async () => {
    await finalizarActividad(page)
    await evidencia(page, 'actividad-finalizada')
  })

  await test.step('Sesiones: la actividad tiene sus cambios contados por módulo (CU017, CU019)', async () => {
    await irPorMenu(page, 'Sesiones', '/sesiones')
    const detalle = await abrirDetalleDeSesion(page, actividad.id)

    await expect(dato(detalle, 'Estado')).toHaveText('Finalizada')
    await expect(dato(detalle, 'Tipo de cierre')).toHaveText('Manual por finalización de actividad')
    expect(Number(await dato(detalle, 'Cambios').innerText()), 'cambios de la sesión').toBeGreaterThanOrEqual(1)

    // Columnas: Módulo, Total, Creados, Editados, Activados, Inactivados.
    const alumnos = detalle.getByRole('row').filter({ has: page.getByRole('cell', { name: 'Alumnos', exact: true }) })
    await expect(alumnos).toHaveCount(1)
    await expect(alumnos.getByRole('cell').nth(2), 'alumnos creados').toHaveText('1')
    await expect(alumnos.getByRole('cell').nth(5), 'alumnos inactivados').toHaveText('1')
    await evidencia(page, 'sesion-detalle')
  })
})
