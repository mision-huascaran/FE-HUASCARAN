// F8c — Asistencias: clase adicional creada sin conexión (D61, D123, CU022).
//
// En un día sin clase programada, sin red: "Registrar clase adicional",
// "Marcar todos como presentes" y un Ausente. Se va a otro módulo y se vuelve:
// tiene que seguir la "Clase adicional" con sus marcas, sin ofrecer crear
// otra. Al reconectar, el servidor crea UNA clase y todas las asistencias
// quedan en ella.
//
// Gasta un par (grado, fecha) sin clase del periodo vigente, el más antiguo
// que quede: después de esta prueba ese día ya tiene su clase adicional (la
// clase no se puede borrar). Si no queda ninguno en la ventana de días, se salta.
import { expect, test } from '@playwright/test'
import { cerrarActividadPendiente, exigirPeriodoVigente, finalizarActividad, iniciarActividad } from './support/actividad.js'
import { diasSinClaseCandidatos, elegirClase, lado } from './support/asistencia.js'
import { leerEstado } from './support/estado.js'
import { esApi, iniciarSesion, irPorMenu } from './support/sesion.js'

const PRESIONADO = 'aria-pressed'
const BOTON_ADICIONAL = 'Registrar clase adicional'

/** Los nombres de los alumnos de la tabla, en orden. */
const nombresDeLaTabla = (page) =>
  page
    .getByRole('group', { name: /^Asistencia de / })
    .evaluateAll((grupos) => grupos.map((g) => g.getAttribute('aria-label').replace(/^Asistencia de /, '')))

test('F8c · Clase adicional sin conexión: al volver sigue con sus marcas y al reconectar se crea una sola vez (D61, D123, CU022)', async ({ page, context }) => {
  test.setTimeout(300_000)
  const { inicio } = await iniciarSesion(page, 'docente')
  await exigirPeriodoVigente(page, inicio)
  await cerrarActividadPendiente(page, inicio)
  await iniciarActividad(page)
  await irPorMenu(page, 'Asistencias', '/asistencia')

  const deF8 = leerEstado().asistencia
  const botonAdicional = page.getByRole('button', { name: BOTON_ADICIONAL })
  const clase = await test.step('Elegir un día sin clase programada (con alumnos)', async () => {
    // Del más ANTIGUO al más reciente. F8 da de alta un alumno en su día de
    // clase, que es el más reciente libre: una adicional de su grado en un día
    // POSTERIOR tiene la lista congelada sin él y el alta sería un 409
    // `conflicto_listas_historicas`. Gastando los días viejos, F8 no choca.
    for (const candidato of (await diasSinClaseCandidatos(page)).reverse()) {
      if (deF8 && candidato.fecha === deF8.fecha && candidato.grado === deF8.grado) continue
      if ((await elegirClase(page, candidato)) !== 'lista') continue
      if (await botonAdicional.isVisible()) return candidato
    }
    return null
  })
  test.skip(!clase, 'No queda ningún día del periodo vigente sin clase programada (y con alumnos) en el que crear una adicional')

  const nombres = await nombresDeLaTabla(page)
  const [ausente, ...presentes] = nombres
  const verMarcas = async () => {
    await expect(lado(page, 'Ausente', ausente), `${ausente} sigue Ausente`).toHaveAttribute(PRESIONADO, 'true')
    for (const nombre of presentes) {
      await expect(lado(page, 'Presente', nombre), `${nombre} sigue Presente`).toHaveAttribute(PRESIONADO, 'true')
    }
  }
  const verClaseAdicional = async () => {
    await expect(page.getByText('Clase adicional', { exact: true })).toBeVisible()
    await expect(botonAdicional, 'no se ofrece crear otra clase').toHaveCount(0)
    await expect(page.getByText('No hay una clase programada para esta fecha', { exact: false })).toHaveCount(0)
  }

  await test.step('Sin conexión: registrar la clase adicional, todos presentes y uno Ausente', async () => {
    await context.setOffline(true)
    await botonAdicional.click()
    await page.getByRole('button', { name: 'Marcar todos como presentes' }).click()
    await expect(page.getByText(`${nombres.length} alumno${nombres.length === 1 ? '' : 's'} marcado`).first()).toBeVisible()
    await lado(page, 'Ausente', ausente).click()
    await verMarcas()
    await expect(page.getByText(`${nombres.length} pendiente${nombres.length === 1 ? '' : 's'}`).first(), 'una operación por alumno').toBeVisible()
  })

  await test.step('Ir a Alumnos y volver, todavía sin conexión: sigue la clase adicional con sus marcas', async () => {
    await irPorMenu(page, 'Alumnos', '/alumnos')
    await irPorMenu(page, 'Asistencias', '/asistencia')
    await expect(page.getByRole('heading', { name: /^\d+ alumnos?$/ })).toBeVisible()
    await verClaseAdicional()
    await verMarcas()
  })

  await test.step('Al reconectar se crea una sola clase y todas las asistencias quedan en ella', async () => {
    const respuestas = []
    page.on('response', (r) => {
      if (esApi(r, '/asistencias', 'PUT')) respuestas.push(r)
    })
    await context.setOffline(false)
    await expect(page.getByText('Todo sincronizado').first()).toBeVisible({ timeout: 60_000 })

    expect(respuestas.every((r) => r.ok()), 'PUT /asistencias sin errores').toBe(true)
    const cuerpos = await Promise.all(respuestas.map((r) => r.json()))
    const enviados = respuestas.flatMap((r) => (r.request().postDataJSON()?.registros ?? []).map((x) => x.id_alumno))
    expect(enviados, 'un envío por alumno, sin duplicados').toHaveLength(new Set(enviados).size)
    expect(new Set(enviados).size).toBe(nombres.length)
    expect(respuestas.every((r) => r.request().postDataJSON()?.adicional === true), 'todas viajan con `adicional`').toBe(true)
    const resultados = cuerpos.flatMap((c) => c.resultados ?? [])
    expect(resultados.every((x) => x.estado === 'aceptada'), 'todas aceptadas').toBe(true)
    const clases = new Set([...cuerpos.map((c) => c.clase?.id_clase), ...resultados.map((x) => x.registro?.id_clase)])
    expect([...clases], 'una sola clase para todas').toHaveLength(1)
    expect(cuerpos.every((c) => c.clase?.etiqueta === 'Clase adicional')).toBe(true)

    await page.reload()
    await elegirClase(page, clase)
    await verClaseAdicional()
    await verMarcas()
  })

  await finalizarActividad(page)
})
