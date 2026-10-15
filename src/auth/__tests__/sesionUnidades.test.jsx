// Piezas sueltas de la sesión: store, temporizador de vencimiento, roles y guardas.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, renderHook, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import useSessionStore from '../../store/sessionStore'
import useExpiracionSesion from '../useExpiracionSesion'
import RoleRoute from '../RoleRoute'
import ProtectedRoute from '../ProtectedRoute'
import { ROLES, esSoloLectura, rutaInicioDe } from '../roles'
import { expEn, jwtDePrueba, usuarioDe } from '../../test/fabricas'
import { RutaActual } from '../../test/renderConProveedores'

const CLAVE = 'sicedu.token'

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  sessionStorage.clear()
})

describe('sessionStore: token inicial al recargar', () => {
  /** El token se lee una sola vez, al crear el store: hay que recargar el módulo. */
  async function storeRecargado() {
    vi.resetModules()
    return (await import('../../store/sessionStore')).default
  }

  it('restaura un token vigente desde sessionStorage', async () => {
    const token = jwtDePrueba({ exp: expEn(60) })
    sessionStorage.setItem(CLAVE, token)
    expect((await storeRecargado()).getState().token).toBe(token)
  })

  it('descarta y borra un token ya vencido, para no morir con un 401', async () => {
    sessionStorage.setItem(CLAVE, jwtDePrueba({ exp: expEn(-1) }))
    expect((await storeRecargado()).getState().token).toBeNull()
    expect(sessionStorage.getItem(CLAVE)).toBeNull()
  })

  it('con el almacenamiento bloqueado arranca sin sesión en vez de romper', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect((await storeRecargado()).getState().token).toBeNull()
  })
})

describe('sessionStore: escritura', () => {
  beforeEach(() => {
    useSessionStore.setState({ token: null, usuario: null, cargando: false, motivoCierre: null })
  })

  it('setToken respalda en sessionStorage y setToken(null) lo borra', () => {
    useSessionStore.getState().setToken('t1')
    expect(sessionStorage.getItem(CLAVE)).toBe('t1')
    useSessionStore.getState().setToken(null)
    expect(sessionStorage.getItem(CLAVE)).toBeNull()
  })

  it('sin almacenamiento disponible el token sigue en memoria', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    useSessionStore.getState().setToken('t2')
    expect(useSessionStore.getState().token).toBe('t2')
  })

  it('cerrarSesion borra también la sesión de actividades (D4) y guarda el motivo', () => {
    sessionStorage.setItem('sicedu.actividad', '{"id":1}')
    useSessionStore.getState().setToken('t3')
    useSessionStore.getState().cerrarSesion('expiracion')
    expect(sessionStorage.getItem('sicedu.actividad')).toBeNull()
    expect(useSessionStore.getState()).toMatchObject({ token: null, motivoCierre: 'expiracion' })
    useSessionStore.getState().limpiarMotivoCierre()
    expect(useSessionStore.getState().motivoCierre).toBeNull()
  })

  it('cerrarSesion limpia la memoria aunque el almacenamiento falle', () => {
    useSessionStore.setState({ token: 't4', usuario: usuarioDe(ROLES.DOCENTE) })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    useSessionStore.getState().cerrarSesion()
    expect(useSessionStore.getState()).toMatchObject({ token: null, usuario: null, motivoCierre: null })
  })

  it('rol() devuelve el id_rol del usuario o null sin sesión', () => {
    expect(useSessionStore.getState().rol()).toBeNull()
    useSessionStore.setState({ usuario: usuarioDe(ROLES.SUPERVISOR) })
    expect(useSessionStore.getState().rol()).toBe(ROLES.SUPERVISOR)
  })
})

