// D48 — Ninguna pantalla cae en "No se pudo mostrar esta pantalla".
//
// El probador vio ese cartel en Registro de Vuelo y, como Supervisora, en
// Rúbrica y Seguimiento de Lectura. Es el error boundary: significa que el
// render lanzó una excepción, no que el servidor respondiera mal.
//
// La causa típica es un `.map()` o un `.length` sobre algo que llegó `null`.
// El contrato dice que esas listas son arreglos, pero cuando no llega lo
// esperado la pantalla tiene que enseñar SU estado vacío —el del caso de uso—
// y no un cartel genérico que no dice nada.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { crearQueryClient } from '../../App'
import { ToastProvider } from '../../components/ui'
import LimiteDeError from '../../components/layout/LimiteDeError'
import RubricaPage from '../rubrica/RubricaPage'
import RegistroVueloAnualPage from '../registroVuelo/RegistroVueloAnualPage'
import useSessionStore from '../../store/sessionStore'
import useActividadStore from '../../store/actividadStore'
import { ROLES } from '../../auth/roles'

const ESPERA = { timeout: 8000 }

const listarRubricas = vi.fn()
const listarRegistroVuelo = vi.fn()

vi.mock('../../api/resources/rubricaMensual', async (importOriginal) => ({
  ...(await importOriginal()),
  listarRubricas: (...a) => listarRubricas(...a),
  obtenerCriterios: vi.fn(async () => []),
}))

vi.mock('../../api/resources/registroVueloAnual', async (importOriginal) => ({
  ...(await importOriginal()),
  listarRegistroVuelo: (...a) => listarRegistroVuelo(...a),
}))

// Los filtros salen de las asignaciones y del detalle del colegio: se fijan
// para que la prueba hable del render y no de los desplegables.
vi.mock('../../api/resources/administracion', async (importOriginal) => ({
  ...(await importOriginal()),
  listarMisAsignaciones: vi.fn(async () => []),
  listarColegiosAdmin: vi.fn(async () => ({
    items: [{ id_colegio: 1, nombre: 'I.E. 1234' }],
    total: 1,
  })),
  obtenerColegio: vi.fn(async () => ({
    id_colegio: 1,
    nombre: 'I.E. 1234',
    grados: [{ id_grado: 2, nombre: '2.° grado', secciones: [{ id: 2, nombre: 'Única' }] }],
    programas: [{ id_programa: 2, nombre: 'Comprensión Lectora' }],
  })),
  listarAniosEscolares: vi.fn(async () => [{ id: 2, nombre: '2026', vigente: true }]),
  anioVigente: (anios = []) => anios.find((a) => a.vigente) ?? anios[0] ?? null,
}))

/** Se monta DENTRO del error boundary: si revienta, sale su cartel. */
function montar(Pantalla, idRol = ROLES.JEFA) {
  useSessionStore.setState({
    token: 'mock.4.2026',
    usuario: { id_usuario: 4, id_rol: idRol, id_docente: null, nombres: 'Sara' },
    cargando: false,
  })
  return render(
    <QueryClientProvider client={crearQueryClient()}>
      <ToastProvider>
        <MemoryRouter>
          <LimiteDeError>
            <Pantalla />
          </LimiteDeError>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

const noHayCartelGenerico = () =>
  expect(screen.queryByText('No se pudo mostrar esta pantalla')).not.toBeInTheDocument()

beforeEach(() => {
  localStorage.clear()
  listarRubricas.mockReset()
  listarRegistroVuelo.mockReset()
  useActividadStore.getState().limpiar()
  // El error boundary escribe en consola al capturar: se calla para que un
  // fallo de verdad no quede enterrado entre su ruido.
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => vi.restoreAllMocks())

describe('La Supervisora entra a Rúbrica (D48, D49)', () => {
  it('con `items` en null no revienta: enseña su estado vacío', async () => {
    listarRubricas.mockResolvedValue({
      items: null,
      total: 0,
      page: 1,
      page_size: 40,
      total_pages: 1,
      ciclo: 'III',
      escritura: { permitida: false, motivo: 'El Supervisor consulta las rúbricas en solo lectura.' },
      detail: 'No hay alumnos que corresponda evaluar en este grupo y mes.',
    })

    montar(RubricaPage)

    await screen.findByText(/sin alumnos que evaluar/i, {}, ESPERA)
    noHayCartelGenerico()
  })

  it('con un error del servidor muestra SU mensaje, no el genérico', async () => {
    const error = new Error('fallo')
    error.response = { status: 500, data: { detail: 'Los indicadores no están disponibles.' } }
    listarRubricas.mockRejectedValue(error)

    montar(RubricaPage)

    await screen.findByText(/no se pudo cargar la rúbrica/i, {}, ESPERA)
    noHayCartelGenerico()
  })
})

describe('La Supervisora entra a Registro de Vuelo (D48, D49)', () => {
  it('con `items` y `periodos` en null no revienta', async () => {
    /**
     * `periodos` es el que más duele: de él sale la fila de pestañas de PA, y
     * se recorre antes que nada. Si llega `null`, la pantalla entera cae.
     */
    listarRegistroVuelo.mockResolvedValue({
      items: null,
      periodos: null,
      total: 0,
      page: 1,
      page_size: 40,
      total_pages: 1,
      aviso: 'No hay alumnos que correspondan a este grupo en el año seleccionado.',
    })

    montar(RegistroVueloAnualPage)

    await screen.findByText(/sin alumnos en este grupo/i, {}, ESPERA)
    noHayCartelGenerico()
  })

  it('con un error del servidor muestra SU mensaje', async () => {
    // Un 403 y no un 5xx: es la respuesta realista cuando se consulta un aula
    // fuera de alcance, y además no se reintenta, así que el error se ve al
    // momento en lugar de catorce segundos después.
    const error = new Error('fallo')
    error.response = { status: 403, data: { detail: 'No tienes acceso a este grupo.', motivo: 'aula_fuera_de_alcance' } }
    listarRegistroVuelo.mockRejectedValue(error)

    montar(RegistroVueloAnualPage)

    await screen.findByText(/no se pudo cargar el registro de vuelo/i, {}, ESPERA)
    noHayCartelGenerico()
  })
})
