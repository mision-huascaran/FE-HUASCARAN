// D52 — Un servidor caído no es una sesión terminada (CU011, CU012).
//
// Antes cualquier fallo de `GET /me` borraba la sesión. Con el backend caído,
// recargar echaba al usuario al login y le hacía creer que su sesión había
// expirado: dos cosas muy distintas, porque de una se vuelve esperando y de la
// otra hay que entrar otra vez.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { crearQueryClient } from '../../App'
import useSessionStore from '../../store/sessionStore'
import AuthProvider from '../AuthProvider'
import ProtectedRoute from '../ProtectedRoute'

const ESPERA = { timeout: 8000 }

const obtenerPerfil = vi.fn()

vi.mock('../../api/resources/auth', async (importOriginal) => ({
  ...(await importOriginal()),
  obtenerPerfil: (...a) => obtenerPerfil(...a),
}))

/** Un JWT de verdad con 8 horas por delante, para no cortar por caducidad. */
const tokenVigente = () => {
  const exp = Math.floor(Date.now() / 1000) + 8 * 60 * 60
  const parte = (o) => btoa(JSON.stringify(o)).replace(/=+$/, '')
  return `${parte({ alg: 'HS256' })}.${parte({ exp, sub: '4' })}.firma`
}

const sinRespuesta = () => Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' })
const conEstado = (status) => Object.assign(new Error('fallo'), { response: { status, data: {} } })

function montar() {
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

beforeEach(() => {
  obtenerPerfil.mockReset()
  useSessionStore.setState({
    token: tokenVigente(),
    usuario: null,
    cargando: true,
    servidorInalcanzable: false,
    motivoCierre: null,
  })
})

afterEach(() => useSessionStore.setState({ token: null, usuario: null, servidorInalcanzable: false }))

describe('El servidor no contesta', () => {
  it('sin respuesta NO cierra la sesión ni manda al login', async () => {
    obtenerPerfil.mockRejectedValue(sinRespuesta())

    montar()

    await screen.findByText(/no se pudo contactar con el servidor/i, {}, ESPERA)
    expect(screen.queryByText('Pantalla de login')).not.toBeInTheDocument()
    // Y lo importante: el token sigue ahí. La sesión no terminó.
    expect(useSessionStore.getState().token).not.toBeNull()
  })

  it('un 500 tampoco: el token es válido, lo que falla es el servidor', async () => {
    obtenerPerfil.mockRejectedValue(conEstado(500))

    montar()

    await screen.findByText(/no se pudo contactar con el servidor/i, {}, ESPERA)
    expect(useSessionStore.getState().token).not.toBeNull()
  })

  it('un 401 SÍ cierra la sesión: ahí el token no sirve', async () => {
    // La distinción es el fondo del defecto: no todo fallo es lo mismo.
    obtenerPerfil.mockRejectedValue(conEstado(401))

    montar()

    await screen.findByText('Pantalla de login', {}, ESPERA)
    expect(useSessionStore.getState().token).toBeNull()
  })

  it('un 403 también cierra', async () => {
    obtenerPerfil.mockRejectedValue(conEstado(403))

    montar()

    await screen.findByText('Pantalla de login', {}, ESPERA)
    expect(useSessionStore.getState().token).toBeNull()
  })

  it('no reintenta solo en bucle, pero el perfil entra cuando el servidor vuelve', async () => {
    /**
     * Reintentar sin parar contra un servidor que no responde no arregla nada
     * y llena la consola; por eso se espera a que la persona lo pida. Lo que
     * sí tiene que funcionar es que, al pedirlo, el perfil se vuelva a pedir:
     * antes la marca de "ya pedí el perfil para este token" lo impedía.
     */
    obtenerPerfil.mockRejectedValueOnce(sinRespuesta())

    montar()
    await screen.findByText(/no se pudo contactar con el servidor/i, {}, ESPERA)

    const intentos = obtenerPerfil.mock.calls.length
    obtenerPerfil.mockResolvedValue({ id_usuario: 4, id_rol: 2, nombres: 'Sara' })

    // Es lo que hace el botón "Reintentar".
    useSessionStore.getState().setServidorInalcanzable(false)

    await screen.findByText('Pantalla de Inicio', {}, ESPERA)
    await waitFor(() => expect(obtenerPerfil.mock.calls.length).toBeGreaterThan(intentos))
  })
})