describe('useExpiracionSesion (CU007)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // `exp` va en segundos enteros: con la hora en un segundo exacto el
    // vencimiento cae justo a los 480 minutos, sin fracciones de por medio.
    vi.setSystemTime(new Date('2026-10-10T08:00:00.000Z'))
  })

  it('dispara exactamente al cumplirse las 8 horas del token', () => {
    const onExpirar = vi.fn()
    renderHook(() => useExpiracionSesion({ token: jwtDePrueba({ exp: expEn(480) }), onExpirar }))

    vi.advanceTimersByTime(480 * 60_000 - 1000)
    expect(onExpirar).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1000)
    expect(onExpirar).toHaveBeenCalledTimes(1)
  })

  it('un token ya vencido al montar cierra en el acto', () => {
    const onExpirar = vi.fn()
    renderHook(() => useExpiracionSesion({ token: jwtDePrueba({ exp: expEn(-1) }), onExpirar }))
    expect(onExpirar).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['sin token', null],
    ['token del mock, sin exp', 'mock.1.2026'],
  ])('%s no programa nada', (_caso, token) => {
    const onExpirar = vi.fn()
    renderHook(() => useExpiracionSesion({ token, onExpirar }))
    vi.advanceTimersByTime(24 * 60 * 60_000)
    expect(onExpirar).not.toHaveBeenCalled()
  })

  it('al desmontar (logout manual) cancela el temporizador', () => {
    const onExpirar = vi.fn()
    const { unmount } = renderHook(() => useExpiracionSesion({ token: jwtDePrueba({ exp: expEn(480) }), onExpirar }))
    unmount()
    vi.advanceTimersByTime(480 * 60_000)
    expect(onExpirar).not.toHaveBeenCalled()
  })

  it('acota retardos mayores que un entero de 32 bits en vez de disparar al instante', () => {
    const onExpirar = vi.fn()
    renderHook(() => useExpiracionSesion({ token: jwtDePrueba({ exp: expEn(60 * 24 * 40) }), onExpirar }))
    vi.advanceTimersByTime(1000)
    expect(onExpirar).not.toHaveBeenCalled()
  })
})

describe('roles', () => {
  it('solo el Directivo es de solo lectura', () => {
    expect(esSoloLectura(ROLES.DIRECTIVO)).toBe(true)
    expect(esSoloLectura(ROLES.SUPERVISOR)).toBe(false)
    expect(esSoloLectura(ROLES.DOCENTE)).toBe(false)
  })

  it('un rol desconocido aterriza en el login', () => {
    expect(rutaInicioDe(99)).toBe('/login')
    expect(rutaInicioDe(undefined)).toBe('/login')
  })
})

describe('Guardas de ruta', () => {
  function montar(guarda, ruta = '/privada') {
    return render(
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route element={guarda}>
            <Route path="/privada" element={<p>contenido privado</p>} />
          </Route>
          <Route path="*" element={<RutaActual />} />
        </Routes>
      </MemoryRouter>,
    )
  }

  it.each([
    ['ProtectedRoute', <ProtectedRoute key="p" />],
    ['RoleRoute', <RoleRoute key="r" allow={[ROLES.DOCENTE]} />],
  ])('%s: mientras se verifica la sesión no muestra la ruta', (_nombre, guarda) => {
    useSessionStore.setState({ token: 't', usuario: null, cargando: true })
    montar(guarda)
    expect(screen.getByText('Verificando su sesión…')).toBeInTheDocument()
    expect(screen.queryByText('contenido privado')).not.toBeInTheDocument()
  })

  it('RoleRoute sin usuario manda al login', () => {
    useSessionStore.setState({ token: null, usuario: null, cargando: false })
    montar(<RoleRoute allow={[ROLES.DOCENTE]} />)
    expect(screen.getByLabelText('ruta actual')).toHaveTextContent('/login')
  })

  it('RoleRoute sin lista de roles permitidos no deja pasar a nadie', () => {
    useSessionStore.setState({ token: 't', usuario: usuarioDe(ROLES.SUPERVISOR), cargando: false })
    montar(<RoleRoute />)
    expect(screen.getByLabelText('ruta actual')).toHaveTextContent('/403')
  })

  it('ProtectedRoute con token pero sin perfil manda al login', () => {
    useSessionStore.setState({ token: 't', usuario: null, cargando: false })
    montar(<ProtectedRoute />)
    expect(screen.getByLabelText('ruta actual')).toHaveTextContent('/login')
  })
})
