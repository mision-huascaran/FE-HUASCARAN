// Ciclo de vida de la sesión de punta a punta (CU001, CU002, CU007, RNF-003, RNF-004).
//
// Login de los tres roles, cada respuesta de error del login con su texto
// literal, cierre de sesión, vencimiento a las 8 horas (480 minutos) y vuelta a
// la ruta pedida. Todo contra el mock: ninguna llamada sale a la red.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import handlers from '../../api/mock/handlers'
import { CLAVE_DEMO } from '../../api/mock/db'
import { MENSAJE } from '../../features/login/LoginPage'
import useSessionStore from '../../store/sessionStore'
import { useAuth } from '../AuthProvider'
import { destinoTrasLogin } from '../../rutas'
import { ROLES } from '../roles'
import {
  ROLES_DE_PRUEBA,
  cuentaDe,
  errorDeRed,
  errorHttp,
  expEn,
  jwtDePrueba,
  usuarioDe,
} from '../../test/fabricas'
import { iniciarSesionComo, renderConProveedores } from '../../test/renderConProveedores'

// La limpieza de IndexedDB al salir no es lo que se prueba aquí (la cubre
// cierreSinConexion.test.jsx) y jsdom no trae IndexedDB.
vi.mock('../../lib/colaOffline', async (importOriginal) => ({
  ...(await importOriginal()),
  limpiarSiTodoSincronizado: vi.fn(async () => true),
}))
vi.mock('../../lib/datosLocales', async (importOriginal) => ({
  ...(await importOriginal()),
  limpiarDatosLocalesDeSesion: vi.fn(async () => {}),
}))

const OCHO_HORAS_MS = 480 * 60 * 1000

const rutaActual = () => screen.getByLabelText('ruta actual')

async function ingresar(correo, password) {
  await userEvent.type(screen.getByLabelText(/Correo/), correo)
  await userEvent.type(screen.getByLabelText(/Contraseña/), password)
  await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }))
}

