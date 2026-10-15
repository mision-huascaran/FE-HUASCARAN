// Interceptores de axios y conmutador mock/API real (api/client.js).
//
// Se sustituye el adaptador HTTP de axios por petición: ninguna llamada sale a
// la red, pero la petición sí recorre los interceptores de verdad.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, resolver } from '../client'
import useSessionStore from '../../store/sessionStore'
import { ROLES } from '../../auth/roles'
import { iniciarSesionComo } from '../../test/renderConProveedores'

/** Adaptador que responde con las cabeceras que recibió, para inspeccionarlas. */
const eco = async (config) => ({ data: config.headers, status: 200, statusText: 'OK', headers: {}, config })

/** Adaptador que falla con el estado y el cuerpo indicados. */
const falla = (status, data = {}) => async (config) => {
  const error = new Error(`HTTP ${status}`)
  error.config = config
  error.response = { status, data, config, headers: {} }
  throw error
}

const sesion = () => useSessionStore.getState()

beforeEach(() => {
  iniciarSesionComo(ROLES.DOCENTE)
})

describe('Interceptor de petición', () => {
  it('adjunta el token como Bearer', async () => {
    const { data } = await api.get('/me', { adapter: eco })
    expect(data.Authorization).toBe(`Bearer ${sesion().token}`)
  })

  it('sin sesión no manda cabecera Authorization', async () => {
    iniciarSesionComo(null)
    const { data } = await api.get('/password/recuperar', { adapter: eco })
    expect(data.Authorization).toBeUndefined()
  })

  it('pide no guardar las respuestas en caché HTTP (RNF-003)', async () => {
    const { data } = await api.get('/alumnos', { adapter: eco })
    expect(data['Cache-Control']).toBe('no-store')
  })
})

describe('Interceptor de respuesta', () => {
  it('401 por sesión expirada: cierra la sesión y deja el motivo para el login (CU007)', async () => {
    await expect(api.get('/alumnos', { adapter: falla(401, { motivo: 'sesion_expirada' }) })).rejects.toThrow()
    expect(sesion()).toMatchObject({ token: null, usuario: null, motivoCierre: 'expiracion' })
  })

  it('401 por token inválido: cierra la sesión sin hablar de tiempo', async () => {
    await expect(api.get('/alumnos', { adapter: falla(401, { motivo: 'sesion_invalida' }) })).rejects.toThrow()
    expect(sesion()).toMatchObject({ token: null, motivoCierre: null })
  })

  it('401 del propio /login no toca la sesión: son credenciales equivocadas', async () => {
    const token = sesion().token
    await expect(api.post('/login', {}, { adapter: falla(401) })).rejects.toThrow()
    expect(sesion().token).toBe(token)
  })

  it('403 marca el error como "sin permiso" y NO cierra la sesión', async () => {
    const error = await api.delete('/usuarios/9', { adapter: falla(403) }).catch((e) => e)
    expect(error.sinPermiso).toBe(true)
    expect(sesion().usuario).not.toBeNull()
  })

  it('otros errores pasan tal cual, sin marcar ni cerrar nada', async () => {
    const error = await api.get('/colegios', { adapter: falla(500) }).catch((e) => e)
    expect(error.response.status).toBe(500)
    expect(error.sinPermiso).toBeUndefined()
    expect(sesion().usuario).not.toBeNull()
  })

  it('un fallo de red sin respuesta no cierra la sesión (RN-017: la red se cae a menudo)', async () => {
    const sinRed = async (config) => {
      throw Object.assign(new Error('Network Error'), { config })
    }
    await expect(api.get('/alumnos', { adapter: sinRed })).rejects.toThrow('Network Error')
    expect(sesion().usuario).not.toBeNull()
  })
})

describe('resolver: mock o API real', () => {
  it('en modo mock no toca la API', async () => {
    const real = vi.fn()
    await expect(resolver({ mock: () => 'del mock', real })).resolves.toBe('del mock')
    expect(real).not.toHaveBeenCalled()
  })

  it('con forzarReal llama a la API y devuelve solo el cuerpo', async () => {
    const mock = vi.fn()
    const real = vi.fn(async () => ({ data: { ok: true }, status: 200 }))
    await expect(resolver({ mock, real, forzarReal: true })).resolves.toEqual({ ok: true })
    expect(mock).not.toHaveBeenCalled()
  })

  it('con forzarReal y una respuesta vacía devuelve undefined en vez de romper', async () => {
    await expect(resolver({ mock: vi.fn(), real: async () => undefined, forzarReal: true })).resolves.toBeUndefined()
  })
})

describe('Configuración por entorno (se evalúa al cargar el módulo)', () => {
  const cargarCliente = async (env) => {
    vi.resetModules()
    Object.entries(env).forEach(([clave, valor]) => vi.stubEnv(clave, valor))
    return import('../client')
  }

  let aviso
  let info

  beforeEach(() => {
    aviso = vi.spyOn(console, 'warn').mockImplementation(() => {})
    info = vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('en producción contra la API real avisa si la URL no es https (RNF-003)', async () => {
    await cargarCliente({ PROD: true, DEV: false, VITE_USE_MOCK: 'false', VITE_API_BASE_URL: 'http://api.inseguro' })
    expect(aviso).toHaveBeenCalledWith(expect.stringContaining('https'))
  })

  it('en producción con https no avisa', async () => {
    await cargarCliente({ PROD: true, DEV: false, VITE_USE_MOCK: 'false', VITE_API_BASE_URL: 'https://sicedu.example/api' })
    expect(aviso).not.toHaveBeenCalled()
  })

  it.each([
    [{ VITE_USE_MOCK: 'false' }, 'todo contra la API real', { auth: true, admin: true }],
    [{ VITE_USE_MOCK: 'true', VITE_AUTH_REAL: 'true', VITE_ADMIN_REAL: 'false' }, 'sesión contra la API real', { auth: true, admin: false }],
    [{ VITE_USE_MOCK: 'true', VITE_AUTH_REAL: 'false', VITE_ADMIN_REAL: 'true' }, 'todo desde el mock', { auth: false, admin: true }],
  ])('en desarrollo informa el origen de los datos: %o', async (env, texto, esperado) => {
    const cliente = await cargarCliente({ PROD: false, DEV: true, ...env })
    expect(info).toHaveBeenCalledWith(expect.stringContaining(texto), expect.any(String), expect.any(String))
    expect(cliente.authContraApiReal).toBe(esperado.auth)
    expect(cliente.adminContraApiReal).toBe(esperado.admin)
  })

  it('la consola de desarrollo nunca recibe el token de la sesión (RNF-003)', async () => {
    iniciarSesionComo(ROLES.SUPERVISOR)
    const token = sesion().token
    await cargarCliente({ PROD: false, DEV: true, VITE_USE_MOCK: 'true' })
    const impreso = info.mock.calls.flat().join(' ')
    expect(impreso).not.toContain(token)
  })
})
