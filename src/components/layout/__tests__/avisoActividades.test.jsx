// El aviso de "Debes iniciar una actividad" NO lleva botón.
//
// Lo llevó: lo añadió U24 (auditoría de UX #737) porque el de "Iniciar
// actividad" había que buscarlo arriba a la derecha. Pero ese botón no se
// esconde nunca —`BarraActividades` lo deja fijo en la barra superior—, así
// que quedaban dos botones idénticos a dos dedos de distancia. Estas pruebas
// sujetan la decisión nueva para que el botón no vuelva por un tercer camino.
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import AvisoActividades from '../AvisoActividades'
import { SIN_ACTIVIDAD } from '../../../api/resources/sincronizacion'

describe('AvisoActividades', () => {
  it('dice qué falta, y no repite el botón que ya está en la barra superior', () => {
    render(<AvisoActividades />)

    expect(screen.getByText(SIN_ACTIVIDAD)).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('otro motivo se dice igual, sin botón', () => {
    render(<AvisoActividades mensaje="No es posible adelantar registros." />)

    expect(screen.getByText('No es posible adelantar registros.')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
