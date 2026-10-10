// Cambio de contraseña con sesión iniciada (CU004, CU006): pedir código,
// verificarlo y guardar la nueva contraseña, con sus errores y sin conexión.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import handlers from '../../../api/mock/handlers'
import ModalCambiarPassword from '../ModalCambiarPassword'
import { ROLES } from '../../../auth/roles'
import { definirConexion, errorHttp } from '../../../test/fabricas'
import { renderConProveedores } from '../../../test/renderConProveedores'

// Cumple los cinco requisitos de CU006.
const VALIDA = 'Sicedu2026!'

let onCerrar

function montar() {
  onCerrar = vi.fn()
  return renderConProveedores(<ModalCambiarPassword abierto onCerrar={onCerrar} />, { rol: ROLES.DOCENTE })
}

const boton = (nombre) => screen.getByRole('button', { name: nombre })

async function llegarAlPaso(paso, codigo = '123456') {
  await userEvent.click(boton(/enviarme el código/i))
  const campo = await screen.findByLabelText(/Código recibido/)
  if (paso === 1) return campo
  await userEvent.type(campo, codigo)
  await userEvent.click(boton('Verificar'))
  return screen.findByLabelText(/^Nueva contraseña/)
}

beforeEach(() => {
  // El mock exige un correo que la API real no pide (identifica por el token);
  // ver authRecursos.test.js. Aquí se prueba la pantalla, no ese desfase.
  vi.spyOn(handlers.auth, 'passwordCodigo').mockResolvedValue({ detail: 'Código enviado a tu correo' })
})

afterEach(() => {
  vi.restoreAllMocks()
  definirConexion(true)
})

describe('Cambiar contraseña: paso 1, pedir el código', () => {
  it('al enviar el código avisa por toast y pasa a pedirlo', async () => {
    montar()
    await llegarAlPaso(1)
    expect(await screen.findByText('PIN enviado')).toBeInTheDocument()
  })

  it('si el envío falla lo dice y se queda en el primer paso', async () => {
    handlers.auth.passwordCodigo.mockRejectedValue(errorHttp(503, { detail: 'No pudimos enviar el código, intenta de nuevo' }))
    montar()
    await userEvent.click(boton(/enviarme el código/i))

    expect(await screen.findByText('No pudimos enviar el código, intenta de nuevo')).toBeInTheDocument()
    expect(screen.queryByLabelText(/Código recibido/)).not.toBeInTheDocument()
  })
})

describe('Cambiar contraseña: paso 2, verificar el código', () => {
  it('no deja verificar hasta tener 6 caracteres', async () => {
    montar()
    const campo = await llegarAlPaso(1)
    await userEvent.type(campo, '12345')
    expect(boton('Verificar')).toBeDisabled()
    await userEvent.type(campo, '6')
    expect(boton('Verificar')).toBeEnabled()
  })

  it('un código rechazado por el servidor se avisa y no avanza', async () => {
    vi.spyOn(handlers.auth, 'verificarCodigo').mockRejectedValue(errorHttp(400, { detail: 'Código incorrecto o expirado' }))
    montar()
    await userEvent.type(await llegarAlPaso(1), '999999')
    await userEvent.click(boton('Verificar'))

    expect(await screen.findByText('Código incorrecto o expirado')).toBeInTheDocument()
    expect(screen.queryByLabelText(/^Nueva contraseña/)).not.toBeInTheDocument()
  })
})

describe('Cambiar contraseña: paso 3, nueva contraseña', () => {
  it('marca qué requisitos faltan y exige que las dos coincidan', async () => {
    montar()
    await userEvent.type(await llegarAlPaso(2), 'abc')

    expect(screen.getByText(/Una letra mayúscula/)).toHaveTextContent('○')
    expect(screen.getByText(/Una letra minúscula/)).toHaveTextContent('✓')
    expect(boton('Guardar contraseña')).toBeDisabled()

    await userEvent.clear(screen.getByLabelText(/^Nueva contraseña/))
    await userEvent.type(screen.getByLabelText(/^Nueva contraseña/), VALIDA)
    await userEvent.type(screen.getByLabelText(/Repita/), `${VALIDA}x`)
    expect(screen.getByText('Las contraseñas no coinciden')).toBeInTheDocument()
    expect(boton('Guardar contraseña')).toBeDisabled()
  })

  it('con todo válido guarda, reenvía el mismo código y cierra el modal', async () => {
    const cambiar = vi.spyOn(handlers.auth, 'cambiarPassword')
    montar()
    await userEvent.type(await llegarAlPaso(2, '123456'), VALIDA)
    await userEvent.type(screen.getByLabelText(/Repita/), VALIDA)
    await userEvent.click(boton('Guardar contraseña'))

    expect(await screen.findByText('Contraseña actualizada')).toBeInTheDocument()
    expect(cambiar).toHaveBeenCalledWith({
      codigo: '123456',
      'contraseña_nueva': VALIDA,
      'confirmar_contraseña_nueva': VALIDA,
    })
    expect(onCerrar).toHaveBeenCalled()
  })

  it('si el servidor rechaza el cambio lo dice y no cierra', async () => {
    vi.spyOn(handlers.auth, 'cambiarPassword').mockRejectedValue(
      errorHttp(400, { detail: 'La nueva contraseña debe ser diferente de la contraseña anterior.' }),
    )
    montar()
    await userEvent.type(await llegarAlPaso(2), VALIDA)
    await userEvent.type(screen.getByLabelText(/Repita/), VALIDA)
    await userEvent.click(boton('Guardar contraseña'))

    expect(await screen.findByText('La nueva contraseña debe ser diferente de la contraseña anterior.')).toBeInTheDocument()
    expect(onCerrar).not.toHaveBeenCalled()
  })

  /**
   * BUG (documentado en REPORTE_CALIDAD.md): `/me/password/*` trabaja con un
   * código ALFANUMÉRICO (APIS_BACKEND.md: "AB12CD") y el paso 2 lo acepta y lo
   * pasa a mayúsculas, pero el paso 3 exige `esPinValido` (6 DÍGITOS). Con un
   * código válido del backend, "Guardar contraseña" queda deshabilitado para
   * siempre y sin ningún mensaje que explique por qué.
   */
  it.fails('un código alfanumérico aceptado en la verificación permite guardar', async () => {
    montar()
    await userEvent.type(await llegarAlPaso(2, 'ab12cd'), VALIDA)
    await userEvent.type(screen.getByLabelText(/Repita/), VALIDA)
    expect(boton('Guardar contraseña')).toBeEnabled()
  })
})

describe('Cambiar contraseña: cancelar y sin conexión', () => {
  it('cancelar cierra y vuelve a empezar desde el primer paso', async () => {
    montar()
    await llegarAlPaso(1)
    await userEvent.click(boton('Cancelar'))
    expect(onCerrar).toHaveBeenCalled()

    // El padre decide si lo desmonta; si lo vuelve a abrir, empieza de cero.
    await waitFor(() => expect(boton(/enviarme el código/i)).toBeInTheDocument())
    expect(screen.queryByLabelText(/Código recibido/)).not.toBeInTheDocument()
  })

  it('sin conexión lo explica y no deja guardar aunque todo sea válido (CU004)', async () => {
    montar()
    await userEvent.type(await llegarAlPaso(2), VALIDA)
    await userEvent.type(screen.getByLabelText(/Repita/), VALIDA)

    definirConexion(false)
    window.dispatchEvent(new Event('offline'))

    expect(await screen.findByRole('alert')).toHaveTextContent('sin conexión a Internet')
    expect(boton('Guardar contraseña')).toBeDisabled()
  })
})
