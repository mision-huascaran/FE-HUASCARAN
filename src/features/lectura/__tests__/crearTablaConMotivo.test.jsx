// El estado vacío de Seguimiento de Lectura tiene que DECIR por qué no se
// puede crear la tabla.
//
// El Docente lo reportó como "no funciona": la pantalla decía "Esta semana aún
// no tiene tabla de lectura. Se creará sobre la clase del 2 de noviembre" y ahí
// se acababa. Sin botón y sin motivo no hay nada que pulsar ni nada que leer,
// y el módulo parece averiado aunque esté haciendo lo correcto.
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { crearQueryClient } from '../../../App'
import { ToastProvider } from '../../../components/ui'
import LecturaPage from '../LecturaPage'
import useSessionStore from '../../../store/sessionStore'
import useActividadStore from '../../../store/actividadStore'
import { ROLES } from '../../../auth/roles'
import { obtenerTabla } from '../../../api/resources/lectura'

vi.mock('../../../api/resources/lectura', async () => {
  const real = await vi.importActual('../../../api/resources/lectura')
  return { ...real, obtenerTabla: vi.fn(), crearTabla: vi.fn() }
})

const ESPERA = { timeout: 8000 }
const ESCRITURA = { permitida: true, motivo: null, id_permiso: null, aviso_permiso: null }

/** El 404 de "no existe todavía", con la clase que el servidor sugiere. */
function errorPorCrear(fecha) {
  const error = new Error('no existe')
  error.response = {
    status: 404,
    data: {
      detail: 'No existe una tabla de lectura semanal para los filtros seleccionados.',
      motivo: 'tabla_no_existe',
      clase_referencia_sugerida: { id_clase: 41, fecha, tipo: 'habitual', reprogramada: false },
      escritura: ESCRITURA,
    },
  }
  return error
}

function montar({ conActividad }) {
  useSessionStore.setState({
    token: 'mock.1.2026',
    usuario: { id_usuario: 1, id_rol: ROLES.DOCENTE, id_docente: 1, nombre_completo: 'Rosa Cárdenas' },
    cargando: false,
  })
  useActividadStore.setState({ sesion: conActividad ? { id: 'act-1', inicio: new Date().toISOString() } : null })

  return render(
    <QueryClientProvider client={crearQueryClient()}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/seguimiento-lectura?colegio=1&grado=1&seccion=101&subprograma=1&semana=30']}>
          <LecturaPage />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

const botonCrear = () => screen.findByRole('button', { name: /crear la tabla de esta semana/i }, ESPERA)

describe('cuando la tabla todavía no existe', () => {
  it('sin actividad abierta, el botón SE VE pero deshabilitado y con su motivo', async () => {
    obtenerTabla.mockRejectedValue(errorPorCrear('2026-06-15'))

    montar({ conActividad: false })

    const boton = await botonCrear()
    expect(boton).toBeDisabled()
    /**
     * El mismo texto que responde el servidor, para no inventar vocabulario.
     * Sale dos veces a propósito: en el aviso de arriba y junto al botón, que
     * es donde se mira cuando uno se pregunta por qué no puede pulsarlo.
     */
    expect(
      screen.getAllByText('Debes iniciar una actividad de trabajo para registrar o modificar información.').length,
    ).toBeGreaterThan(0)
  })

  it('con actividad abierta y la clase ya dictada, se puede crear', async () => {
    obtenerTabla.mockRejectedValue(errorPorCrear('2026-06-15'))

    montar({ conActividad: true })

    expect(await botonCrear()).toBeEnabled()
  })

  it('si la clase de referencia todavía no se ha dictado, lo dice y no deja crear', async () => {
    /**
     * Era lo que veía el Docente: la pantalla ofrecía crear la tabla sobre la
     * clase del viernes estando a jueves, y el servidor respondía "La clase de
     * referencia todavía no se ha realizado". CU024 exige que la fecha
     * efectiva sea lectiva y NO futura, y la fecha ya viene en el 404.
     */
    const manana = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
    obtenerTabla.mockRejectedValue(errorPorCrear(manana))

    montar({ conActividad: true })

    expect(await botonCrear()).toBeDisabled()
    // En el título del estado vacío y junto al botón.
    expect((await screen.findAllByText(/todavía no se ha dictado/i, {}, ESPERA)).length).toBeGreaterThan(0)
  })
})
