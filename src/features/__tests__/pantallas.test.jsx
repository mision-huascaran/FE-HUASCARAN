// Humo de las pantallas de las Fases 4 y 5: se montan contra los handlers
// REALES del mock, no contra dobles. Compilar no prueba que una pantalla pinte;
// esto sí, y es lo que se rompe cuando cambia la forma de un handler.
import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { crearQueryClient } from '../../App'
import { ToastProvider } from '../../components/ui'
import RegistroVueloPage from '../registroVuelo/RegistroVueloPage'
import NuevaEvaluacionPage from '../registroVuelo/NuevaEvaluacionPage'
import NivelFinalPage from '../nivelFinal/NivelFinalPage'
import useSessionStore from '../../store/sessionStore'
import useFiltrosStore from '../../store/filtrosStore'
import { ROLES } from '../../auth/roles'
import * as db from '../../api/mock/db'

const ALUMNO = db.ALUMNOS[0]

function montar(elemento, { ruta = '/', patron = '/' } = {}) {
  useSessionStore.setState({
    token: 'mock.1.2026',
    usuario: { id_usuario: 1, id_rol: ROLES.PROFESOR, id_docente: 1, nombres: 'Docente de prueba' },
    cargando: false,
  })
  useFiltrosStore.setState({ idPeriodo: db.PERIODO_VIGENTE.id_periodo })

  return render(
    <QueryClientProvider client={crearQueryClient()}>
      <ToastProvider>
        <MemoryRouter initialEntries={[ruta]}>
          <Routes>
            <Route path={patron} element={elemento} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

describe('Registro de vuelo — histórico (P6)', () => {
  it('pide elegir un colegio antes de cargar 413 estudiantes', async () => {
    montar(<RegistroVueloPage />, { ruta: '/registro-vuelo', patron: '/registro-vuelo' })
    expect(await screen.findByText(/Elija un colegio para ver el histórico/i)).toBeInTheDocument()
  })

  it('con un colegio en la URL pinta la tabla con los cuatro cortes', async () => {
    montar(<RegistroVueloPage />, {
      ruta: `/registro-vuelo?colegio=${ALUMNO.id_colegio}&grado=${ALUMNO.id_grado}`,
      patron: '/registro-vuelo',
    })

    const tabla = await screen.findByRole('table', {}, { timeout: 4000 })
    const cabecera = within(tabla).getAllByRole('columnheader').map((c) => c.textContent)
    db.PERIODOS.forEach((p) => {
      expect(cabecera.some((texto) => texto.includes(p.nombre))).toBe(true)
    })
    expect(cabecera.some((t) => t.includes('Tendencia'))).toBe(true)
    expect(cabecera.some((t) => t.includes('Sugerencia'))).toBe(true)
  })
})

describe('Nueva evaluación diagnóstica (P7)', () => {
  it('arranca en el paso 1 con el panel de resultados a la vista', async () => {
    montar(<NuevaEvaluacionPage />, { ruta: '/registro-vuelo/nuevo', patron: '/registro-vuelo/nuevo' })
    expect(await screen.findByText('Datos del estudiante')).toBeInTheDocument()
    expect(screen.getByText('Resultados de la evaluación')).toBeInTheDocument()
    // El aviso de cálculo automático está presente desde el primer paso.
    expect(screen.getAllByText(/CALCULADO AUTOMÁTICAMENTE/i).length).toBeGreaterThan(0)
  })
})

describe('Nivel final mensual (P9)', () => {
  it('exige un colegio antes de mostrar el consolidado', async () => {
    montar(<NivelFinalPage />, { ruta: '/nivel-final', patron: '/nivel-final' })
    expect(await screen.findByText('Elija un colegio')).toBeInTheDocument()
  })
})