beforeEach(() => {
  iniciarSesionComo(null)
  sessionStorage.clear()
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe.each(ROLES_DE_PRUEBA)('Inicio de sesión como $nombre (CU001)', ({ idRol }) => {
  it('entra con sus credenciales, aterriza en /inicio y el token queda solo en sessionStorage', async () => {
    renderConProveedores(null, { ruta: '/login' })
    await ingresar(cuentaDe(idRol).correo, CLAVE_DEMO)

    await waitFor(() => expect(rutaActual()).toHaveTextContent('/inicio'))
    expect(useSessionStore.getState().usuario.id_rol).toBe(idRol)
    // RNF-003: el token sobrevive a la recarga pero no al cierre del navegador.
    expect(sessionStorage.getItem('sicedu.token')).toBe(useSessionStore.getState().token)
    expect(localStorage.length).toBe(0)
  })
})

describe('Errores del login (CU002)', () => {
  it.each([
    ['401: credenciales inválidas', errorHttp(401, {}, '/login'), MENSAJE.credenciales],
    ['429: demasiados intentos', errorHttp(429, {}, '/login'), MENSAJE.bloqueo],
    ['500: error del servidor', errorHttp(500, {}, '/login'), 'No se pudo iniciar sesión. Intente nuevamente.'],
    ['sin respuesta del servidor', errorDeRed(), MENSAJE.sinConexion],
  ])('%s → muestra su texto y no deja sesión', async (_caso, error, texto) => {
    vi.spyOn(handlers.auth, 'login').mockRejectedValue(error)
    renderConProveedores(null, { ruta: '/login' })
    await ingresar(cuentaDe(ROLES.DOCENTE).correo, CLAVE_DEMO)

    expect(await screen.findByRole('alert')).toHaveTextContent(texto)
    expect(rutaActual()).toHaveTextContent('/login')
    expect(useSessionStore.getState().token).toBeNull()
    expect(sessionStorage.getItem('sicedu.token')).toBeNull()
  })

  it('el mensaje de cuenta desactivada es distinto del de credenciales inválidas', () => {
    // Si fueran iguales, el usuario desactivado creería que escribió mal la clave.
    expect(MENSAJE.desactivada).not.toBe(MENSAJE.credenciales)
  })

  it('en un 401 usa el `detail` del servidor, que puede ser el de cuenta desactivada', async () => {
    vi.spyOn(handlers.auth, 'login').mockRejectedValue(errorHttp(401, { detail: MENSAJE.desactivada }, '/login'))
    renderConProveedores(null, { ruta: '/login' })
    await ingresar(cuentaDe(ROLES.DOCENTE).correo, CLAVE_DEMO)

    expect(await screen.findByRole('alert')).toHaveTextContent(MENSAJE.desactivada)
  })

  /**
   * BUG (documentado en REPORTE_CALIDAD.md): ante un 403 SIN `detail`, LoginPage
   * pasa MENSAJE.desactivada como respaldo a `mensajeDeError`, pero esa función
   * devuelve antes "Sin permiso para realizar esta acción" para cualquier 403.
   * El usuario desactivado lee un texto de permisos en vez del literal de CU002.
   */
  it.fails('403 sin detalle: muestra el literal de cuenta desactivada (CU002)', async () => {
    vi.spyOn(handlers.auth, 'login').mockRejectedValue(errorHttp(403, {}, '/login'))
    renderConProveedores(null, { ruta: '/login' })
    await ingresar(cuentaDe(ROLES.DOCENTE).correo, CLAVE_DEMO)

    expect(await screen.findByRole('alert')).toHaveTextContent(MENSAJE.desactivada)
  })

  it('403 con el literal en el `detail`: lo muestra y no deja sesión', async () => {
    vi.spyOn(handlers.auth, 'login').mockRejectedValue(errorHttp(403, { detail: MENSAJE.desactivada }, '/login'))
    renderConProveedores(null, { ruta: '/login' })
    await ingresar(cuentaDe(ROLES.DOCENTE).correo, CLAVE_DEMO)

    expect(await screen.findByRole('alert')).toHaveTextContent(MENSAJE.desactivada)
    expect(useSessionStore.getState().token).toBeNull()
  })

  /**
   * BUG (documentado en REPORTE_CALIDAD.md): el comentario de LoginPage dice que
   * en el 403 "se ignora el [texto] del servidor para no decir de más" y que el
   * texto lo fija CU002, pero el código llama a `mensajeDeError(error, ...)`,
   * que PREFIERE el `detail` del servidor. Si el backend redacta otro texto, la
   * pantalla deja de mostrar el literal que exige el caso de prueba de CU002.
   */
  it.fails('en un 403 muestra SIEMPRE el literal de CU002, aunque el servidor mande otro texto', async () => {
    vi.spyOn(handlers.auth, 'login').mockRejectedValue(errorHttp(403, { detail: 'Usuario inactivo' }, '/login'))
    renderConProveedores(null, { ruta: '/login' })
    await ingresar(cuentaDe(ROLES.DOCENTE).correo, CLAVE_DEMO)

    expect(await screen.findByRole('alert')).toHaveTextContent(MENSAJE.desactivada)
  })

  // Pedido en la revisión de calidad, pero CU002 y el Plan de Prueba fijan UN
  // solo texto para todos los roles, y antes del login el frontend no conoce el
  // rol. Queda pendiente de que lo decida el equipo (ver REPORTE_CALIDAD.md).
  it.todo('el mensaje de cuenta desactivada cambia según el rol de la cuenta')
})

describe('Vuelta a la ruta pedida (RNF-004)', () => {
  it('sin sesión manda al login y, al entrar, devuelve a la ruta pedida con su query', async () => {
    renderConProveedores(null, { ruta: '/alumnos?colegio=2' })
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()

    await ingresar(cuentaDe(ROLES.DOCENTE).correo, CLAVE_DEMO)
    await waitFor(() => expect(rutaActual()).toHaveTextContent('/alumnos'))
  })

  it('nunca redirige fuera de la aplicación aunque la ruta guardada sea una URL externa', () => {
    expect(destinoTrasLogin('https://malicioso.example/inicio', ROLES.DOCENTE)).toBe('/inicio')
    expect(destinoTrasLogin('//malicioso.example', ROLES.SUPERVISOR)).toBe('/inicio')
    expect(destinoTrasLogin('javascript:alert(1)', ROLES.DIRECTIVO)).toBe('/inicio')
  })

  it('un usuario autenticado que abre /login vuelve a su inicio', async () => {
    renderConProveedores(null, { ruta: '/login', rol: ROLES.SUPERVISOR })
    await waitFor(() => expect(rutaActual()).toHaveTextContent('/inicio'))
  })
})

describe('Cierre de sesión', () => {
  it('borra el token, el perfil y la caché de consultas', async () => {
    const usuario = iniciarSesionComo(ROLES.DOCENTE)
    useSessionStore.getState().setToken(useSessionStore.getState().token)
    let auth
    function Espia() {
      auth = useAuth()
      return null
    }
    const { cliente } = renderConProveedores(<Espia />)
    cliente.setQueryData(['alumnos'], [{ nombres: 'Dato sensible' }])
    expect(auth.usuario).toEqual(usuario)

    await act(() => auth.salir())

    expect(useSessionStore.getState()).toMatchObject({ token: null, usuario: null, motivoCierre: null })
    expect(sessionStorage.getItem('sicedu.token')).toBeNull()
    expect(cliente.getQueryData(['alumnos'])).toBeUndefined()
  })

  it('aunque el servidor no responda al /logout, la sesión local se cierra igual', async () => {
    vi.spyOn(handlers.auth, 'logout').mockRejectedValue(errorDeRed())
    iniciarSesionComo(ROLES.DIRECTIVO)
    let auth
    function Espia() {
      auth = useAuth()
      return null
    }
    renderConProveedores(<Espia />)

    await act(() => auth.salir())
    expect(useSessionStore.getState().token).toBeNull()
  })

  it('useAuth fuera de AuthProvider falla con un mensaje claro', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useAuth())).toThrow('useAuth debe usarse dentro de <AuthProvider>')
  })
})

