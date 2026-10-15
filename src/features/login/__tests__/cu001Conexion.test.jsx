// CU001 — Sin conexión, el ingreso se bloquea de forma visible.
//
// El caso de uso es literal: se deshabilitan el botón "Ingresar" Y la opción de
// recuperar contraseña, y se muestra un mensaje concreto. Antes solo se
// deshabilitaba el botón y el texto era otro.
import { afterEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { crearQueryClient } from '../../../App'
import { ToastProvider } from '../../../components/ui'
import AuthProvider from '../../../auth/AuthProvider'
import LoginPage, { MENSAJE } from '../LoginPage'

function definirConexion(enLinea) {
  Object.defineProperty(window.navigator, 'onLine', { value: enLinea, configurable: true })
}

afterEach(() => definirConexion(true))

function montar() {
  return render(
    <QueryClientProvider client={crearQueryClient()}>
      <ToastProvider>
        <MemoryRouter>
          <AuthProvider>
            <LoginPage />
          </AuthProvider>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

describe('Inicio de sesión sin conexión (CU001)', () => {
  it('deshabilita ingresar Y recuperar contraseña, y explica por qué', () => {
    definirConexion(false)
    montar()

    expect(screen.getByRole('button', { name: /ingresar/i })).toBeDisabled()
    // Recuperar contraseña también necesita servidor de principio a fin (CU004).
    expect(screen.getByRole('button', { name: /olvidó su contraseña/i })).toBeDisabled()
    expect(screen.getByText(MENSAJE.sinConexion)).toBeInTheDocument()
  })

  it('con conexión los dos controles están disponibles', () => {
    definirConexion(true)
    montar()

    expect(screen.getByRole('button', { name: /ingresar/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /olvidó su contraseña/i })).toBeEnabled()
    expect(screen.queryByText(MENSAJE.sinConexion)).not.toBeInTheDocument()
  })
})
