// CU029, CU030 — Rúbrica MENSUAL, contrato de la tanda 8.
//
// Lo que se comprueba es lo que distingue esta rúbrica de la semanal que
// sustituye, y lo que es fácil romper sin verlo:
//
//   · El 0 es un VALOR ("Pre-inicio") y `null` es "sin evaluar". Confundirlos
//     haría que un alumno sin evaluar apareciera como el peor de la clase.
//   · La escala depende del subprograma: 0 solo en Fluidez de Alfabetización.
//   · Una sola dimensión SE GUARDA, y la fila queda "incompleta".
//   · El resultado llega en décimas y se pinta con un decimal.
//   · Un mes futuro no es un error: es otro mes que elegir.
//   · Un choque de versiones se ADOPTA, no se reintenta.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider, onlineManager } from '@tanstack/react-query'
import { crearQueryClient } from '../../../App'
import { ToastProvider } from '../../../components/ui'
import RubricaPage from '../RubricaPage'
import useSessionStore from '../../../store/sessionStore'
import useActividadStore from '../../../store/actividadStore'
import { ROLES } from '../../../auth/roles'
import { _reiniciarCola, reintentarAhora } from '../../../lib/colaOffline'
import useSyncStore from '../../../store/syncStore'
import useRechazosStore from '../../../store/rechazosStore'

const ESPERA = { timeout: 8000 }
const ESCRITURA = { permitida: true, motivo: null, id_permiso: null, aviso_permiso: null }

const item = (extra = {}) => ({
  id_alumno: 5,
  nombre: 'Torres, Ana',
  inactivo: false,
  id_rubrica: null,
  fluidez: null,
  comprension: null,
  estado: 'pendiente',
  resultado_decimas: null,
  version: null,
  ...extra,
})

const pagina = (extra = {}) => ({
  items: [item()],
  total: 1,
  page: 1,
  page_size: 40,
  total_pages: 1,
  ciclo: 'III',
  id_ciclo: 1,
  id_periodo_academico: 2,
  escritura: ESCRITURA,
  detail: null,
  ...extra,
})

const listarRubricas = vi.fn()
const obtenerCriterios = vi.fn(async () => [])
const guardarRubricas = vi.fn()

// "Cargar versión actual" descarta la operación rechazada (P4 §1).
const descartarOperacion = vi.fn(async () => ({ estado: 'descartada' }))
vi.mock('../../../api/resources/sincronizacion', async (importOriginal) => ({
  ...(await importOriginal()),
  descartarOperacion: (...a) => descartarOperacion(...a),
}))

vi.mock('../../../api/resources/rubricaMensual', async (importOriginal) => ({
  ...(await importOriginal()),
  listarRubricas: (...a) => listarRubricas(...a),
  guardarRubricas: (...a) => guardarRubricas(...a),
  obtenerCriterios: (...a) => obtenerCriterios(...a),
}))

// Los filtros se fijan para que el test hable de la rúbrica y no de los
// desplegables. El subprograma es Alfabetización: es el único que admite 0.
vi.mock('../../../api/resources/administracion', async (importOriginal) => ({
  ...(await importOriginal()),
  listarMisAsignaciones: vi.fn(async () => [
    {
      id_colegio: 1,
      colegio: 'I.E. 1234',
      grados: [{ id_grado: 2, nombre: '2.° grado' }],
      detalle_grados: [{ id_grado: 2, subprogramas: ['Alfabetización'] }],
    },
  ]),
  obtenerColegio: vi.fn(async () => ({
    id_colegio: 1,
    nombre: 'I.E. 1234',
    grados: [{ id_grado: 2, nombre: '2.° grado', secciones: [{ id: 2, nombre: 'Única' }] }],
    programas: [{ id_programa: 1, nombre: 'Alfabetización' }],
  })),
  listarAniosEscolares: vi.fn(async () => [{ id: 2, nombre: '2026', vigente: true }]),
  anioVigente: (anios = []) => anios.find((a) => a.vigente) ?? anios[0] ?? null,
}))

