// F4 — Gestión de usuarios y primer ingreso (CU016, CU001, CU002).
//
// La Supervisora da de alta a un Docente en el aula libre del colegio E2E
// (6.º): aparece Activo y «Primer ingreso». Si el backend devolvió
// la contraseña temporal (solo cuando el correo de bienvenida falla), el
// Docente hace su primer ingreso: la temporal no deja entrar (403
// `cambio_contrasena_requerido`), establece la definitiva y entra; después
// entra con ella por el login normal. Al final la Supervisora lo inactiva y
// pasa de «Activos» a «Inactivos». Al inactivarlo el backend libera su aula,
// así que 6.º vuelve a quedar libre para la próxima corrida.
//
// La cuenta creada se inactiva SIEMPRE, también si la prueba falla a medias.
import crypto from 'node:crypto'
import { expect, test } from '@playwright/test'
import { inactivarUsuario } from './support/api.js'
import { cerrarPopupTrasGuardar, esperarAntesDeAbrirPopup } from './support/bugs.js'
import { SEED } from './support/cuentas.js'
import { evidencia } from './support/evidencia.js'
import {
  MARCADOR_PASSWORD_NUEVA,
  cerrarSesion,
  enviarLoginCon,
  esApi,
  iniciarSesion,
  irPorMenu,
  sustituirPrimerIngreso,
} from './support/sesion.js'

const PREFIJO = 'E2E-'
// El badge de la columna Acceso. Era «Pendiente de primer ingreso» y se acortó
// para que no partiera la fila (3050a73); la frase completa quedó en el title.
const PENDIENTE = 'Primer ingreso'
const TITULO_PENDIENTE = 'Aún no ha usado su contraseña temporal. Caduca a las 48 horas.'

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

/** Contraseña definitiva del Docente de prueba: cumple CU006 y no se imprime nunca. */
const passwordNueva = () => `E2e-${crypto.randomBytes(6).toString('hex')}-Ok1`

