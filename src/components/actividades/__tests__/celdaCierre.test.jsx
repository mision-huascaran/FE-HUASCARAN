// El tipo de cierre, en una palabra y con su motivo a un toque.
//
// Lo que se sujeta es que ACORTAR NO SEA PERDER: la columna se lee de un
// vistazo, pero el motivo completo sigue alcanzable sin cursor, que es lo que
// no puede romperse al "limpiar" la tabla otra vez.
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import CeldaCierre from '../CeldaCierre'
import { SIN_FIN } from '../../../api/resources/actividades'

describe('CeldaCierre', () => {
  it('muestra una palabra y guarda el motivo completo detrás', async () => {
    render(<CeldaCierre tipo="manual" />)

    expect(screen.getByText('Manual')).toBeInTheDocument()
    // El texto largo NO está en la celda: es lo que hacía la columna ilegible.
    expect(screen.queryByText(/por finalización de actividad/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Manual' }))
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Manual por finalización de actividad')
  })

  it('entiende también el texto completo, que es lo que manda hoy el backend', () => {
    render(<CeldaCierre tipo="Automático por expiración de sesión" />)

    expect(screen.getByText('Automático')).toBeInTheDocument()
  })

  it('distingue los tres cierres por su primera palabra', () => {
    const { rerender } = render(<CeldaCierre tipo="forzado_cierre_sesion" />)
    expect(screen.getByText('Forzado')).toBeInTheDocument()

    rerender(<CeldaCierre tipo="expiracion_sesion" />)
    expect(screen.getByText('Automático')).toBeInTheDocument()
  })

  it('una actividad en curso no tiene cierre: un guion, y nada que pulsar', () => {
    render(<CeldaCierre tipo={null} />)

    expect(screen.getByText(SIN_FIN)).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