describe('Verificación de la sesión al recargar', () => {
  it('un token ya vencido no llega a pedir /me: la sesión se limpia', async () => {
    const me = vi.spyOn(handlers.auth, 'me')
    useSessionStore.setState({ token: jwtDePrueba({ exp: expEn(-5) }), usuario: null, cargando: true })
    renderConProveedores(null, { ruta: '/inicio' })

    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
    expect(me).not.toHaveBeenCalled()
    expect(useSessionStore.getState().token).toBeNull()
  })

  it('si /me rechaza el token, vuelve al login', async () => {
    vi.spyOn(handlers.auth, 'me').mockRejectedValue(errorHttp(401, { motivo: 'sesion_invalida' }, '/me'))
    useSessionStore.setState({ token: 'mock.1.2026', usuario: null, cargando: true })
    renderConProveedores(null, { ruta: '/inicio' })

    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
    expect(useSessionStore.getState().token).toBeNull()
  })

  it('mientras /me responde muestra la pantalla de verificación, no la ruta', async () => {
    useSessionStore.setState({ token: 'mock.4.2026', usuario: null, cargando: true })
    renderConProveedores(null, { ruta: '/dashboard' })

    expect(screen.getByText('Verificando su sesión…')).toBeInTheDocument()
    await waitFor(() => expect(useSessionStore.getState().usuario?.id_rol).toBe(ROLES.SUPERVISOR))
  })
})

describe('Vencimiento a las 8 horas (CU007)', () => {
  it('a los 479 minutos sigue dentro; a los 480 cierra la sesión y explica por qué', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    useSessionStore.setState({
      token: jwtDePrueba({ sub: 1, exp: expEn(480) }),
      usuario: usuarioDe(ROLES.DIRECTIVO),
      cargando: false,
      motivoCierre: null,
    })
    renderConProveedores(null, { ruta: '/dashboard' })

    await act(() => vi.advanceTimersByTimeAsync(OCHO_HORAS_MS - 60_000))
    expect(useSessionStore.getState().token).not.toBeNull()

    await act(() => vi.advanceTimersByTimeAsync(61_000))
    await waitFor(() => expect(useSessionStore.getState().token).toBeNull())
    expect(useSessionStore.getState().motivoCierre).toBe('expiracion')

    const aviso = await screen.findByRole('status')
    expect(aviso).toHaveTextContent('Su sesión terminó por alcanzar su tiempo máximo de 8 horas')
    expect(within(aviso).queryByText(/incorrectos/)).not.toBeInTheDocument()
  })

  it('al volver a intentar entrar, el aviso de vencimiento desaparece', async () => {
    useSessionStore.setState({ token: null, usuario: null, cargando: false, motivoCierre: 'expiracion' })
    vi.spyOn(handlers.auth, 'login').mockRejectedValue(errorHttp(401, {}, '/login'))
    renderConProveedores(null, { ruta: '/login' })
    expect(screen.getByRole('status')).toBeInTheDocument()

    await ingresar(cuentaDe(ROLES.DOCENTE).correo, CLAVE_DEMO)
    await screen.findByRole('alert')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