test('F4 · Gestión de usuarios: alta de un Docente, primer ingreso, inactivación y filtros por estado (CU016, CU001, CU002)', async ({ page }) => {
  // Hasta cinco inicios de sesión seguidos: más que el límite general de 90 s.
  test.setTimeout(180_000)
  let idCreado = null
  let inactivado = false

  try {
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
    let temporal = null

    await test.step(`Crear el Docente ${nombres} en ${SEED.colegio}, 6.º`, async () => {
      await esperarAntesDeAbrirPopup(page)
      await page.getByRole('button', { name: 'Agregar', exact: true }).click()
      const popup = page.getByRole('dialog', { name: 'Nueva cuenta' })
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
      const creado = await respuesta.json()
      idCreado = creado.usuario?.id ?? null
      expect(idCreado, 'id de la cuenta creada').toBeTruthy()
      // CU001: toda cuenta nueva nace con la marca de cambio obligatorio.
      expect(creado.usuario?.debe_cambiar_contrasena, 'debe_cambiar_contrasena').toBe(true)

      // La temporal solo viene si el correo de bienvenida falló. La app la
      // muestra UNA vez; es una cuenta de prueba que se inactiva al final.
      if (creado.correo_enviado === false) {
        temporal = creado['contraseña_temporal']
        expect(temporal, 'contraseña_temporal en la respuesta').toBeTruthy()
        await page.getByRole('dialog', { name: 'Entregue esta contraseña' }).getByRole('button', { name: 'Entendido' }).click()
      } else {
        await expect(page.getByRole('status').filter({ hasText: 'Cuenta creada' })).toBeVisible()
      }
      await cerrarPopupTrasGuardar(popup)
    })

    await test.step('Aparece Activo, con su DNI, su colegio y «Primer ingreso»', async () => {
      await filtrar(page, nombres)
      await expect(fila()).toHaveCount(1)
      await expect(badge(fila(), 'Activo')).toBeVisible()
      await expect(badge(fila(), PENDIENTE)).toBeVisible()
      await expect(badge(fila(), PENDIENTE)).toHaveAttribute('title', TITULO_PENDIENTE)
      await expect(fila()).toContainText(SEED.colegio)
      await expect(fila()).toContainText(dni)
      await evidencia(page, 'usuario-activo-pendiente')
    })

    if (temporal) {
      const nueva = passwordNueva()

      await test.step('Primer ingreso: la temporal no deja entrar y obliga a establecer la definitiva (CU001)', async () => {
        await cerrarSesion(page)
        const login = await enviarLoginCon(page, { usuario: correo, password: temporal })
        expect(login.status(), 'POST /login con la temporal').toBe(403)
        const cuerpo = await login.json()
        expect(cuerpo.motivo).toBe('cambio_contrasena_requerido')
        expect(cuerpo).not.toHaveProperty('access_token')

        const modal = page.getByRole('dialog', { name: 'Establecer nueva contraseña' })
        await expect(modal).toBeVisible()
        await expect(page).toHaveURL(/\/login$/)
        // El navegador escribe un marcador; la contraseña real la pone Node.
        await sustituirPrimerIngreso(page, { temporal, nueva })
        await modal.getByLabel('Nueva contraseña', { exact: true }).fill(MARCADOR_PASSWORD_NUEVA)
        await modal.getByLabel('Repita la nueva contraseña').fill(MARCADOR_PASSWORD_NUEVA)
        await evidencia(page, 'primer-ingreso-formulario')

        const primerIngreso = page.waitForResponse((r) => esApi(r, '/password/primer-ingreso', 'POST'))
        await modal.getByRole('button', { name: 'Establecer y entrar' }).click()
        const respuesta = await primerIngreso
        expect(respuesta.status(), 'POST /password/primer-ingreso').toBe(200)
        expect(await respuesta.json()).toHaveProperty('access_token')
        // Entra directo, sin repetir el login.
        await expect(page).toHaveURL(/\/inicio$/)
        await expect(page.getByRole('heading', { name: 'Mis asignaciones' })).toBeVisible()
        await evidencia(page, 'primer-ingreso-inicio')
      })

      await test.step('Con la definitiva entra por el login normal', async () => {
        await cerrarSesion(page)
        const login = await enviarLoginCon(page, { usuario: correo, password: nueva })
        expect(login.status(), 'POST /login con la contraseña definitiva').toBe(200)
        await expect(page).toHaveURL(/\/inicio$/)
        await cerrarSesion(page)
      })

      await test.step('Ya no figura «Primer ingreso»', async () => {
        await iniciarSesion(page, 'supervisor')
        await irPorMenu(page, 'Usuarios', '/usuarios')
        await filtrar(page, nombres)
        await expect(fila()).toHaveCount(1)
        await expect(badge(fila(), PENDIENTE)).toHaveCount(0)
      })
    } else {
      test.info().annotations.push({
        type: 'limitación',
        description:
          'El correo de bienvenida se envió: el backend no devuelve la contraseña temporal y el primer ingreso no se puede automatizar (CU001). Se verificó solo «Primer ingreso».',
      })
    }

    await test.step('Inactivarlo: sale de «Activos» y aparece en «Inactivos»', async () => {
      await inactivar(page, fila())
      inactivado = true
      await expect(fila()).toHaveCount(0)
      await evidencia(page, 'usuario-fuera-de-activos')

      await filtrar(page, nombres, 'Inactivos')
      await expect(fila()).toHaveCount(1)
      await expect(badge(fila(), 'Inactivo')).toBeVisible()
      await evidencia(page, 'usuario-en-inactivos')
    })
  } finally {
    // Si la prueba se cortó antes de inactivarla, la cuenta no puede quedar
    // activa: ocuparía 6.º y la próxima corrida no podría usarlo.
    if (idCreado && !inactivado) {
      await inactivarUsuario(idCreado)
      test.info().annotations.push({ type: 'limpieza', description: `Cuenta ${idCreado} inactivada por API tras un fallo` })
    }
  }
})
