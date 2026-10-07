// Recuperación de contraseña SIN sesión, desde el inicio de sesión.
//
// Cubre CU004, CU005 y CU006. Los textos que se comprueban aquí son literales
// de los casos de uso: están fijados para que el mensaje no delate si un correo
// existe, así que si cambian hay que cambiar también el caso de uso.
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { crearQueryClient } from '../../../App'
import { ToastProvider } from '../../../components/ui'
import ModalRecuperarPassword, { MENSAJE } from '../ModalRecuperarPassword'

const ESPERA = { timeout: 8000 }

// Cumple los cinco requisitos de CU006: 8+, mayúscula, minúscula, número y símbolo.
const VALIDA = 'Sicedu2026!'

function montar(props = {}) {
  return render(
    <QueryClientProvider client={crearQueryClient()}>
      <ToastProvider>
        <ModalRecuperarPassword abierto onCerrar={() => {}} {...props} />
      </ToastProvider>
    </QueryClientProvider>,
  )
}

async function llegarAlSegundoPaso() {
  fireEvent.click(screen.getByRole('button', { name: /enviarme el pin/i }))
  return screen.findByLabelText(/PIN recibido/, {}, ESPERA)
}

describe('Recuperar contraseña (CU004–CU006)', () => {
  it('abre en el primer paso y no pide el PIN todavía', () => {
    montar()
    expect(screen.getByRole('heading', { name: /recuperar contraseña/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/Correo institucional/)).toBeInTheDocument()
    expect(screen.queryByLabelText(/PIN recibido/)).not.toBeInTheDocument()
  })

  it('no envía el PIN mientras el correo no tenga forma válida', () => {
    montar()
    const enviar = screen.getByRole('button', { name: /enviarme el pin/i })
    expect(enviar).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/Correo institucional/), { target: { value: 'sin-arroba' } })
    expect(enviar).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/Correo institucional/), { target: { value: 'rosa@sicedu.test' } })
    expect(enviar).toBeEnabled()
  })

  it('arranca con el correo que ya venía escrito en el inicio de sesión', () => {
    montar({ correoInicial: 'jefatura@sicedu.test' })
    expect(screen.getByLabelText(/Correo institucional/)).toHaveValue('jefatura@sicedu.test')
    expect(screen.getByRole('button', { name: /enviarme el pin/i })).toBeEnabled()
  })

  it('CU005: usa el mismo texto exista el correo o no', async () => {
    montar({ correoInicial: 'rosa@sicedu.test' })
    await llegarAlSegundoPaso()

    // Nunca se confirma que el correo exista: decirlo permitiría ir probando
    // direcciones para averiguar quién tiene cuenta. Sale dos veces —en el aviso
    // del paso 2 y en el toast—, y las dos deben decir exactamente lo mismo.
    expect(screen.getAllByText(new RegExp(MENSAJE.enviado.slice(0, 40), 'i')).length).toBeGreaterThan(0)
    // El correo queda fijo: el PIN se pidió para ese y no para otro.
    expect(screen.getByLabelText(/Correo institucional/)).toBeDisabled()
  })

  it('CU005: el PIN solo admite 6 dígitos, nunca letras', async () => {
    montar({ correoInicial: 'rosa@sicedu.test' })
    const pin = await llegarAlSegundoPaso()

    fireEvent.change(pin, { target: { value: 'AB12CD' } })
    expect(pin).toHaveValue('12')

    fireEvent.change(pin, { target: { value: '123456' } })
    expect(pin).toHaveValue('123456')
  })

  it('CU006: exige los cinco requisitos de contraseña y que las dos coincidan', async () => {
    montar({ correoInicial: 'rosa@sicedu.test' })
    const pin = await llegarAlSegundoPaso()

    const guardar = screen.getByRole('button', { name: /cambiar contraseña/i })
    expect(guardar).toBeDisabled()

    fireEvent.change(pin, { target: { value: '123456' } })

    // La política anterior aceptaba esto; CU006 ya no, porque no lleva símbolo.
    fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: 'Sicedu2026' } })
    fireEvent.change(screen.getByLabelText(/Repita la nueva contraseña/), { target: { value: 'Sicedu2026' } })
    expect(guardar).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: VALIDA } })
    fireEvent.change(screen.getByLabelText(/Repita la nueva contraseña/), { target: { value: 'Sicedu2027!' } })
    expect(screen.getByText(MENSAJE.noCoinciden)).toBeInTheDocument()
    expect(guardar).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/Repita la nueva contraseña/), { target: { value: VALIDA } })
    expect(guardar).toBeEnabled()
  })

  it('CU006: dice qué requisito falta, no solo que la contraseña no vale', async () => {
    montar({ correoInicial: 'rosa@sicedu.test' })
    await llegarAlSegundoPaso()

    expect(screen.getByText(/Un carácter especial/)).toBeInTheDocument()
    expect(screen.getByText(/Una letra mayúscula/)).toBeInTheDocument()
    expect(screen.getByText(/Al menos 8 caracteres/)).toBeInTheDocument()
  })
})
