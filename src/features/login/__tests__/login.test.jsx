// P1 / RF-001: validación del formulario, mensaje único para el 401 y redirección
// por rol después de un ingreso correcto.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import RutasApp from '../../../rutas'
import { crearQueryClient } from '../../../App'
import { ToastProvider } from '../../../components/ui'
import AuthProvider from '../../../auth/AuthProvider'
import useSessionStore from '../../../store/sessionStore'
import { CLAVE_DEMO, USUARIOS } from '../../../api/mock/db'
import handlers from '../../../api/mock/handlers'
import { z } from 'zod'
// Carga el módulo del login: ahí se configura zod (`jitless`).
import '../LoginPage'

const DOCENTE = USUARIOS.find((u) => u.id_rol === 1)

function renderLogin() {
  return render(
    <QueryClientProvider client={crearQueryClient()}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/login']}>
          <AuthProvider>
            <RutasApp />
          </AuthProvider>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  useSessionStore.setState({ token: null, usuario: null, cargando: false })
  sessionStorage.clear()
})

describe('LoginPage', () => {
  it('valida el correo y el largo de la contraseña antes de llamar a la API', async () => {
    renderLogin()
    await userEvent.type(screen.getByLabelText(/Correo/), 'no-es-un-correo')
    await userEvent.type(screen.getByLabelText(/Contraseña/), '123')
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }))

    expect(await screen.findByText('Ingresa un correo válido')).toBeInTheDocument()
    expect(screen.getByText('La contraseña debe tener al menos 8 caracteres')).toBeInTheDocument()
  })

  it('zod valida sin JIT: la CSP no permite eval (F10)', () => {
    renderLogin()
    expect(z.config().jitless).toBe(true)
  })

  it('con el correo vacío pide el correo, no un correo válido (zod 4)', async () => {
    // El correo vacío incumple dos reglas (min y email): se muestra la primera.
    renderLogin()
    await userEvent.type(screen.getByLabelText(/Contraseña/), 'claveclave')
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }))

    expect(await screen.findByText('Ingresa tu correo')).toBeInTheDocument()
    expect(screen.queryByText('Ingresa un correo válido')).not.toBeInTheDocument()
  })

  it('ante un 401 no revela cuál de los dos campos falló', async () => {
    renderLogin()
    await userEvent.type(screen.getByLabelText(/Correo/), DOCENTE.correo)
    await userEvent.type(screen.getByLabelText(/Contraseña/), 'claveequivocada')
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Correo o contraseña incorrectos')
  })

  it('oculta la creación de cuenta en el login y ofrece recuperación de contraseña', async () => {
    renderLogin()

    expect(screen.queryByRole('button', { name: /crear cuenta/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /¿olvidaste tu contraseña\?/i })).toBeInTheDocument()
  })

  it('con credenciales válidas lleva al inicio que corresponde al rol', async () => {
    renderLogin()
    await userEvent.type(screen.getByLabelText(/Correo/), DOCENTE.correo)
    await userEvent.type(screen.getByLabelText(/Contraseña/), CLAVE_DEMO)
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }))

    // El saludo del panel cambia con la hora; "Mis asignaciones" no.
    expect(await screen.findByText('Mis asignaciones')).toBeInTheDocument()
    // RNF-003: el token se respalda en sessionStorage, nunca en localStorage.
    expect(sessionStorage.getItem('sicedu.token')).toBeTruthy()
    expect(localStorage.getItem('sicedu.token')).toBeNull()
  })
})

describe('Login al volver la conexión', () => {
  const SIN_CONEXION = /No se pudo establecer conexión con el servidor/
  const fijarRed = (valor) => Object.defineProperty(window.navigator, 'onLine', { value: valor, configurable: true })
  afterEach(() => {
    fijarRed(true)
    vi.restoreAllMocks()
  })

  it('aunque el evento online se pierda, al volver a la pestaña quita el aviso y habilita Ingresar', async () => {
    renderLogin()
    act(() => {
      fijarRed(false)
      window.dispatchEvent(new Event('offline'))
    })
    expect(await screen.findByText(SIN_CONEXION)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeDisabled()

    fijarRed(true)
    act(() => window.dispatchEvent(new Event('focus')))

    await waitFor(() => expect(screen.queryByText(SIN_CONEXION)).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeEnabled()
  })

  it('el aviso rojo de un intento sin respuesta se quita cuando vuelve la conexión', async () => {
    // El servidor no contesta: la red se cayó a mitad del intento.
    vi.spyOn(handlers.auth, 'login').mockRejectedValue(Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' }))
    renderLogin()
    await userEvent.type(screen.getByLabelText(/Correo/), DOCENTE.correo)
    await userEvent.type(screen.getByLabelText(/Contraseña/), CLAVE_DEMO)
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }))
    expect(await screen.findByText(SIN_CONEXION)).toBeInTheDocument()

    act(() => {
      fijarRed(false)
      window.dispatchEvent(new Event('offline'))
    })
    act(() => {
      fijarRed(true)
      window.dispatchEvent(new Event('online'))
    })

    await waitFor(() => expect(screen.queryByText(SIN_CONEXION)).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeEnabled()
  })
})
