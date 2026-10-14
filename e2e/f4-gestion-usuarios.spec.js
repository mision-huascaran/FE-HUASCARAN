// F4 — Gestión de usuarios (CU016, CU002).
//
// La Supervisora da de alta a un Docente en el aula libre del colegio E2E
// (6.º), lo ve activo, lo inactiva y comprueba que pasa de «Activos» a
// «Inactivos». Al inactivarlo el backend libera su aula, así que 6.º vuelve a
// quedar libre para la próxima corrida.
import { expect, test } from '@playwright/test'
import { cerrarPopupTrasGuardar, esperarAntesDeAbrirPopup } from './support/bugs.js'
import { SEED } from './support/cuentas.js'
import { evidencia } from './support/evidencia.js'
import { esApi, iniciarSesion, irPorMenu } from './support/sesion.js'

const PREFIJO = 'E2E-'

/** Filtra la tabla de Usuarios por texto y estado, y espera a que se pinte. */
async function filtrar(page, texto, estado = 'Activos') {
  await page.getByLabel('Buscar').fill(texto)
  await page.getByLabel('Estado', { exact: true }).selectOption({ label: estado })
  await page.getByRole('button', { name: 'Filtrar' }).click()
  // Con los mismos filtros react-query no vuelve a pedir: se espera a la tabla.
  await expect(page.getByRole('row').filter({ hasText: texto }).first().or(page.getByText('Sin registros'))).toBeVisible()
}

/** El badge de estado, exacto: «Activo» como texto suelto también está dentro de «Inactivo». */
const badge = (fila, estado) => fila.getByText(estado, { exact: true })

async function inactivar(page, fila) {
  await fila.getByRole('button', { name: /^Inactivar/ }).click()
  const baja = page.waitForResponse(
    (r) => /\/api\/usuarios\/\d+\/desactivar$/.test(new URL(r.url()).pathname) && r.request().method() === 'PATCH',
  )
  await page.getByRole('dialog', { name: 'Inactivar cuenta' }).getByRole('button', { name: 'Inactivar' }).click()
  expect((await baja).ok(), 'PATCH /usuarios/{id}/desactivar').toBeTruthy()
  await expect(page.getByRole('status').filter({ hasText: 'Cuenta inactivada' }).first()).toBeVisible()
}

/** DNI de 8 dígitos distinto en cada corrida, fuera de los del seed (90000001–90000004). */
function dniUnico() {
  const dni = `9${String(Date.now()).slice(-7)}`
  return /^900000\d\d$/.test(dni) ? `91${dni.slice(2)}` : dni
}

test('F4 · Gestión de usuarios: alta de un Docente, inactivación y filtros por estado (CU016, CU002)', async ({ page }) => {
  await iniciarSesion(page, 'supervisor')
  await irPorMenu(page, 'Usuarios', '/usuarios')

  await test.step('Limpieza: inactivar usuarios «E2E-» que hayan quedado activos', async () => {
    await filtrar(page, PREFIJO)
    const restos = page.getByRole('row').filter({ hasText: PREFIJO }).filter({ has: page.getByText('Activo', { exact: true }) })
    const cantidad = await restos.count()
    for (let i = 0; i < cantidad; i += 1) {
      await inactivar(page, restos.first())
      await expect(restos).toHaveCount(cantidad - i - 1)
    }
    test.info().annotations.push({ type: 'limpieza', description: `${cantidad} usuario(s) E2E- inactivado(s) antes de empezar` })
  })

  const marca = Date.now()
  const nombres = `${PREFIJO}${marca}`
  const correo = `soloparaunuso123+e2e.f4.${marca}@gmail.com`
  const dni = dniUnico()
  const fila = () => page.getByRole('row').filter({ hasText: nombres })

  await test.step(`Crear el Docente ${nombres} en ${SEED.colegio}, 6.º`, async () => {
    // BUGS.FORMULARIO_SE_VACIA: en Usuarios los campos dependen de los
    // catálogos de colegios y grados, que se vuelven a pedir tras cada
    // inactivación (la limpieza de arriba).
    await esperarAntesDeAbrirPopup(page)
    await page.getByRole('button', { name: 'Nuevo', exact: true }).click()
    // Título actual del popup: «Nuevo cuenta» (concordancia: debería ser «Nueva cuenta»).
    const popup = page.getByRole('dialog', { name: 'Nuevo cuenta' })
    await popup.getByLabel('Nombres').fill(nombres)
    await popup.getByLabel('Apellidos').fill('Docente F4')
    await popup.getByLabel('DNI').fill(dni)
    await popup.getByLabel('Correo institucional').fill(correo)
    await popup.getByLabel('Rol').selectOption({ label: 'Docente' })
    await popup.getByLabel('Colegio asignado').selectOption({ label: SEED.colegio })
    await popup.getByRole('checkbox', { name: '6.º' }).check()
    await expect(popup.getByLabel('Nombres')).toHaveValue(nombres)
    await expect(popup.getByLabel('DNI')).toHaveValue(dni)
    await expect(popup.getByRole('checkbox', { name: '6.º' })).toBeChecked()
    await evidencia(page, 'usuario-formulario')

    const alta = page.waitForResponse((r) => esApi(r, '/usuarios', 'POST'))
    await popup.getByRole('button', { name: 'Guardar' }).click()
    const respuesta = await alta
    expect(respuesta.status(), 'POST /usuarios').toBe(201)

    // Si el correo de bienvenida no sale, la app muestra la contraseña temporal
    // una sola vez. Es una cuenta de prueba que se inactiva enseguida.
    if ((await respuesta.json()).correo_enviado === false) {
      await page.getByRole('dialog', { name: 'Entregue esta contraseña' }).getByRole('button', { name: 'Entendido' }).click()
    } else {
      await expect(page.getByRole('status').filter({ hasText: 'Cuenta creada' })).toBeVisible()
    }
    await cerrarPopupTrasGuardar(popup)
  })

  await test.step('Aparece Activo, con su DNI y su colegio', async () => {
    await filtrar(page, nombres)
    await expect(fila()).toHaveCount(1)
    await expect(badge(fila(), 'Activo')).toBeVisible()
    await expect(fila()).toContainText(SEED.colegio)
    await expect(fila()).toContainText(dni)
    await evidencia(page, 'usuario-activo')
  })

  await test.step('Inactivarlo: sale de «Activos» y aparece en «Inactivos»', async () => {
    await inactivar(page, fila())
    await expect(fila()).toHaveCount(0)
    await evidencia(page, 'usuario-fuera-de-activos')

    await filtrar(page, nombres, 'Inactivos')
    await expect(fila()).toHaveCount(1)
    await expect(badge(fila(), 'Inactivo')).toBeVisible()
    await evidencia(page, 'usuario-en-inactivos')
  })
})
