// CU001 — Recuperación del Supervisor original con una Recovery Key.
//
// Es la salida de emergencia del sistema: la única forma de volver a entrar si
// esa cuenta pierde el acceso y además falla el correo. Por eso se comprueba
// que esté escondida (no en el login), que avise de que la llave se gasta, y
// que aplique la misma política de contraseña que el resto.
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { crearQueryClient } from '../../../App'
import { ToastProvider } from '../../../components/ui'
import ModalRecuperarPassword from '../ModalRecuperarPassword'

const ESPERA = { timeout: 8000 }
const VALIDA = 'Sicedu2026!'

function montar() {
  return render(
    <QueryClientProvider client={crearQueryClient()}>
      <ToastProvider>
        <ModalRecuperarPassword abierto onCerrar={() => {}} correoInicial="jefatura@sicedu.test" />
      </ToastProvider>
    </QueryClientProvider>,
  )
}

const abrir = () => fireEvent.click(screen.getByRole('button', { name: /supervisor original/i }))

describe('Recovery Keys (CU001)', () => {
  it('se llega por un enlace discreto, no por un botón del login', () => {
    montar()
    const enlace = screen.getByRole('button', { name: /supervisor original/i })
    // Texto pequeño y apagado: quien no sepa qué es, no debe tropezarse.
    expect(enlace.className).toMatch(/text-xs/)
    expect(screen.queryByText(/llave de emergencia/i)).not.toBeInTheDocument()
  })

  it('avisa de que la llave se gasta para siempre', () => {
    montar()
    abrir()
    expect(screen.getByText(/una sola vez/i)).toBeInTheDocument()
    expect(screen.getByText(/no se generan de nuevo/i)).toBeInTheDocument()
  })

  it('exige la misma política de contraseña que el resto (CU006)', () => {
    montar()
    abrir()

    const recuperar = screen.getByRole('button', { name: /recuperar acceso/i })
    expect(recuperar).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/Llave de recuperación/), { target: { value: 'ABCD-1234-EFGH' } })
    // Sin carácter especial no vale, igual que en el flujo con PIN.
    fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: 'Sicedu2026' } })
    fireEvent.change(screen.getByLabelText(/Repita la nueva contraseña/), { target: { value: 'Sicedu2026' } })
    expect(recuperar).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: VALIDA } })
    fireEvent.change(screen.getByLabelText(/Repita la nueva contraseña/), { target: { value: VALIDA } })
    expect(recuperar).toBeEnabled()
  })

  it('no se puede enviar sin llave, aunque la contraseña sea válida', async () => {
    montar()
    abrir()

    fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: VALIDA } })
    fireEvent.change(screen.getByLabelText(/Repita la nueva contraseña/), { target: { value: VALIDA } })
    expect(await screen.findByRole('button', { name: /recuperar acceso/i }, ESPERA)).toBeDisabled()
  })
})
