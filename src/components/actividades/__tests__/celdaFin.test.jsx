// La hora de finalización, con sus tres casos.
//
// El que motivó el componente: una actividad que cruzó la medianoche escribía
// "31/10/2026 00:51" de corrido y obligaba a la columna entera a ser el doble
// de ancha por una fila de veinte.
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import CeldaFin from '../CeldaFin'

const sesion = (inicio, fin) => ({ inicio, fin })

describe('CeldaFin', () => {
  it('la jornada abierta lo dice, no pone un guion', () => {
    render(<CeldaFin sesion={sesion('2026-10-30T16:53:00-05:00', null)} />)

    expect(screen.getByText('En curso')).toBeInTheDocument()
  })

  it('si terminó el mismo día, solo la hora: la fecha ya está en su columna', () => {
    render(<CeldaFin sesion={sesion('2026-11-03T22:55:00-05:00', '2026-11-03T22:56:00-05:00')} />)

    expect(screen.getByText('22:56')).toBeInTheDocument()
    expect(screen.queryByText(/2026/)).not.toBeInTheDocument()
  })

  it('si terminó otro día, la fecha va DEBAJO y no de corrido', () => {
    render(<CeldaFin sesion={sesion('2026-10-30T16:53:00-05:00', '2026-10-31T00:51:00-05:00')} />)

    // Los dos datos están, pero en elementos distintos: sin la fecha,
    // "16:53 → 00:51" parecería un error de datos.
    expect(screen.getByText('00:51')).toBeInTheDocument()
    expect(screen.getByText('31/10/2026')).toBeInTheDocument()
    // Lo que no puede volver es el texto de corrido, que era lo que ensanchaba
    // la columna para todas las filas.
    expect(screen.queryByText('31/10/2026 00:51')).not.toBeInTheDocument()
  })
})
