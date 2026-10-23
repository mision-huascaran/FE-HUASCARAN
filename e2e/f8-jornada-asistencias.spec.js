// F8 — Jornada del Docente con Asistencias (CU022, CU009, CU010, CU017, CU019).
//
// La clase es la del día lectivo más reciente hasta hoy (hora de Lima) entre
// lunes, martes y miércoles dentro del periodo vigente, con el grado que tiene
// clase ese día en el colegio E2E (1.º lunes, 2.º martes, 3.º miércoles). Nunca
// una fecha fija: el periodo y los días lectivos los decide el backend.
//
// Dos actividades, a propósito:
//   · A (preparación): inactiva los alumnos «E2E-AS-» que hayan quedado y da de
//     alta 2 alumnos nuevos en ese grado. Así la clase tiene exactamente 2
//     alumnos sin marcar, aunque la fecha se repita entre corridas.
//   · B (la jornada): «Marcar todos como presentes», una tardanza y una
//     observación. Al finalizarla, Sesiones cuenta exactamente 2 cambios de
//     Asistencia: varios cambios al mismo alumno en la misma clase cuentan uno.
//
// Deja en test-results/e2e-state.json la clase y la actividad B, que F9
// revisa como Supervisora.
import { expect, test } from '@playwright/test'
import {
  abrirDetalleDeSesion,
  cerrarActividadPendiente,
  dato,
  exigirPeriodoVigente,
  finalizarActividad,
  iniciarActividad,
} from './support/actividad.js'
import { activas, crearAlumno, filtrarAlumnos, inactivarAlumno } from './support/alumnos.js'
import {
  SUBPROGRAMA,
  contarGuardados,
  diasDeClaseCandidatos,
  respuestaDeClase,
  elegirClase,
  exigirDiaDeClase,
  lado,
} from './support/asistencia.js'
import { guardarEstado } from './support/estado.js'
import { evidencia } from './support/evidencia.js'
import { iniciarSesion, irPorMenu } from './support/sesion.js'

const PREFIJO = 'E2E-AS-'
const OBSERVACION = 'Llegó con justificación de la familia (E2E)'
const MARCAR_TODOS = 'Marcar todos como presentes'
const PRESIONADO = 'aria-pressed'

