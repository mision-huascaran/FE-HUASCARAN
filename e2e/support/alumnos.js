// Alta y baja de alumnos desde la pantalla Alumnos (CU014). Exigen una
// actividad abierta: quien llama se encarga de iniciarla.
import { expect, test } from '@playwright/test'
import { cerrarPopupTrasGuardar, esperarAntesDeAbrirPopup } from './bugs.js'
import { SEED } from './cuentas.js'
import { fechaLima } from './fechas.js'
import { esApi, leerToken } from './sesion.js'

/** Título del diálogo de confirmación de la baja. */
const DIALOGO_BAJA = 'Inactivar alumno'

/**
 * Una marca única (p. ej. `Date.now()`) escrita solo con letras: 0→a … 9→j.
 * Los nombres de prueba se quedan sin dígitos aunque el formulario ya los
 * acepte (ver src/lib/nombrePersona.js): así la marca no se confunde con
 * un DNI en las búsquedas.
 */
export const marcaEnLetras = (marca) => String(marca).replace(/\d/g, (d) => 'abcdefghij'[Number(d)])

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
  const dialogo = page.getByRole('dialog', { name: DIALOGO_BAJA })
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
 * Abre la baja de la fila, la envía desde `desde` (AAAA-MM-DD; por defecto,
 * hoy) y devuelve la respuesta del servidor. De esa fecha depende en qué clases
 * pasadas sigue apareciendo. Si el alumno entró a su grupo después de `desde`,
 * el servidor no acepta una baja anterior a su alta: se reintenta desde el
 * inicio de su grupo, que no lo pone en ninguna clase. Hoy no sirve:
 * contradiría las listas de clases ya registradas (409).
 */
async function intentarBaja(page, fila, { desde = null } = {}) {
  const abrir = () => fila.getByRole('switch', { name: /^Inactivar/ }).click()
  await abrir()
  const respuesta = await confirmarBaja(page, desde)
  const inicio = !respuesta.ok() && desde ? await inicioDeGrupo(page, respuesta) : null
  if (!inicio || inicio === desde) return respuesta
  // El rechazo cierra el diálogo: se vuelve a abrir con la otra fecha.
  await expect(page.getByRole('dialog', { name: DIALOGO_BAJA })).toHaveCount(0)
  await abrir()
  return confirmarBaja(page, inicio)
}

/** Inactiva el alumno de la fila (ver `intentarBaja`); la prueba falla si el servidor no la acepta. */
export async function inactivarAlumno(page, fila, opciones = {}) {
  const respuesta = await intentarBaja(page, fila, opciones)
  expect(respuesta.ok(), 'PATCH /alumnos/{id}/desactivar').toBeTruthy()
  await expect(page.getByRole('status').filter({ hasText: 'Alumno inactivado' }).first()).toBeVisible()
}

/**
 * Por qué el servidor no acepta HOY la baja de un resto, o null si el rechazo es
 * otro. Un alumno que figura en la lista congelada de una clase de hoy no se
 * puede inactivar en ninguna fecha hasta mañana: desde hoy contradice esa lista
 * (409 `conflicto_listas_historicas`), antes de su alta o en el futuro es un
 * 422 sobre `aplicar_desde`. Eso no es un fallo de la prueba que limpia.
 */
async function bajaImposibleHoy(respuesta) {
  const cuerpo = await respuesta.json().catch(() => ({}))
  if (respuesta.status() === 409 && cuerpo.motivo === 'conflicto_listas_historicas') return cuerpo.detail
  const deFecha = (cuerpo.errores ?? []).some((error) => error.campo === 'aplicar_desde')
  if (respuesta.status() === 422 && deFecha) return cuerpo.detail
  return null
}

/**
 * Limpieza previa: inactiva los alumnos activos de `prefijo` que dejaron otras
 * corridas, sobre la lista ya filtrada. Solo toca los de ese prefijo, y los que
 * el servidor no deja inactivar hoy (`bajaImposibleHoy`) quedan anotados como
 * pendientes en vez de hacer fallar la prueba. Exige una actividad abierta.
 */
export async function limpiarAlumnos(page, prefijo, { desde = null } = {}) {
  // Cada corrida usa su propia marca (`${prefijo}<marca>`), así que el nombre
  // de un resto no está contenido en el de otro.
  const textos = await activas(page, page.getByRole('row').filter({ hasText: prefijo })).allInnerTexts()
  const nombres = [...new Set(textos.map((texto) => texto.split(/\s+/).find((palabra) => palabra.startsWith(prefijo))).filter(Boolean))]

  let inactivados = 0
  for (const nombre of nombres) {
    const fila = activas(page, page.getByRole('row').filter({ hasText: nombre }))
    const respuesta = await intentarBaja(page, fila, { desde })
    if (respuesta.ok()) {
      inactivados += 1
      await expect(fila).toHaveCount(0)
      continue
    }
    const motivo = await bajaImposibleHoy(respuesta)
    expect(motivo, `PATCH /alumnos/{id}/desactivar de ${nombre} (HTTP ${respuesta.status()})`).toBeTruthy()
    await expect(page.getByRole('dialog', { name: DIALOGO_BAJA })).toHaveCount(0)
    test.info().annotations.push({ type: 'limpieza pendiente', description: `${nombre}: ${motivo}` })
  }
  test.info().annotations.push({ type: 'limpieza', description: `${inactivados} de ${nombres.length} alumno(s) ${prefijo} inactivado(s) antes de empezar` })
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
