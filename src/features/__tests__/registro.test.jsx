import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import RegistroPage from '../login/RegistroPage'

describe('Registro de cuenta', () => {
  it('muestra la pantalla de alta con validación base y acceso a login', () => {
    render(
      <MemoryRouter initialEntries={['/registro']}>
        <Routes>
          <Route path="/registro" element={<RegistroPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: /crear cuenta/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/correo/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /registrarme/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /volver al inicio de sesión/i })).toBeInTheDocument()
  })
})
