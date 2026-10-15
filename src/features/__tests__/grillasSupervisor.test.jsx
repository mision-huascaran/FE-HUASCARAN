// Regresión: el Supervisor abría Rúbrica y el desplegable de Colegio salía
// VACÍO, así que no podía ver ninguna grilla.
//
// La causa: los colegios se deducían de las asignaciones del usuario, y el
// Supervisor no tiene ninguna (`id_docente` es null). Pero T22 le da las
// grillas de TODOS los docentes, así que los suyos salen del catálogo.
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { crearQueryClient } from '../../App'
import { ToastProvider } from '../../components/ui'
import ReporteSemanalPage from '../reporteSemanal/ReporteSemanalPage'
import useSessionStore from '../../store/sessionStore'
import useFiltrosStore from '../../store/filtrosStore'
import { ROLES } from '../../auth/roles'
import * as db from '../../api/mock/db'

const ESPERA = { timeout: 8000 }

/**
 * En jsdom no hay ancho de pantalla, así que `FilterBar` se comporta como en
 * móvil (RNF-002) y colapsa los filtros en un Drawer. Hay que abrirlo.
 */
async function abrirFiltros() {
  fireEvent.click(await screen.findByRole('button', { name: /^filtros$/i }, ESPERA))
}

function montar(idRol) {
  useSessionStore.setState({
    token: 'mock.4.2026',
    usuario: {
      id_usuario: idRol === ROLES.DOCENTE ? 1 : 4,
      id_rol: idRol,
      // El Supervisor no es docente: no tiene asignaciones de las que deducir nada.
      id_docente: idRol === ROLES.DOCENTE ? 1 : null,
      nombres: 'Prueba',
    },
    cargando: false,
  })
  useFiltrosStore.setState({ idPeriodo: db.PERIODO_VIGENTE.id_periodo })

  return render(
    <QueryClientProvider client={crearQueryClient()}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/rubrica']}>
          <Routes>
            <Route path="/rubrica" element={<ReporteSemanalPage pestanaFija="rubrica" />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

describe('Grillas del aula vistas por el Supervisor (T22)', () => {
  it('puede elegir colegio aunque no tenga asignaciones propias', async () => {
    montar(ROLES.SUPERVISOR)
    await abrirFiltros()

    const colegio = await screen.findByLabelText('Colegio', {}, ESPERA)

    // Si el desplegable sale vacío, no hay forma de abrir ninguna grilla.
    await waitFor(
      () => expect(within(colegio).getAllByRole('option').length).toBe(db.COLEGIOS.length),
      ESPERA,
    )
  })

  it('tiene el filtro por docente, que el Docente no necesita', async () => {
    montar(ROLES.SUPERVISOR)
    await abrirFiltros()
    expect(await screen.findByLabelText('Docente', {}, ESPERA)).toBeInTheDocument()
  })

  it('el Docente solo ve los colegios de sus asignaciones', async () => {
    montar(ROLES.DOCENTE)
    await abrirFiltros()

    const colegio = await screen.findByLabelText('Colegio', {}, ESPERA)
    await waitFor(() => expect(within(colegio).getAllByRole('option').length).toBeGreaterThan(0), ESPERA)
    expect(within(colegio).getAllByRole('option').length).toBeLessThan(db.COLEGIOS.length)
    // Y no elige de quién son las grillas: solo trabaja las suyas.
    expect(screen.queryByLabelText('Docente')).not.toBeInTheDocument()
  })
})
