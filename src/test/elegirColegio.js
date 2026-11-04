// El Supervisor ya no recibe un colegio elegido por defecto: la pantalla le
// pide «Selecciona un colegio» (auditoría de UX #737, U08). Las pruebas que
// lo hacen entrar eligen el primero, como haría él.
import { expect } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

export async function elegirPrimerColegio(espera = { timeout: 8000 }) {
  // En jsdom no hay ancho de pantalla: los filtros viven en un cajón cerrado.
  if (!screen.queryByLabelText('Colegio')) {
    fireEvent.click(await screen.findByRole('button', { name: /^filtros/i }, espera))
  }
  const colegio = await screen.findByLabelText('Colegio', {}, espera)
  await waitFor(() => expect(colegio.options.length).toBeGreaterThan(1), espera)
  const primero = [...colegio.options].find((o) => o.value !== '')
  fireEvent.change(colegio, { target: { value: primero.value } })
  return colegio
}
