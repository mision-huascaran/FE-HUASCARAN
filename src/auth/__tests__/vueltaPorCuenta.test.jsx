// D109 — Cada usuario entra a su Inicio, no a la última pantalla del anterior.
//
// QA: tras cerrar sesión una Supervisora (o un Docente) en
// /seguimiento-lectura?colegio=…, la siguiente cuenta que entraba en el mismo
// navegador llegaba a esa pantalla con sus filtros. `ProtectedRoute` guardaba
// la ruta sin decir de quién era y el login solo miraba si el ROL podía entrar.
//
// La vuelta a la pantalla sigue existiendo para lo que la justifica: la sesión
// se corta sola (expira) y la MISMA cuenta vuelve a entrar.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CLAVE_DEMO } from '../../api/mock/db'
import useSessionStore from '../../store/sessionStore'
import { destinoTrasLoginDe } from '../../rutas'
import { ROLES } from '../roles'
import { cuentaDe } from '../../test/fabricas'
import { iniciarSesionComo, renderConProveedores } from '../../test/renderConProveedores'

vi.mock('../../lib/colaOffline', async (importOriginal) => ({
  ...(await importOriginal()),
  limpiarSiTodoSincronizado: vi.fn(async () => true),
}))
vi.mock('../../lib/datosLocales', async (importOriginal) => ({
  ...(await importOriginal()),
  limpiarDatosLocalesDeSesion: vi.fn(async () => {}),
  limpiarSiEsOtroUsuario: vi.fn(async () => false),
  guardarPerfilLocal: vi.fn(async () => {}),
}))

const OTRO_DOCENTE = 'jmelendez@sicedu.test'
const rutaActual = () => screen.getByLabelText('ruta actual')

async function ingresar(correo) {
  await screen.findByRole('heading', { name: 'Iniciar sesión' })
  await userEvent.type(screen.getByLabelText(/Correo/), correo)
  await userEvent.type(screen.getByLabelText(/Contraseña/), CLAVE_DEMO)
  await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }))
}

async function cerrarSesionAMano() {
  const nombre = useSessionStore.getState().usuario.nombre_completo
  const [menu] = await screen.findAllByRole('button', { name: new RegExp(nombre) })
  await userEvent.click(menu)
  await userEvent.click(await screen.findByRole('menuitem', { name: /Cerrar sesión/ }))
}

beforeEach(() => {
  iniciarSesionComo(null)
  sessionStorage.clear()
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Cierre de sesión a mano y otra cuenta (D109)', () => {
  it('Supervisora → Docente: el Docente entra a su Inicio', async () => {
    renderConProveedores(null, { ruta: '/alumnos?colegio=1', rol: ROLES.SUPERVISOR })
    await waitFor(() => expect(rutaActual()).toHaveTextContent('/alumnos'))

    await cerrarSesionAMano()
    await ingresar(cuentaDe(ROLES.DOCENTE).correo)

    await waitFor(() => expect(rutaActual()).toHaveTextContent('/inicio'))
    expect(useSessionStore.getState().usuario.id_rol).toBe(ROLES.DOCENTE)
  })

  it('Docente → otro Docente: el segundo entra a su Inicio', async () => {
    renderConProveedores(null, { ruta: '/alumnos?colegio=1', rol: ROLES.DOCENTE })
    await waitFor(() => expect(rutaActual()).toHaveTextContent('/alumnos'))

    await cerrarSesionAMano()
    await ingresar(OTRO_DOCENTE)

    await waitFor(() => expect(rutaActual()).toHaveTextContent('/inicio'))
    expect(useSessionStore.getState().usuario.correo).toBe(OTRO_DOCENTE)
  })

  it('tras cerrar a mano, ni la MISMA cuenta vuelve a la pantalla anterior', async () => {
    renderConProveedores(null, { ruta: '/alumnos?colegio=1', rol: ROLES.DOCENTE })
    await waitFor(() => expect(rutaActual()).toHaveTextContent('/alumnos'))

    await cerrarSesionAMano()
    await ingresar(cuentaDe(ROLES.DOCENTE).correo)

    await waitFor(() => expect(rutaActual()).toHaveTextContent('/inicio'))
  })
})

describe('La sesión se corta sola (D109)', () => {
  it('la MISMA cuenta vuelve a la pantalla en la que estaba', async () => {
    renderConProveedores(null, { ruta: '/alumnos?colegio=1', rol: ROLES.DOCENTE })
    await waitFor(() => expect(rutaActual()).toHaveTextContent('/alumnos'))

    act(() => useSessionStore.getState().cerrarSesion('expiracion'))
    await ingresar(cuentaDe(ROLES.DOCENTE).correo)

    await waitFor(() => expect(rutaActual()).toHaveTextContent('/alumnos'))
  })

  it('otra cuenta va a su Inicio aunque la sesión anterior no se cerrara a mano', async () => {
    renderConProveedores(null, { ruta: '/alumnos?colegio=1', rol: ROLES.DOCENTE })
    await waitFor(() => expect(rutaActual()).toHaveTextContent('/alumnos'))

    act(() => useSessionStore.getState().cerrarSesion('expiracion'))
    await ingresar(OTRO_DOCENTE)

    await waitFor(() => expect(rutaActual()).toHaveTextContent('/inicio'))
  })
})

describe('destinoTrasLoginDe', () => {
  const docente = { id_usuario: 1, id_rol: ROLES.DOCENTE }

  it('sin estado, al Inicio', () => {
    expect(destinoTrasLoginDe(undefined, docente)).toBe('/inicio')
  })

  it('una pantalla de otra cuenta no se respeta; la de la misma sí', () => {
    expect(destinoTrasLoginDe({ desde: '/alumnos', idUsuario: 2 }, docente)).toBe('/inicio')
    expect(destinoTrasLoginDe({ desde: '/alumnos', idUsuario: '1' }, docente)).toBe('/alumnos')
  })

  it('un enlace abierto sin sesión previa vale para quien entre (RNF-004)', () => {
    expect(destinoTrasLoginDe({ desde: '/alumnos' }, docente)).toBe('/alumnos')
  })
})
