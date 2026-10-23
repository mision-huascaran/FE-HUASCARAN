// Alta y baja de alumnos desde la pantalla Alumnos (CU014). Exigen una
// actividad abierta: quien llama se encarga de iniciarla.
import { expect } from '@playwright/test'
import { cerrarPopupTrasGuardar, esperarAntesDeAbrirPopup } from './bugs.js'
import { SEED } from './cuentas.js'
import { fechaLima } from './fechas.js'
import { esApi, leerToken } from './sesion.js'

/** El badge de estado, exacto: «Activo» como texto suelto también está dentro de «Inactivo». */
export const activas = (page, filas) => filas.filter({ has: page.getByText('Activo', { exact: true }) })

/** Filtra la lista de Alumnos del colegio E2E por texto y espera a que se pinte. */
export async function filtrarAlumnos(page, texto) {
  await page.getByLabel('Buscar').fill(texto)
  await page.getByLabel('Colegio', { exact: true }).selectOption({ label: SEED.colegio })
  await page.getByRole('button', { name: 'Filtrar' }).click()
  await expect(page.getByRole('row').filter({ hasText: texto }).first().or(page.getByText('Sin registros'))).toBeVisible()
}

/** Envía la baja con la fecha efectiva puesta en el diálogo y devuelve la respuesta. */
async function confirmarBaja(page, desde) {
  const dialogo = page.getByRole('dialog', { name: 'Inactivar alumno' })
  if (desde) await dialogo.getByLabel('Fecha efectiva').fill(desde)
  const baja = page.waitForResponse(
    (r) => /\/api\/alumnos\/[^/]+\/desactivar$/.test(new URL(r.url()).pathname) && r.request().method() === 'PATCH',
  )
  await dialogo.getByRole('button', { name: 'Inactivar' }).click()
  return baja
}

/** Desde cuándo está el alumno en su grupo actual (`GET /alumnos/{id}`). */
async function inicioDeGrupo(page, respuestaDeBaja) {
  const id = new URL(respuestaDeBaja.url()).pathname.split('/').at(-2)
  const token = await leerToken(page)
  const detalle = await page.request.get(`/api/alumnos/${id}`, { headers: { Authorization: `Bearer ${token}` } })
  return (await detalle.json()).pertenece_desde ?? null
}

/**
 * Inactiva desde `desde` (AAAA-MM-DD; por defecto, hoy). De esa fecha depende en
 * qué clases pasadas sigue apareciendo. Si el alumno entró a su grupo después
 * de `desde`, el servidor no acepta una baja anterior a su alta: se da de baja
 * desde el inicio de su grupo, que no lo pone en ninguna clase. Hoy no sirve:
 * contradiría las listas de clases ya registradas (409).
 */
export async function inactivarAlumno(page, fila, { desde = null } = {}) {
  const abrir = () => fila.getByRole('button', { name: /^Inactivar/ }).click()
  await abrir()
  let respuesta = await confirmarBaja(page, desde)
  const inicio = !respuesta.ok() && desde ? await inicioDeGrupo(page, respuesta) : null
  if (inicio && inicio !== desde) {
    // El rechazo cierra el diálogo: se vuelve a abrir con la otra fecha.
    await expect(page.getByRole('dialog', { name: 'Inactivar alumno' })).toHaveCount(0)
    await abrir()
    respuesta = await confirmarBaja(page, inicio)
  }
  expect(respuesta.ok(), 'PATCH /alumnos/{id}/desactivar').toBeTruthy()
  await expect(page.getByRole('status').filter({ hasText: 'Alumno inactivado' }).first()).toBeVisible()
}

/**
 * Registra un alumno en el colegio E2E y devuelve su respuesta (`id`, …).
 * `desde` (AAAA-MM-DD; por defecto, hoy) es desde cuándo pertenece al grupo:
 * solo aparece en las clases de esa fecha en adelante.
 */
export async function crearAlumno(page, { nombres, apellidos, grado, subprograma, desde = fechaLima(Date.now()) }) {
  await esperarAntesDeAbrirPopup(page)
  await page.getByRole('button', { name: 'Agregar', exact: true }).click()

  const popup = page.getByRole('dialog', { name: 'Nuevo alumno' })
  await popup.getByLabel('Nombres').fill(nombres)
  await popup.getByLabel('Apellidos').fill(apellidos)
  await popup.getByLabel('Colegio').selectOption({ label: SEED.colegio })
  await popup.getByLabel('Grado').selectOption({ label: grado })
  // Desde T3 el alumno pertenece a una sección y a su grupo desde una fecha.
  await popup.getByLabel('Sección').selectOption({ label: 'Única' })
  await popup.getByLabel('Subprograma').selectOption({ label: subprograma })
  await popup.getByLabel('Pertenece al grupo desde').fill(desde)
  await expect(popup.getByLabel('Nombres')).toHaveValue(nombres)

  const alta = page.waitForResponse((r) => esApi(r, '/alumnos', 'POST'))
  await popup.getByRole('button', { name: 'Guardar' }).click()
  const respuesta = await alta
  expect(respuesta.status(), `POST /alumnos (${nombres})`).toBe(201)
  await expect(page.getByRole('status').filter({ hasText: 'Alumno registrado' }).first()).toBeVisible()
  await cerrarPopupTrasGuardar(popup)
  return respuesta.json()
}
