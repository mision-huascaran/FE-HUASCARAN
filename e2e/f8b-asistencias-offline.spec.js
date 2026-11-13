// F8b — Asistencias sin conexión: lo marcado se ve al volver al módulo (D123).
//
// Se marca sin red, se va a otro módulo y se vuelve: la tabla tiene que
// mostrar lo marcado (copia local + operaciones pendientes de la cola). Al
// reconectar se envía una vez por alumno y la tabla queda igual.
//
// No gasta una clase limpia (F8 la necesita): usa una que ya tenga asistencia
// y que no sea la de F8, y al final devuelve las dos marcas a como estaban.
import { expect, test } from '@playwright/test'
import { cerrarActividadPendiente, exigirPeriodoVigente, finalizarActividad, iniciarActividad } from './support/actividad.js'
import { diasDeClaseCandidatos, elegirClase, exigirDiaDeClase, lado } from './support/asistencia.js'
import { leerEstado } from './support/estado.js'
import { esApi, iniciarSesion, irPorMenu } from './support/sesion.js'

const PRESIONADO = 'aria-pressed'
const ESTADOS = ['Presente', 'Tardanza', 'Ausente']

/** Los nombres de los alumnos de la tabla, en orden. */
const nombresDeLaTabla = (page) =>
  page
    .getByRole('group', { name: /^Asistencia de / })
    .evaluateAll((grupos) => grupos.map((g) => g.getAttribute('aria-label').replace(/^Asistencia de /, '')))

/** El estado pulsado de un alumno, o null si está sin marcar. */
async function estadoDe(page, nombre) {
  for (const estado of ESTADOS) {
    if ((await lado(page, estado, nombre).getAttribute(PRESIONADO)) === 'true') return estado
  }
  return null
}

const otroEstado = (actual, preferido) => (actual === preferido ? ESTADOS.find((e) => e !== actual) : preferido)

test('F8b · Asistencias sin conexión: lo marcado se ve al volver al módulo y se sincroniza una vez (D123, CU022)', async ({ page, context }) => {
  test.setTimeout(240_000)
  const { inicio } = await iniciarSesion(page, 'docente')
  await exigirPeriodoVigente(page, inicio)
  await cerrarActividadPendiente(page, inicio)
  await iniciarActividad(page)
  await irPorMenu(page, 'Asistencias', '/asistencia')

  const deF8 = leerEstado().asistencia
  const clase = await test.step('Elegir una clase que ya tenga asistencia y no sea la de F8', async () => {
    const candidatos = await diasDeClaseCandidatos(page)
    exigirDiaDeClase(candidatos)
    for (const candidato of candidatos) {
      if (deF8 && candidato.fecha === deF8.fecha && candidato.grado === deF8.grado) continue
      if ((await elegirClase(page, candidato)) !== 'lista') continue
      if ((await page.locator(`[${PRESIONADO}="true"]`).count()) > 0) return candidato
    }
    return null
  })
  test.skip(!clase, 'No hay una clase del periodo vigente con asistencia registrada (aparte de la de F8) en la que probar sin gastar una limpia')

  const [primero, segundo] = await nombresDeLaTabla(page)
  const marcados = [
    { nombre: primero, preferido: 'Tardanza' },
    { nombre: segundo, preferido: 'Ausente' },
  ]
  for (const alumno of marcados) {
    alumno.original = await estadoDe(page, alumno.nombre)
    alumno.nuevo = otroEstado(alumno.original, alumno.preferido)
  }
  const verMarcas = async () => {
    for (const { nombre, nuevo } of marcados) {
      await expect(lado(page, nuevo, nombre), `${nombre} sigue en ${nuevo}`).toHaveAttribute(PRESIONADO, 'true')
    }
  }

  await test.step('Sin conexión: marcar a dos alumnos (uno como Ausente si se puede)', async () => {
    await context.setOffline(true)
    for (const { nombre, nuevo } of marcados) await lado(page, nuevo, nombre).click()
    await verMarcas()
  })

  await test.step('Ir a Alumnos y volver a Asistencias, todavía sin conexión: se ve lo marcado', async () => {
    await irPorMenu(page, 'Alumnos', '/alumnos')
    await irPorMenu(page, 'Asistencias', '/asistencia')
    await verMarcas()
  })

  await test.step('Al reconectar se envía una vez por alumno y la tabla queda igual', async () => {
    const enviados = []
    page.on('response', (r) => {
      if (esApi(r, '/asistencias', 'PUT') && r.ok()) enviados.push(...(r.request().postDataJSON()?.registros ?? []).map((x) => x.id_alumno))
    })
    await expect(page.getByText('2 pendientes').first(), 'las dos marcas esperan en la cola').toBeVisible()
    await context.setOffline(false)
    await expect(page.getByText('Todo sincronizado').first()).toBeVisible({ timeout: 30_000 })
    expect(enviados, 'un envío por alumno, sin duplicados').toHaveLength(new Set(enviados).size)
    expect(new Set(enviados).size).toBe(2)

    await page.reload()
    await elegirClase(page, clase)
    await verMarcas()
  })

  await test.step('Dejar la clase como estaba', async () => {
    for (const { nombre, original } of marcados) {
      if (!original) continue
      await lado(page, original, nombre).click()
      await expect(lado(page, original, nombre)).toHaveAttribute(PRESIONADO, 'true')
    }
    await expect(page.getByText('Todo sincronizado').first()).toBeVisible({ timeout: 30_000 })
    await finalizarActividad(page)
  })
})
