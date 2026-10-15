// Regresión: sin conexión, el Docente abría Rúbrica y el desplegable de Colegio
// salía VACÍO, aunque "Iniciar actividad" ya hubiera descargado sus colegios.
//
// La causa: T19 escribía la precarga en IndexedDB y NADIE la leía. Si la
// pantalla se abría ya sin red, su consulta de asignaciones nunca había llegado
// a ejecutarse, fallaba, y no había de dónde sacar los colegios.
import { beforeEach, describe, expect, it, vi } from 'vitest'
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

// Sin red: la consulta de asignaciones no responde.
vi.mock('../../api/resources/docentes', async (importOriginal) => ({
  ...(await importOriginal()),
  obtenerAsignaciones: vi.fn(() => Promise.reject(new Error('Network Error'))),
}))

vi.mock('idb-keyval', () => {
  let almacen = {}
  return {
    get: vi.fn(async (k) => almacen[k]),
    set: vi.fn(async (k, v) => {
      almacen[k] = v
    }),
    del: vi.fn(async (k) => {
      delete almacen[k]
    }),
    __sembrar: (k, v) => {
      almacen[k] = v
    },
    __limpiar: () => {
      almacen = {}
    },
  }
})

async function abrirFiltros() {
  fireEvent.click(await screen.findByRole('button', { name: /^filtros$/i }, ESPERA))
}

function montar() {
  useSessionStore.setState({
    token: 'mock.1.2026',
    usuario: { id_usuario: 1, id_rol: ROLES.DOCENTE, id_docente: 1, nombres: 'Docente' },
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

beforeEach(async () => {
  const idb = await import('idb-keyval')
  idb.__limpiar()
})

describe('Rúbrica sin conexión (T19)', () => {
  it('saca los colegios de la precarga cuando la red no responde', async () => {
    const idb = await import('idb-keyval')
    idb.__sembrar('sicedu.precarga', {
      datos: {
        asignaciones: [
          { id_colegio: 1, colegio: 'I.E. 86021 Ranrahirca', grados: [1, 2] },
          { id_colegio: 2, colegio: 'I.E. 86024 Mancos', grados: [3] },
        ],
      },
      guardadoEn: new Date().toISOString(),
      // La precarga es del usuario que la descargó (D03): la de otro no se lee.
      propietario: 1,
    })

    montar()
    await abrirFiltros()

    const colegio = await screen.findByLabelText('Colegio', {}, ESPERA)
    await waitFor(() => expect(within(colegio).getAllByRole('option')).toHaveLength(2), ESPERA)
    expect(within(colegio).getByText('I.E. 86021 Ranrahirca')).toBeInTheDocument()
  })

  it('sin precarga no inventa colegios: el desplegable queda vacío', async () => {
    // Quien nunca pulsó "Iniciar actividad" no tiene nada descargado, y es
    // preferible un desplegable vacío a enseñarle colegios que no son suyos.
    montar()
    await abrirFiltros()

    const colegio = await screen.findByLabelText('Colegio', {}, ESPERA)
    await waitFor(() => expect(within(colegio).queryAllByRole('option')).toHaveLength(0), ESPERA)
  })
})
