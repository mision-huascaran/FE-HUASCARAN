// Auditoría de UX #737, U24: el aviso de "Debes iniciar una actividad" trae
// su propio botón, y los demás motivos no llevan el ícono de "play".
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import AvisoActividades from '../AvisoActividades'
import { SIN_ACTIVIDAD } from '../../../api/resources/sincronizacion'

const iniciar = vi.fn()
const estado = { sinAsignaciones: false, textoNoPuedeIniciar: null }
vi.mock('../../../features/inicio/useActividad', () => ({
  default: () => ({ iniciar, ...estado }),
}))

beforeEach(() => {
  iniciar.mockReset().mockResolvedValue(undefined)
  estado.sinAsignaciones = false
  estado.textoNoPuedeIniciar = null
})

describe('AvisoActividades', () => {
  it('sin actividad ofrece iniciarla desde el propio aviso', async () => {
    render(<AvisoActividades />)
    expect(screen.getByText(SIN_ACTIVIDAD)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar actividad' }))
    await waitFor(() => expect(iniciar).toHaveBeenCalledTimes(1))
  })

  it('sin asignaciones el botón se ve deshabilitado, con el motivo del servidor', () => {
    estado.sinAsignaciones = true
    estado.textoNoPuedeIniciar = 'No tienes asignaciones vigentes.'
    render(<AvisoActividades />)
    const boton = screen.getByRole('button', { name: 'Iniciar actividad' })
    expect(boton).toBeDisabled()
    expect(boton).toHaveAttribute('title', 'No tienes asignaciones vigentes.')
  })

  it('otro motivo se dice sin botón', () => {
    render(<AvisoActividades mensaje="No es posible adelantar registros." />)
    expect(screen.getByText('No es posible adelantar registros.')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