test('F8 · Jornada del Docente con Asistencias: marcar todos, una tardanza y una observación (CU022, CU009, CU017, CU019)', async ({ page }) => {
  test.setTimeout(240_000)
  const { inicio } = await iniciarSesion(page, 'docente')
  await exigirPeriodoVigente(page, inicio)
  await cerrarActividadPendiente(page, inicio)

  const clase = await test.step('Elegir el día de clase más reciente del periodo vigente', async () => {
    const candidatos = await diasDeClaseCandidatos(page)
    exigirDiaDeClase(candidatos)
    await irPorMenu(page, 'Asistencia', '/asistencia')
    // Un feriado lo dice el servidor (422 `fecha_no_lectiva`): se prueba el
    // siguiente candidato, más antiguo. Tampoco sirve una clase que ya tiene
    // asistencia registrada (de otra corrida del mismo día): el servidor la
    // lista con los alumnos que ya tienen marca y no suma los nuevos.
    for (const candidato of candidatos) {
      const estado = await elegirClase(page, candidato)
      if (estado === 'no_lectivo') {
        test.info().annotations.push({ type: 'calendario', description: `${candidato.fecha} no es lectivo: se probó el anterior` })
        continue
      }
      if (estado === 'lista' && (await page.locator(`[${PRESIONADO}="true"]`).count()) > 0) {
        test.info().annotations.push({ type: 'calendario', description: `${candidato.fecha} ya tiene asistencia registrada: se probó el anterior` })
        continue
      }
      return candidato
    }
    return null
  })
  // Se salta a propósito: todos los lunes, martes y miércoles del periodo vigente hasta hoy son no lectivos o ya tienen asistencia de otra corrida, así que no hay clase limpia en la que registrar.
  test.skip(!clase, 'Ningún lunes, martes ni miércoles del periodo vigente hasta hoy es lectivo y sin asistencia registrada (CU022)')
  test.info().annotations.push({ type: 'clase', description: `${clase.fecha} · ${clase.grado} · ${SUBPROGRAMA}` })

  const marca = Date.now()
  const alumnos = [
    { nombres: `${PREFIJO}${marca}-1`, apellidos: 'Asistencia' },
    { nombres: `${PREFIJO}${marca}-2`, apellidos: 'Asistencia' },
  ].map((a) => ({ ...a, nombre: `${a.nombres} ${a.apellidos}` }))
  const [tarde, observado] = alumnos

  await test.step(`Preparación (actividad aparte): 2 alumnos nuevos en ${clase.grado}`, async () => {
    await irPorMenu(page, 'Alumnos', '/alumnos')
    await iniciarActividad(page)

    await filtrarAlumnos(page, PREFIJO)
    const restos = activas(page, page.getByRole('row').filter({ hasText: PREFIJO }))
    const cantidad = await restos.count()
    // Las fechas importan: de ellas depende quién aparece en la clase de
    // `clase.fecha`, que puede ser de un día anterior.
    for (let i = 0; i < cantidad; i += 1) {
      await inactivarAlumno(page, restos.first(), { desde: clase.fecha })
      await expect(restos).toHaveCount(cantidad - i - 1)
    }
    test.info().annotations.push({ type: 'limpieza', description: `${cantidad} alumno(s) ${PREFIJO} inactivado(s) antes de empezar` })

    for (const alumno of alumnos) {
      await crearAlumno(page, { ...alumno, grado: clase.grado, subprograma: SUBPROGRAMA, desde: clase.fecha })
    }
    await finalizarActividad(page)
  })

  const guardados = contarGuardados(page)
  const actividad = await test.step('Iniciar la jornada (CU009)', async () => {
    // Al volver, la clase se pide de nuevo: ya tiene los 2 alumnos nuevos.
    const refresco = respuestaDeClase(page, clase.fecha)
    await irPorMenu(page, 'Asistencia', '/asistencia')
    expect(await elegirClase(page, clase, { refresco })).toBe('lista')
    // Sin actividad la lista se ve pero no se escribe (CU010).
    await expect(page.getByRole('button', { name: MARCAR_TODOS })).toHaveCount(0)
    for (const alumno of alumnos) await expect(lado(page, 'Presente', alumno.nombre)).toBeDisabled()
    const iniciada = await iniciarActividad(page)
    await evidencia(page, 'asistencia-antes-de-marcar')
    return iniciada
  })

  await test.step('Marcar todos como presentes: marca exactamente los 2 sin marcar', async () => {
    const desde = guardados.respuestas.length
    await page.getByRole('button', { name: MARCAR_TODOS }).click()
    await expect(page.getByRole('status').filter({ hasText: '2 alumnos marcados como presente' })).toBeVisible()
    await guardados.esperar(2, desde)
    for (const alumno of alumnos) await expect(lado(page, 'Presente', alumno.nombre)).toHaveAttribute(PRESIONADO, 'true')
    // Ya no queda nadie sin marcar: el botón de lote desaparece.
    await expect(page.getByRole('button', { name: MARCAR_TODOS })).toHaveCount(0)
  })

  await test.step('Una tardanza', async () => {
    const desde = guardados.respuestas.length
    await lado(page, 'Tardanza', tarde.nombre).click()
    await guardados.esperar(1, desde)
    await expect(lado(page, 'Tardanza', tarde.nombre)).toHaveAttribute(PRESIONADO, 'true')
    await expect(lado(page, 'Presente', tarde.nombre)).toHaveAttribute(PRESIONADO, 'false')
  })

  await test.step('Una observación', async () => {
    const desde = guardados.respuestas.length
    await page.getByRole('button', { name: `Añadir observación de ${observado.nombre}`, exact: true }).click()
    const modal = page.getByRole('dialog', { name: 'Observación' })
    await modal.getByLabel('Motivo o justificación').fill(OBSERVACION)
    await modal.getByRole('button', { name: 'Guardar observación' }).click()
    await guardados.esperar(1, desde)
    const globo = page.getByRole('button', { name: `Ver observación de ${observado.nombre}`, exact: true })
    await expect(globo).toHaveAttribute('title', OBSERVACION)
    // La observación viaja sola: no borra el estado.
    await expect(lado(page, 'Presente', observado.nombre)).toHaveAttribute(PRESIONADO, 'true')
    await evidencia(page, 'asistencia-marcada')
  })

  await test.step('Al recargar, el servidor devuelve lo registrado', async () => {
    const refresco = respuestaDeClase(page, clase.fecha)
    await page.reload()
    expect(await elegirClase(page, clase, { refresco })).toBe('lista')
    await expect(lado(page, 'Tardanza', tarde.nombre)).toHaveAttribute(PRESIONADO, 'true')
    await expect(lado(page, 'Presente', observado.nombre)).toHaveAttribute(PRESIONADO, 'true')
    await expect(page.getByRole('button', { name: `Ver observación de ${observado.nombre}`, exact: true })).toHaveAttribute('title', OBSERVACION)
    await evidencia(page, 'asistencia-recargada')
  })

  await test.step('Finalizar la jornada (CU009)', async () => {
    await finalizarActividad(page)
  })
  guardarEstado({
    asistencia: {
      idActividad: actividad.id,
      inicio: actividad.inicio,
      fecha: clase.fecha,
      grado: clase.grado,
      tarde: tarde.nombre,
      observado: observado.nombre,
      observacion: OBSERVACION,
    },
  })

  await test.step('Sesiones: la jornada cuenta exactamente 2 cambios de Asistencia (CU017, CU019)', async () => {
    await irPorMenu(page, 'Sesiones', '/sesiones')
    const detalle = await abrirDetalleDeSesion(page, actividad.id)
    await expect(dato(detalle, 'Tipo de cierre')).toHaveText('Manual por finalización de actividad')
    await expect(dato(detalle, 'Cambios')).toHaveText('2')
    // Columnas: Módulo, Total, Creados, Editados, Activados, Inactivados.
    const fila = detalle.getByRole('row').filter({ has: page.getByRole('cell', { name: 'Asistencia', exact: true }) })
    await expect(fila).toHaveCount(1)
    await expect(fila.getByRole('cell').nth(1), 'total de Asistencia').toHaveText('2')
    // Solo asistencias: los alumnos se dieron de alta en la actividad de preparación.
    await expect(detalle.getByRole('cell', { name: 'Alumnos', exact: true })).toHaveCount(0)
    await evidencia(page, 'asistencia-sesion-detalle')
  })
})
