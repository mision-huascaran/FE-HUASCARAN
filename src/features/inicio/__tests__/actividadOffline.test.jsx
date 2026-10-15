// CU009 — Una actividad se puede abrir y cerrar SIN conexión.
//
// El caso de uso lo dice así: "Si existe conexión a Internet, el sistema
// registra el inicio de la actividad en PostgreSQL" — si no la hay, se registra
// localmente y se envía después. Y lo que se envía después es la hora REAL en
// que ocurrió, no la de la sincronización (CU008).
//
// Esto funciona porque el backend diseñó los endpoints para ello: el UUID lo
// genera el cliente y `POST /actividades` es idempotente, así que reintentar no
// duplica; y `inicio` y `fin` son opcionales y viajan con zona horaria.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { crearQueryClient } from '../../../App'
import { ToastProvider } from '../../../components/ui'
import useActividad from '../useActividad'
import useActividadStore from '../../../store/actividadStore'
import useSessionStore from '../../../store/sessionStore'
import { ROLES } from '../../../auth/roles'

/** JWT de mentira pero bien formado: lo que importa es que trae `jti`. */
const base64url = (obj) => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const TOKEN = `x.${base64url({ sub: 1, jti: 'sesion-abc', exp: Math.floor(Date.now() / 1000) + 3600 })}.y`

const encolados = []

vi.mock('../../../lib/colaOffline', () => ({
  encolar: (item) => encolados.push(item),
  reintentarAhora: vi.fn(),
  hayPendientes: () => encolados.length,
  limpiarSiTodoSincronizado: vi.fn(),
  iniciarCola: vi.fn(),
  registrarEnviador: vi.fn(),
}))

// Si llegara a llamarse estando sin conexión, el test debe enterarse.
const iniciarEnServidor = vi.fn()
vi.mock('../../../api/resources/actividades', () => ({
  iniciarActividad: (...args) => iniciarEnServidor(...args),
  finalizarActividad: vi.fn(),
  ETIQUETA_ESTADO: {},
  ETIQUETA_SINCRONIZACION: {},
  etiquetaTipoCierre: () => '',
}))

function definirConexion(enLinea) {
  Object.defineProperty(window.navigator, 'onLine', { value: enLinea, configurable: true })
}

const envoltorio = ({ children }) => (
  <QueryClientProvider client={crearQueryClient()}>
    <ToastProvider>{children}</ToastProvider>
  </QueryClientProvider>
)

beforeEach(() => {
  encolados.length = 0
  iniciarEnServidor.mockClear()
  useActividadStore.getState().limpiar()
  useSessionStore.setState({
    token: TOKEN,
    usuario: { id_usuario: 1, id_rol: ROLES.DOCENTE, id_docente: 1, nombres: 'Prueba' },
    cargando: false,
  })
})

describe('Actividad sin conexión (CU009)', () => {
  it('se puede iniciar sin red: queda abierta y encolada', async () => {
    definirConexion(false)
    const { result } = renderHook(() => useActividad(), { wrapper: envoltorio })

    await result.current.iniciar()

    // La actividad queda ABIERTA: si no, el docente no podría registrar nada,
    // que es justo lo que CU009 permite hacer sin conexión.
    await waitFor(() => expect(useActividadStore.getState().sesion).toBeTruthy())
    // Y no se intentó llamar al servidor estando sin red.
    expect(iniciarEnServidor).not.toHaveBeenCalled()

    const encolado = encolados.find((e) => e.tipo === 'actividad-inicio')
    expect(encolado).toBeTruthy()
    // Se envía la hora REAL del inicio, no la de la sincronización (CU008).
    expect(encolado.payload.inicio).toMatch(/\d{4}-\d{2}-\d{2}T.*Z$/)
    // Y el mismo id que tiene en local: el endpoint es idempotente.
    expect(encolado.payload.id).toBe(useActividadStore.getState().sesion.id)
  })

  it('al finalizar sin red encola el cierre con su hora real', async () => {
    definirConexion(false)
    const { result } = renderHook(() => useActividad(), { wrapper: envoltorio })

    await result.current.iniciar()
    await waitFor(() => expect(useActividadStore.getState().sesion).toBeTruthy())
    const id = useActividadStore.getState().sesion.id

    await result.current.finalizar()

    const cierre = encolados.find((e) => e.tipo === 'actividad-cierre')
    expect(cierre).toBeTruthy()
    expect(cierre.payload.id).toBe(id)
    expect(cierre.payload.fin).toMatch(/\d{4}-\d{2}-\d{2}T.*Z$/)
  })

  it('con conexión va directo al servidor, sin pasar por la cola', async () => {
    definirConexion(true)
    iniciarEnServidor.mockResolvedValue({ estado: 'en_curso' })
    const { result } = renderHook(() => useActividad(), { wrapper: envoltorio })

    await result.current.iniciar()

    await waitFor(() => expect(iniciarEnServidor).toHaveBeenCalled())
    expect(encolados.find((e) => e.tipo === 'actividad-inicio')).toBeUndefined()
  })

  it('guarda el `jti` de la sesión con cada pendiente', async () => {
    // Si el docente vuelve a entrar antes de que se sincronice, el token ya es
    // otro y este dato sería irrecuperable: sin él, la actividad quedaría
    // colgada de la sesión equivocada y se perdería la trazabilidad (CU008).
    definirConexion(false)
    const { result } = renderHook(() => useActividad(), { wrapper: envoltorio })

    await result.current.iniciar()
    await waitFor(() => expect(useActividadStore.getState().sesion).toBeTruthy())
    await result.current.finalizar()

    expect(encolados.find((e) => e.tipo === 'actividad-inicio').payload.id_sesion).toBe('sesion-abc')
    expect(encolados.find((e) => e.tipo === 'actividad-cierre').payload.id_sesion).toBe('sesion-abc')
  })
})
