// Humo del catálogo del sistema de diseño (/_ui). No cubre reglas de negocio:
// monta las tres pestañas para comprobar que los componentes base siguen
// pintando después de tocar tokens o props compartidas.
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '../../components/ui'
import UiKitPage from '../uiKit/UiKitPage'

function montar() {
  return render(
    <ToastProvider>
      <MemoryRouter>
        <UiKitPage />
      </MemoryRouter>
    </ToastProvider>,
  )
}

describe('Sistema de diseño (/_ui)', () => {
  it('abre en Componentes con el catálogo de controles y datos', async () => {
    montar()

    expect(screen.getByRole('heading', { name: 'Sistema de diseño' })).toBeInTheDocument()
    expect(screen.getByText('Solo desarrollo')).toBeInTheDocument()
    // Las tres pestañas del catálogo.
    expect(screen.getByRole('tab', { name: 'Componentes' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Paleta' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Tipografía' })).toBeInTheDocument()
    // Y algún control real ya montado.
    expect(screen.getAllByRole('button').length).toBeGreaterThan(5)
  })

  it('cambia a Paleta y a Tipografía sin romperse', async () => {
    const usuario = userEvent.setup()
    montar()

    await usuario.click(screen.getByRole('tab', { name: 'Paleta' }))
    expect(screen.getByRole('tab', { name: 'Paleta' })).toHaveAttribute('aria-selected', 'true')
    // Los grupos de tokens de color del sistema de diseño.
    expect(screen.getByText('estado')).toBeInTheDocument()
    expect(screen.getByText('lvl')).toBeInTheDocument()

    await usuario.click(screen.getByRole('tab', { name: 'Tipografía' }))
    expect(screen.getByRole('tab', { name: 'Tipografía' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Escala tipográfica')).toBeInTheDocument()
  })
})
