// D05 — Cerrar sesión SIN conexión con una actividad abierta (CP09, CP-INI-13).
//
// Antes el cliente olvidaba la actividad y el `/logout` nunca llegaba: en el
// servidor quedaba abierta para siempre y la sesión siguiente no podía iniciar
// otra (409) ni cerrarla. Ahora el cierre queda en la cola con la hora real de
// salida, y una sesión nueva adopta la actividad que el servidor reporta abierta.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, renderHook, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { crearQueryClient } from '../../App'
import { ToastProvider } from '../../components/ui'
import { AuthProvider, useAuth } from '../AuthProvider'
import useActividad from '../../features/inicio/useActividad'
import useActividadStore from '../../store/actividadStore'
import useSessionStore from '../../store/sessionStore'
import { ROLES } from '../roles'

const encolados = []
vi.mock('../../lib/colaOffline', () => ({
  encolar: (item) => {
    encolados.push(item)
    return Promise.resolve()
  },
  reintentarAhora: vi.fn(),
  hayPendientes: () => encolados.length,
  limpiarSiTodoSincronizado: vi.fn(async () => false),
  iniciarCola: vi.fn(),
  registrarEnviador: vi.fn(),
}))

const limpiarLocal = vi.fn(async () => {})
vi.mock('../../lib/datosLocales', () => ({ limpiarDatosLocalesDeSesion: () => limpiarLocal() }))

const logout = vi.fn()
vi.mock('../../api/resources/auth', async (importOriginal) => ({
  ...(await importOriginal()),
  cerrarSesionEnServidor: () => logout(),
}))

const inicioDocente = vi.fn()
vi.mock('../../api/resources/inicio', () => ({
  obtenerInicioDocente: () => inicioDocente(),
  obtenerInicioSupervisor: vi.fn(),
  obtenerInicioDirectivo: vi.fn(),
  obtenerResumenDocente: vi.fn(),
  obtenerResumenSupervisor: vi.fn(),
}))

const base64url = (obj) => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const TOKEN = `x.${base64url({ sub: 1, jti: 'sesion-1', exp: Math.floor(Date.now() / 1000) + 3600 })}.y`

const envoltorio = ({ children }) => (
  <QueryClientProvider client={crearQueryClient()}>
    <ToastProvider>
      <AuthProvider>{children}</AuthProvider>
    </ToastProvider>
  </QueryClientProvider>
)

beforeEach(() => {
  encolados.length = 0
  logout.mockReset()
  limpiarLocal.mockClear()
  inicioDocente.mockReset()
  inicioDocente.mockResolvedValue({ actividad_activa: null, asignaciones: [] })
  useActividadStore.getState().limpiar()
  useActividadStore.setState({ cerradas: [] })
  useSessionStore.setState({
    token: TOKEN,
    usuario: { id_usuario: 1, id_rol: ROLES.DOCENTE, id_docente: 1, nombres: 'Prueba' },
    cargando: false,
  })
})

describe('Cerrar sesión sin conexión (D05, D03)', () => {
  it('deja el cierre de la actividad pendiente, con la hora real de salida', async () => {
    logout.mockResolvedValue({ ok: false, sinRespuesta: true })
    const abierta = useActividadStore.getState().iniciar({ idDocente: 1 })
    const { result } = renderHook(() => useAuth(), { wrapper: envoltorio })

    const antes = Date.now()
    await act(() => result.current.salir())

    const cierre = encolados.find((e) => e.tipo === 'actividad-cierre')
    expect(cierre).toBeTruthy()
    expect(cierre.payload.id).toBe(abierta.id)
    expect(new Date(cierre.payload.fin).getTime()).toBeGreaterThanOrEqual(antes - 1000)
    expect(cierre.payload.id_sesion).toBe('sesion-1')
    // Y la sesión se cierra igual, borrando la precarga y los filtros (D03).
    expect(limpiarLocal).toHaveBeenCalled()
    expect(useSessionStore.getState().token).toBeNull()
  })

  it('con conexión no encola nada: el servidor ya cerró la actividad', async () => {
    logout.mockResolvedValue({ ok: true })
    useActividadStore.getState().iniciar({ idDocente: 1 })
    const { result } = renderHook(() => useAuth(), { wrapper: envoltorio })

    await act(() => result.current.salir())

    expect(encolados).toHaveLength(0)
    expect(limpiarLocal).toHaveBeenCalled()
  })
})

describe('Actividad abierta en el servidor (D05)', () => {
  it('una sesión nueva la adopta para poder finalizarla', async () => {
    inicioDocente.mockResolvedValue({
      actividad_activa: { id: 'act-servidor', inicio: '2026-10-09T14:48:38Z' },
      asignaciones: [],
    })
    const { result } = renderHook(() => useActividad(), { wrapper: envoltorio })

    await waitFor(() => expect(result.current.sesion?.id).toBe('act-servidor'))
  })

  it('no resucita una actividad que este navegador ya cerró', async () => {
    useActividadStore.setState({ cerradas: ['act-cerrada'] })
    inicioDocente.mockResolvedValue({
      actividad_activa: { id: 'act-cerrada', inicio: '2026-10-09T14:48:38Z' },
      asignaciones: [],
    })
    render(<Sonda />, { wrapper: envoltorio })

    await waitFor(() => expect(inicioDocente).toHaveBeenCalled())
    await new Promise((listo) => setTimeout(listo, 50))
    expect(useActividadStore.getState().sesion).toBeNull()
  })
})

function Sonda() {
  useActividad()
  return null
}
