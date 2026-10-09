// D14 — Registro de Vuelo sin actividad iniciada (CP-INI-04).
//
// Igual que Rúbrica y Seguimiento de Lectura: el Docente consulta, pero no
// registra hasta pulsar "Iniciar actividad", y la pantalla se lo dice.
import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { crearQueryClient } from '../../../App'
import { ToastProvider } from '../../../components/ui'
import RegistroVueloPage from '../RegistroVueloPage'
import NuevaEvaluacionPage from '../NuevaEvaluacionPage'
import useActividadStore from '../../../store/actividadStore'
import useSessionStore from '../../../store/sessionStore'
import { ROLES } from '../../../auth/roles'

function montar(pagina) {
  return render(
    <QueryClientProvider client={crearQueryClient()}>
      <ToastProvider>
        <MemoryRouter>{pagina}</MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  useActividadStore.getState().limpiar()
  useSessionStore.setState({
    token: 'mock.1.2026',
    usuario: { id_usuario: 1, id_rol: ROLES.DOCENTE, id_docente: 1, nombres: 'Prueba' },
    cargando: false,
  })
})

describe('Registro de Vuelo sin actividad (D14)', () => {
  it('avisa y no deja registrar', () => {
    montar(<RegistroVueloPage />)
    expect(screen.getByRole('note')).toHaveTextContent('Pulse Iniciar actividad en la barra superior para registrar.')
    expect(screen.getByRole('button', { name: /registrar evaluación/i })).toBeDisabled()
  })

  it('con actividad iniciada, sí deja registrar', () => {
    useActividadStore.getState().iniciar({ idDocente: 1 })
    montar(<RegistroVueloPage />)
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /registrar evaluación/i })).toBeEnabled()
  })

  it('entrando por URL a /registro-vuelo/nuevo también avisa', () => {
    montar(<NuevaEvaluacionPage />)
    expect(screen.getByRole('note')).toHaveTextContent('Iniciar actividad')
  })
})