function montar(idRol = ROLES.PROFESOR) {
  useSessionStore.setState({
    token: 'mock.4.2026',
    usuario: { id_usuario: 4, id_rol: idRol, id_docente: idRol === ROLES.PROFESOR ? 1 : null, nombres: 'Prueba' },
    cargando: false,
  })
  return render(
    <QueryClientProvider client={crearQueryClient()}>
      <ToastProvider>
        <MemoryRouter>
          <RubricaPage />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  _reiniciarCola()
  useRechazosStore.getState().limpiar()
  conexion(true)
  // Es global: un test que acabó sin red lo dejaría así para el siguiente.
  onlineManager.setOnline(true)
  listarRubricas.mockReset()
  guardarRubricas.mockReset()
  listarRubricas.mockResolvedValue(pagina())
  guardarRubricas.mockImplementation(async (items) =>
    items.map((it) => ({
      id_operacion: it.id_operacion,
      estado: 'aceptada',
      motivo: null,
      detail: null,
      registro: item({ ...it, estado: 'incompleta', version: 1 }),
    })),
  )
  useActividadStore.getState().iniciar({ idDocente: 1 })
})

afterEach(() => useActividadStore.getState().limpiar())

/** La conexión del navegador: la cola no envía sin ella. */
function conexion(enLinea) {
  Object.defineProperty(window.navigator, 'onLine', { value: enLinea, configurable: true })
  // TanStack Query y `useConexion` se enteran por el evento, no por la propiedad.
  window.dispatchEvent(new Event(enLinea ? 'online' : 'offline'))
}

/** Vuelve la conexión y se vacía la cola, como al reconectar. */
async function reconectar() {
  conexion(true)
  await reintentarAhora()
}

describe('La escala de cada dimensión', () => {
  it('en Alfabetización ofrece Pre-inicio en Fluidez pero no en Comprensión', async () => {
    /**
     * Alfabetización admite 0 en Fluidez —hay alumnos que todavía no reconocen
     * las letras— y Comprensión empieza en 1, porque quien ya está ahí lee
     * algo por definición. Ofrecer el 0 donde no se admite sería mandar al
     * docente a un `valor_no_permitido` evitable.
     */
    montar()

    const fluidez = await screen.findByLabelText(/fluidez de Torres, Ana/i, {}, ESPERA)
    expect(within(fluidez).getByRole('option', { name: 'Pre-inicio' })).toBeInTheDocument()

    const comprension = screen.getByLabelText(/comprensión de Torres, Ana/i)
    expect(within(comprension).queryByRole('option', { name: 'Pre-inicio' })).not.toBeInTheDocument()
    expect(within(comprension).getByRole('option', { name: 'Inicio' })).toBeInTheDocument()
  })

  it('"Sin evaluar" existe como opción propia y NO es el 0', async () => {
    // Es la distinción de fondo: `null` es que nadie lo evaluó y 0 es la peor
    // valoración. Si el desplegable las juntara, no habría forma de volver a
    // "sin evaluar" después de un 0.
    montar()

    const fluidez = await screen.findByLabelText(/fluidez de/i, {}, ESPERA)
    expect(within(fluidez).getByRole('option', { name: /sin evaluar/i })).toBeInTheDocument()
    expect(fluidez).toHaveValue('')
  })
})

