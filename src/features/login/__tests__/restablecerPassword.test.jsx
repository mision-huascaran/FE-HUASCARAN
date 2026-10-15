// Recuperar contraseña sin sesión: el canje del PIN (CU006) y cada error con su
// texto literal según el `motivo` del backend. El primer paso (pedir el PIN)
// lo cubre modalRecuperarPassword.test.jsx.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import handlers from '../../../api/mock/handlers'
import ModalRecuperarPassword, { MENSAJE } from '../ModalRecuperarPassword'
import { errorHttp } from '../../../test/fabricas'
import { renderConProveedores } from '../../../test/renderConProveedores'

const VALIDA = 'Sicedu2026!'
const CORREO = 'rcardenas@sicedu.test'

let onCerrar

/**
 * El flujo completo. Son TRES pasos desde CU006: pedir el PIN, VERIFICARLO
 * aparte, y solo entonces la contraseña. El PIN del simulador es `AB12CD`.
 */
async function llenarSegundoPaso({ pin = '123456' } = {}) {
  onCerrar = vi.fn()
  renderConProveedores(<ModalRecuperarPassword abierto onCerrar={onCerrar} correoInicial={CORREO} />)
  await userEvent.click(screen.getByRole('button', { name: /enviarme el pin/i }))
  await userEvent.type(await screen.findByLabelText(/PIN recibido/), pin)
  await userEvent.click(screen.getByRole('button', { name: /verificar y continuar/i }))
  await userEvent.type(await screen.findByLabelText('Nueva contraseña'), VALIDA)
  await userEvent.type(screen.getByLabelText(/Repita la nueva contraseña/), VALIDA)
  await userEvent.click(screen.getByRole('button', { name: /cambiar contraseña/i }))
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Restablecer la contraseña con el PIN (CU006)', () => {
  it('canjea el PIN, pide volver a entrar y cierra', async () => {
    const restablecer = vi.spyOn(handlers.auth, 'restablecerPassword').mockResolvedValue({ detail: 'Contraseña actualizada' })
    await llenarSegundoPaso()

    expect(await screen.findByText('Vuelva a iniciar sesión con la nueva contraseña.')).toBeInTheDocument()
    expect(restablecer).toHaveBeenCalledWith({ correo: CORREO, codigo: '123456' })
    expect(onCerrar).toHaveBeenCalled()
  })

  it.each([
    ['expirado', MENSAJE.pinExpirado],
    ['intentos_agotados', MENSAJE.pinAgotado],
    ['incorrecto', MENSAJE.pinIncorrecto],
    ['password_igual', MENSAJE.igualAnterior],
  ])('motivo "%s" → muestra el texto literal de CU006 y no cierra', async (motivo, texto) => {
    vi.spyOn(handlers.auth, 'restablecerPassword').mockRejectedValue(errorHttp(400, { detail: 'texto del servidor', motivo }))
    await llenarSegundoPaso()

    // `findAllByText` y no `findByText`: con el PIN agotado el texto sale DOS
    // veces a propósito —en el toast y, fijo, junto al campo, que queda
    // bloqueado hasta pedir otro PIN (CU006)—.
    expect((await screen.findAllByText(texto)).length).toBeGreaterThan(0)
    expect(screen.queryByText('texto del servidor')).not.toBeInTheDocument()
    expect(onCerrar).not.toHaveBeenCalled()
  })

  it('sin motivo reconocible muestra el texto del servidor tal cual, sin inventar cuál fue', async () => {
    vi.spyOn(handlers.auth, 'restablecerPassword').mockRejectedValue(errorHttp(400, { detail: 'El código no es válido o ya caducó' }))
    await llenarSegundoPaso()
    expect(await screen.findByText('El código no es válido o ya caducó')).toBeInTheDocument()
  })
})

describe('Pedir el PIN', () => {
  it('si el servidor falla lo dice y no avanza al segundo paso', async () => {
    vi.spyOn(handlers.auth, 'recuperarPassword').mockRejectedValue(errorHttp(503, { detail: 'Servicio de correo no disponible' }))
    renderConProveedores(<ModalRecuperarPassword abierto onCerrar={() => {}} correoInicial={CORREO} />)
    await userEvent.click(screen.getByRole('button', { name: /enviarme el pin/i }))

    expect(await screen.findByText('Servicio de correo no disponible')).toBeInTheDocument()
    expect(screen.queryByLabelText(/PIN recibido/)).not.toBeInTheDocument()
  })

  it('cancelar vuelve a empezar y cierra', async () => {
    onCerrar = vi.fn()
    renderConProveedores(<ModalRecuperarPassword abierto onCerrar={onCerrar} correoInicial={CORREO} />)
    await userEvent.click(screen.getByRole('button', { name: /enviarme el pin/i }))
    await screen.findByLabelText(/PIN recibido/)
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(onCerrar).toHaveBeenCalled()
    expect(screen.queryByLabelText(/PIN recibido/)).not.toBeInTheDocument()
  })
})
