// D115 — El perfil para recargar sin conexión ya no vive en localStorage.
//
// QA encontró `sicedu.perfil` en Local Storage con el DNI, el correo y los
// nombres. Ahí solo quedan filtros, preferencias y el desfase del reloj
// (Ley N.º 29733). La copia (D82) pasa a IndexedDB, atada al `id_usuario`, y se
// usa SOLO si el servidor no contesta: un 401 o un 403 siguen cerrando.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { crearQueryClient } from '../../App'
import useSessionStore from '../../store/sessionStore'
import AuthProvider from '../AuthProvider'
import ProtectedRoute from '../ProtectedRoute'
import {
  guardarPerfilLocal,
  limpiarDatosLocalesDeSesion,
  limpiarSiEsOtroUsuario,
  perfilLocalDe,
} from '../../lib/datosLocales'

vi.mock('idb-keyval', () => {
  let almacen = {}
  return {
    get: vi.fn(async (k) => almacen[k]),
    set: vi.fn(async (k, v) => {
      almacen[k] = v
    }),
    del: vi.fn(async (k) => {
      delete almacen[k]
    }),
    __vaciar: () => {
      almacen = {}
    },
  }
})

const obtenerPerfil = vi.fn()
vi.mock('../../api/resources/auth', async (importOriginal) => ({
  ...(await importOriginal()),
  obtenerPerfil: (...a) => obtenerPerfil(...a),
}))

const ESPERA = { timeout: 8000 }
const PERFIL = { id_usuario: 7, id_rol: 1, correo: 'docente@sicedu.test', dni: '12345678', nombres: 'Rosa' }

const tokenDe = (idUsuario) => {
  const exp = Math.floor(Date.now() / 1000) + 8 * 60 * 60
  const parte = (o) => btoa(JSON.stringify(o)).replace(/=+$/, '')
  return `${parte({ alg: 'HS256' })}.${parte({ exp, id_usuario: idUsuario })}.firma`
}
const sinRespuesta = () => Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' })
const conEstado = (status) => Object.assign(new Error('fallo'), { response: { status, data: {} } })

function recargarCon(token) {
  useSessionStore.setState({ token, usuario: null, cargando: true, servidorInalcanzable: false, motivoCierre: null })
  return render(
    <QueryClientProvider client={crearQueryClient()}>
      <MemoryRouter initialEntries={['/inicio']}>
        <AuthProvider>
          <Routes>
            <Route element={<ProtectedRoute />}>
              <Route path="/inicio" element={<p>Pantalla de Inicio</p>} />
            </Route>
            <Route path="/login" element={<p>Pantalla de login</p>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const enLocalStorage = () =>
  Array.from({ length: localStorage.length }, (_, i) => `${localStorage.key(i)}=${localStorage.getItem(localStorage.key(i))}`).join('|')

beforeEach(async () => {
  const idb = await import('idb-keyval')
  idb.__vaciar()
  localStorage.clear()
  obtenerPerfil.mockReset()
})

afterEach(() => useSessionStore.setState({ token: null, usuario: null, servidorInalcanzable: false }))

describe('Dónde vive la copia del perfil (D115)', () => {
  it('al iniciar sesión con red, el perfil NO queda en localStorage', async () => {
    obtenerPerfil.mockResolvedValue(PERFIL)
    recargarCon(tokenDe(7))

    await screen.findByText('Pantalla de Inicio', {}, ESPERA)
    expect(localStorage.getItem('sicedu.perfil')).toBeNull()
    expect(enLocalStorage()).not.toContain('12345678')
    expect(enLocalStorage()).not.toContain('docente@sicedu.test')
    expect(await perfilLocalDe(7)).toEqual(PERFIL)
  })

  it('la clave vieja de localStorage se borra al arrancar', async () => {
    localStorage.setItem('sicedu.perfil', JSON.stringify(PERFIL))
    obtenerPerfil.mockResolvedValue(PERFIL)
    recargarCon(tokenDe(7))

    await screen.findByText('Pantalla de Inicio', {}, ESPERA)
    expect(localStorage.getItem('sicedu.perfil')).toBeNull()
  })
})

describe('Recargar sin conexión (D82 con D115)', () => {
  it('encuentra el perfil del MISMO usuario y entra', async () => {
    await guardarPerfilLocal(PERFIL)
    obtenerPerfil.mockRejectedValue(sinRespuesta())
    recargarCon(tokenDe(7))

    await screen.findByText('Pantalla de Inicio', {}, ESPERA)
    expect(useSessionStore.getState().usuario).toEqual(PERFIL)
  })

  it('con el token de OTRA cuenta la copia no sirve', async () => {
    await guardarPerfilLocal(PERFIL)
    obtenerPerfil.mockRejectedValue(sinRespuesta())
    recargarCon(tokenDe(8))

    await screen.findByText(/no se pudo contactar con el servidor/i, {}, ESPERA)
    expect(useSessionStore.getState().usuario).toBeNull()
  })

  it('un 401 sigue cerrando la sesión aunque haya copia', async () => {
    await guardarPerfilLocal(PERFIL)
    obtenerPerfil.mockRejectedValue(conEstado(401))
    recargarCon(tokenDe(7))

    await screen.findByText('Pantalla de login', {}, ESPERA)
    expect(useSessionStore.getState().token).toBeNull()
  })
})

describe('Se borra con la sesión (D115)', () => {
  it('al cerrar sesión', async () => {
    await guardarPerfilLocal(PERFIL)
    await limpiarDatosLocalesDeSesion()
    expect(await perfilLocalDe(7)).toBeNull()
  })

  it('cuando entra otra cuenta', async () => {
    await limpiarSiEsOtroUsuario(7)
    await guardarPerfilLocal(PERFIL)

    await limpiarSiEsOtroUsuario(8)
    expect(await perfilLocalDe(7)).toBeNull()
  })

  it('sin id no se guarda ni se devuelve nada', async () => {
    await guardarPerfilLocal({ correo: 'x@sicedu.test' })
    expect(await perfilLocalDe(null)).toBeNull()
  })
})
