// Alta y baja de alumnos desde la pantalla Alumnos (CU014). Exigen una
// actividad abierta: quien llama se encarga de iniciarla.
import { expect } from '@playwright/test'
import { cerrarPopupTrasGuardar, esperarAntesDeAbrirPopup } from './bugs.js'
import { SEED } from './cuentas.js'
import { esApi } from './sesion.js'

/** El badge de estado, exacto: «Activo» como texto suelto también está dentro de «Inactivo». */
export const activas = (page, filas) => filas.filter({ has: page.getByText('Activo', { exact: true }) })

/** Filtra la lista de Alumnos del colegio E2E por texto y espera a que se pinte. */
export async function filtrarAlumnos(page, texto) {
  await page.getByLabel('Buscar').fill(texto)
  await page.getByLabel('Colegio', { exact: true }).selectOption({ label: SEED.colegio })
  await page.getByRole('button', { name: 'Filtrar' }).click()
  await expect(page.getByRole('row').filter({ hasText: texto }).first().or(page.getByText('Sin registros'))).toBeVisible()
}

export async function inactivarAlumno(page, fila) {
  await fila.getByRole('button', { name: /^Inactivar/ }).click()
  const baja = page.waitForResponse(
    (r) => /\/api\/alumnos\/[^/]+\/desactivar$/.test(new URL(r.url()).pathname) && r.request().method() === 'PATCH',
  )
  await page.getByRole('dialog', { name: 'Inactivar alumno' }).getByRole('button', { name: 'Inactivar' }).click()
  expect((await baja).ok(), 'PATCH /alumnos/{id}/desactivar').toBeTruthy()
  await expect(page.getByRole('status').filter({ hasText: 'Alumno inactivado' }).first()).toBeVisible()
}

/** Registra un alumno en el colegio E2E y devuelve su respuesta (`id`, …). */
export async function crearAlumno(page, { nombres, apellidos, grado, subprograma }) {
  await esperarAntesDeAbrirPopup(page)
  await page.getByRole('button', { name: 'Agregar', exact: true }).click()

  const popup = page.getByRole('dialog', { name: 'Nuevo alumno' })
  await popup.getByLabel('Nombres').fill(nombres)
  await popup.getByLabel('Apellidos').fill(apellidos)
  await popup.getByLabel('Colegio').selectOption({ label: SEED.colegio })
  await popup.getByLabel('Grado').selectOption({ label: grado })
  await popup.getByLabel('Subprograma').selectOption({ label: subprograma })
  await expect(popup.getByLabel('Nombres')).toHaveValue(nombres)

  const alta = page.waitForResponse((r) => esApi(r, '/alumnos', 'POST'))
  await popup.getByRole('button', { name: 'Guardar' }).click()
  const respuesta = await alta
  expect(respuesta.status(), `POST /alumnos (${nombres})`).toBe(201)
  await expect(page.getByRole('status').filter({ hasText: 'Alumno registrado' }).first()).toBeVisible()
  await cerrarPopupTrasGuardar(popup)
  return respuesta.json()
}