describe('Guardar una evaluación', () => {
  it('manda SOLO la dimensión que cambió, con su versión', async () => {
    montar()

    const fluidez = await screen.findByLabelText(/fluidez de/i, {}, ESPERA)
    fireEvent.change(fluidez, { target: { value: '2' } })

    await waitFor(() => expect(guardarRubricas).toHaveBeenCalled(), ESPERA)
    const [enviado] = guardarRubricas.mock.calls[0][0]
    expect(enviado.fluidez).toBe(2)
    // Comprensión NO viaja: mandarla en null la borraría sin que nadie lo
    // pidiera, y es justo lo que hace un `...fila` descuidado.
    expect('comprension' in enviado).toBe(false)
    // `null` porque el alumno todavía no tenía evaluación.
    expect(enviado.version).toBeNull()
    expect(enviado.id_operacion).toEqual(expect.any(String))
  })

  it('el 0 se manda como 0, no como vacío', async () => {
    /**
     * Es el caso que un `Number(valor) || null` rompe en silencio: convertiría
     * el 0 en null y el alumno quedaría sin evaluar en vez de en Pre-inicio.
     */
    montar()

    const fluidez = await screen.findByLabelText(/fluidez de/i, {}, ESPERA)
    fireEvent.change(fluidez, { target: { value: '0' } })

    await waitFor(() => expect(guardarRubricas).toHaveBeenCalled(), ESPERA)
    expect(guardarRubricas.mock.calls[0][0][0].fluidez).toBe(0)
  })

  it('volver a "Sin evaluar" borra la dimensión: viaja en null', async () => {
    listarRubricas.mockResolvedValue(pagina({ items: [item({ fluidez: 3, estado: 'incompleta', version: 1 })] }))

    montar()
    const fluidez = await screen.findByLabelText(/fluidez de/i, {}, ESPERA)
    fireEvent.change(fluidez, { target: { value: '' } })

    await waitFor(() => expect(guardarRubricas).toHaveBeenCalled(), ESPERA)
    expect(guardarRubricas.mock.calls[0][0][0].fluidez).toBeNull()
  })

  it('con una sola dimensión se guarda igual y queda incompleta', async () => {
    // El docente no tiene por qué evaluar las dos cosas en la misma sentada:
    // obligarle le haría perder lo ya observado.
    listarRubricas.mockResolvedValue(pagina({ items: [item({ fluidez: 2, estado: 'incompleta', version: 1 })] }))

    montar()

    await screen.findByText('Incompleta', {}, ESPERA)
    // Sin las dos no hay nota: una nota a medias no es una nota.
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('el resultado llega en décimas y se pinta con un decimal', async () => {
    // 4·F + 6·C = 4·2 + 6·3 = 26 décimas, o sea 2,6.
    listarRubricas.mockResolvedValue(
      pagina({ items: [item({ fluidez: 2, comprension: 3, estado: 'completada', resultado_decimas: 26, version: 2 })] }),
    )

    montar()

    await screen.findByText('2.6', {}, ESPERA)
    expect(screen.getByText('Completada')).toBeInTheDocument()
  })

  it('un choque de versiones no se reintenta: "Cargar versión actual" adopta el vigente y descarta', async () => {
    /**
     * Otra persona la cambió mientras esta la miraba. Reintentar pisaría su
     * cambio; adoptarlo en silencio ocultaría que el valor no se guardó. El
     * rechazo trae el registro VIGENTE: se carga cuando el docente lo pide.
     */
    descartarOperacion.mockClear()
    listarRubricas.mockResolvedValue(pagina({ items: [item({ version: 1 })] }))
    guardarRubricas.mockResolvedValue([
      {
        id_operacion: 'op',
        estado: 'rechazada',
        motivo: 'modificacion_concurrente',
        detail: null,
        registro: item({ fluidez: 4, comprension: 4, estado: 'completada', resultado_decimas: 40, version: 7 }),
      },
    ])

    montar()
    fireEvent.change(await screen.findByLabelText(/fluidez de/i, {}, ESPERA), { target: { value: '2' } })

    fireEvent.click(await screen.findByRole('button', { name: 'Cargar versión actual' }, ESPERA))
    await waitFor(() => expect(descartarOperacion).toHaveBeenCalledWith('op'), ESPERA)

    // Se ve lo del servidor, no lo que se acababa de elegir.
    await screen.findByText('4.0', {}, ESPERA)
    expect(await screen.findByLabelText(/fluidez de/i, {}, ESPERA)).toHaveValue('4')
  })

  it('un valor rechazado se explica con el texto del servidor', async () => {
    guardarRubricas.mockResolvedValue([
      {
        id_operacion: 'op',
        estado: 'rechazada',
        motivo: 'valor_no_permitido',
        detail: 'Selecciona una valoración permitida para esta dimensión.',
        registro: { campo: 'fluidez' },
      },
    ])

    montar()
    fireEvent.change(await screen.findByLabelText(/fluidez de/i, {}, ESPERA), { target: { value: '2' } })

    expect(await screen.findByText(/valoración permitida para esta dimensión/i, {}, ESPERA)).toBeInTheDocument()
  })
})

describe('Sin conexión (RNF-001)', () => {
  it('la evaluación se encola y sale al reconectar con id_operacion, version, realizado_en e id_actividad', async () => {
    montar()
    const fluidez = await screen.findByLabelText(/fluidez de/i, {}, ESPERA)
    conexion(false)
    fireEvent.change(fluidez, { target: { value: '0' } })

    await waitFor(() => expect(useSyncStore.getState().pendientes).toBe(1), ESPERA)
    expect(guardarRubricas).not.toHaveBeenCalled()
    // El 0 (Pre-inicio) se ve elegido mientras espera; no es "Sin evaluar".
    expect(screen.getByLabelText(/fluidez de/i)).toHaveValue('0')

    await reconectar()
    await waitFor(() => expect(guardarRubricas).toHaveBeenCalledTimes(1), ESPERA)
    const [enviado] = guardarRubricas.mock.calls[0][0]
    ;['id_operacion', 'version', 'realizado_en', 'id_actividad'].forEach((campo) => expect(enviado).toHaveProperty(campo))
    expect(enviado.fluidez).toBe(0)
    expect(enviado.id_actividad).toBe(useActividadStore.getState().sesion.id)
  })

  it('un rechazo al sincronizar se muestra con su detail', async () => {
    guardarRubricas.mockImplementation(async (items) => [
      {
        id_operacion: items[0].id_operacion,
        estado: 'rechazada',
        motivo: 'actividad_requerida',
        detail: 'Debes iniciar una actividad de trabajo para registrar o modificar las rúbricas.',
        registro: null,
      },
    ])
    montar()
    const fluidez = await screen.findByLabelText(/fluidez de/i, {}, ESPERA)
    conexion(false)
    fireEvent.change(fluidez, { target: { value: '2' } })
    await reconectar()

    expect(await screen.findByText(/iniciar una actividad de trabajo para registrar o modificar las rúbricas/i, {}, ESPERA)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Descartar' })).toBeInTheDocument()
  })

  it('un choque de versión al sincronizar ofrece "Cargar versión actual"', async () => {
    guardarRubricas.mockImplementation(async (items) => [
      {
        id_operacion: items[0].id_operacion,
        estado: 'rechazada',
        motivo: 'modificacion_concurrente',
        detail: null,
        registro: item({ fluidez: 3, version: 4 }),
      },
    ])
    montar()
    const fluidez = await screen.findByLabelText(/fluidez de/i, {}, ESPERA)
    conexion(false)
    fireEvent.change(fluidez, { target: { value: '2' } })
    await reconectar()

    fireEvent.click(await screen.findByRole('button', { name: 'Cargar versión actual' }, ESPERA))
    await waitFor(() => expect(descartarOperacion).toHaveBeenCalled(), ESPERA)
    await waitFor(() => expect(screen.getByLabelText(/fluidez de/i)).toHaveValue('3'), ESPERA)
  })
})

describe('Meses que no se pueden evaluar', () => {
  it('un mes futuro se dice como un estado, no como un fallo', async () => {
    // No hay nada que corregir: solo otro mes que elegir.
    const error = new Error('futuro')
    error.response = { status: 422, data: { detail: 'No es posible evaluar meses futuros.', motivo: 'mes_futuro' } }
    listarRubricas.mockRejectedValue(error)

    montar()

    await screen.findByText(/este mes no se puede evaluar/i, {}, ESPERA)
    expect(screen.getByText('No es posible evaluar meses futuros.')).toBeInTheDocument()
    expect(screen.queryByText(/no se pudo cargar/i)).not.toBeInTheDocument()
  })

  it('un mes sin alumnos es un 200 con su explicación, no una lista que falló', async () => {
    listarRubricas.mockResolvedValue(
      pagina({ items: [], total: 0, detail: 'No hay alumnos que corresponda evaluar en este grupo y mes.' }),
    )

    montar()

    await screen.findByText(/sin alumnos que evaluar/i, {}, ESPERA)
    expect(screen.getByText(/no hay alumnos que corresponda evaluar/i)).toBeInTheDocument()
  })
})

describe('Criterios (CU029)', () => {
  it('se piden con el id_ciclo ENTERO que manda GET /rubricas, no con su nombre', async () => {
    listarRubricas.mockResolvedValue(pagina({ ciclo: 'IV', id_ciclo: 2 }))
    montar()
    await screen.findByLabelText(/fluidez de/i, {}, ESPERA)

    fireEvent.click(screen.getByRole('button', { name: 'Ver criterios' }))
    await waitFor(() => expect(obtenerCriterios).toHaveBeenCalled(), ESPERA)
    expect(obtenerCriterios.mock.calls[0][0]).toEqual(expect.objectContaining({ idCiclo: 2 }))
    expect(within(await screen.findByRole('dialog', {}, ESPERA)).getByText(/Ciclo IV/)).toBeInTheDocument()
  })
})

describe('Quién puede escribir', () => {
  it('el Supervisor consulta en solo lectura', async () => {
    listarRubricas.mockResolvedValue(
      pagina({
        escritura: {
          permitida: false,
          motivo: 'El Supervisor consulta las rúbricas en solo lectura.',
          id_permiso: null,
          aviso_permiso: null,
        },
      }),
    )

    montar(ROLES.JEFA)

    await screen.findByText(/el Supervisor consulta las rúbricas en solo lectura/i, {}, ESPERA)
    expect(screen.getByLabelText(/fluidez de/i)).toBeDisabled()
  })

  it('sin actividad iniciada se ve la rúbrica pero no se edita', async () => {
    useActividadStore.getState().limpiar()

    montar()

    await screen.findByText('Inicia una actividad de trabajo para habilitar el registro de datos.', {}, ESPERA)
    expect(await screen.findByLabelText(/fluidez de/i, {}, ESPERA)).toBeDisabled()
  })
})
