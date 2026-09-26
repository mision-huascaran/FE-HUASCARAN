// Recuperación de contraseña SIN sesión, desde el inicio de sesión (CU003).
//
// Va contra `POST /password/recuperar` y `/password/restablecer`, que son
// públicos. Antes esta pantalla llamaba a `/me/password/codigo`, que exige
// sesión iniciada, así que siempre respondía 401.
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { crearQueryClient } from '../../../App'
import { ToastProvider } from '../../../components/ui'
import ModalRecuperarPassword from '../ModalRecuperarPassword'

const ESPERA = { timeout: 8000 }

function montar(props = {}) {
  return render(
    <QueryClientProvider client={crearQueryClient()}>
      <ToastProvider>
        <ModalRecuperarPassword abierto onCerrar={() => {}} {...props} />
      </ToastProvider>
    </QueryClientProvider>,
  )
}

describe('Recuperar contraseña (CU003)', () => {
  it('abre en el primer paso y no pide el código todavía', () => {
    montar()
    expect(screen.getByRole('heading', { name: /recuperar contraseña/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/Correo institucional/)).toBeInTheDocument()
    expect(screen.queryByLabelText(/Código recibido/)).not.toBeInTheDocument()
  })

  it('no envía el código mientras el correo no tenga forma válida', () => {
    montar()
    const enviar = screen.getByRole('button', { name: /enviarme el código/i })
    expect(enviar).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/Correo institucional/), { target: { value: 'sin-arroba' } })
    expect(enviar).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/Correo institucional/), { target: { value: 'rosa@sicedu.test' } })
    expect(enviar).toBeEnabled()
  })

  it('arranca con el correo que ya venía escrito en el inicio de sesión', () => {
    montar({ correoInicial: 'jefatura@sicedu.test' })
    expect(screen.getByLabelText(/Correo institucional/)).toHaveValue('jefatura@sicedu.test')
    expect(screen.getByRole('button', { name: /enviarme el código/i })).toBeEnabled()
  })

  it('tras pedir el código pasa al segundo paso sin revelar si el correo existe', async () => {
    montar({ correoInicial: 'rosa@sicedu.test' })
    fireEvent.click(screen.getByRole('button', { name: /enviarme el código/i }))

    expect(await screen.findByLabelText(/Código recibido/, {}, ESPERA)).toBeInTheDocument()
    // "Si ese correo está registrado…": nunca se confirma que exista.
    expect(screen.getByText(/Si ese correo está registrado/i)).toBeInTheDocument()
    // El correo queda fijo: el código se pidió para ese y no para otro.
    expect(screen.getByLabelText(/Correo institucional/)).toBeDisabled()
  })

  it('exige código de 6 caracteres, formato válido y que las dos contraseñas coincidan', async () => {
    montar({ correoInicial: 'rosa@sicedu.test' })
    fireEvent.click(screen.getByRole('button', { name: /enviarme el código/i }))
    await screen.findByLabelText(/Código recibido/, {}, ESPERA)

    const guardar = screen.getByRole('button', { name: /cambiar contraseña/i })
    expect(guardar).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/Código recibido/), { target: { value: 'AB12CD' } })
    fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: 'corta' } })
    fireEvent.change(screen.getByLabelText(/Repita la nueva contraseña/), { target: { value: 'corta' } })
    expect(screen.getByText('Mínimo 8 caracteres, solo letras y números')).toBeInTheDocument()
    expect(guardar).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: 'Sicedu2026' } })
    fireEvent.change(screen.getByLabelText(/Repita la nueva contraseña/), { target: { value: 'Sicedu2027' } })
    expect(screen.getByText('Las contraseñas no coinciden')).toBeInTheDocument()
    expect(guardar).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/Repita la nueva contraseña/), { target: { value: 'Sicedu2026' } })
    expect(guardar).toBeEnabled()
  })
})
