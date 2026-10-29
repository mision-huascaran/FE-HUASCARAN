// CU013 — Programación de clases y reprogramación (D50, D60).
//
// Lo que se fija aquí es lo que el caso de uso decide y es fácil romper:
//
//   · Una clase con alumnos de los DOS subprogramas sale UNA sola vez, con
//     los dos nombres en la misma celda. El filtro sirve para encontrarla, no
//     para partirla.
//   · Una clase con asistencias no se puede reprogramar, y el botón lo dice
//     antes de pulsarlo.
//   · Reprogramar no es una operación offline: sin conexión no se ofrece.
//   · Cada error va junto a su campo, no en un aviso general.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { crearQueryClient } from '../../../App'
import { ToastProvider } from '../../../components/ui'
import ProgramacionDeClases from '../ProgramacionDeClases'

const ESPERA = { timeout: 8000 }

const COLEGIO = {
  id_colegio: 1,
  nombre: 'I.E. 86021 Ranrahirca',
  grados: [{ id_grado: 2, nombre: '2.° grado', secciones: [{ id: 2, nombre: 'Única' }] }],
  programas: [
    { id_programa: 1, nombre: 'Alfabetización' },
    { id_programa: 2, nombre: 'Comprensión Lectora' },
  ],
}

const clase = (extra = {}) => ({
  id_clase: 12,
  id_grado: 2,
  grado: { id: 2, nombre: '2.° grado' },
  id_seccion: 2,
  seccion: { id: 2, nombre: 'Única' },
  fecha_original: '2026-06-15',
  fecha: '2026-06-15',
  tipo: 'habitual',
  reprogramada: false,
  tiene_asistencias: false,
  id_periodo_academico: 2,
  version: null,
  subprogramas: [
    { id: 1, nombre: 'Alfabetización' },
    { id: 2, nombre: 'Comprensión Lectora' },
  ],
  ...extra,
})

const listarClases = vi.fn()
const reprogramarClase = vi.fn()

vi.mock('../../../api/resources/clases', async (importOriginal) => ({
  ...(await importOriginal()),
  listarClases: (...a) => listarClases(...a),
  reprogramarClase: (...a) => reprogramarClase(...a),
  listarReprogramaciones: vi.fn(async () => []),
}))

vi.mock('../../../api/resources/administracion', async (importOriginal) => ({
  ...(await importOriginal()),
  listarAniosEscolares: vi.fn(async () => [{ id: 2, nombre: '2026', vigente: true }]),
  anioVigente: (anios = []) => anios.find((a) => a.vigente) ?? anios[0] ?? null,
}))

let enLinea = true
vi.mock('../../../hooks/useConexion', () => ({ default: () => enLinea }))

const pagina = (items) => ({ items, total: items.length, page: 1, page_size: 40, total_pages: 1 })

/** En jsdom no hay ancho: `FilterBar` colapsa los filtros (RNF-002). */
async function abrirFiltros() {
  fireEvent.click(await screen.findByRole('button', { name: /^filtros$/i }, ESPERA))
}

function montar() {
  return render(
    <QueryClientProvider client={crearQueryClient()}>
      <ToastProvider>
        <MemoryRouter>
          <ProgramacionDeClases colegio={COLEGIO} />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  enLinea = true
  listarClases.mockReset().mockResolvedValue(pagina([clase()]))
  reprogramarClase.mockReset().mockResolvedValue({ fecha: '2026-06-17', reprogramada: true, version: 1 })
})

afterEach(() => vi.clearAllMocks())

describe('La tabla de programación (CU013)', () => {
  it('una clase mixta sale UNA vez, con los dos subprogramas en la misma celda', async () => {
    /**
     * Es la regla de fondo: la clase reúne a los alumnos de los dos
     * subprogramas y es UNA. Partirla en dos filas crearía una obligación de
     * asistencia que no existe.
     */
    montar()
    await screen.findByText('Alfabetización, Comprensión Lectora', {}, ESPERA)

    // La cabecera más UNA sola fila de datos. Se cuenta en el momento de
    // afirmar: guardar la fila de antes la dejaría desconectada si React
    // vuelve a pintar entre medias.
    expect(screen.getAllByRole('row')).toHaveLength(2)
  })

  it('sin clases muestra el texto del caso de uso', async () => {
    listarClases.mockResolvedValue(pagina([]))
    montar()
    // La aserción va DENTRO del `waitFor`: el aviso se oculta mientras hay una
    // consulta en curso, y la tabla vuelve a consultar al llegar los catálogos.
    await waitFor(
      () => expect(screen.getByText('No hay clases programadas para los filtros seleccionados.')).toBeInTheDocument(),
      ESPERA,
    )
  })

  it('con `items` en null no revienta (D48)', async () => {
    listarClases.mockResolvedValue({ items: null, total: 0, total_pages: 1 })
    montar()
    await waitFor(() => expect(screen.getByText(/no hay clases programadas/i)).toBeInTheDocument(), ESPERA)
  })

  it('el filtro de subprograma viaja al servidor, no se aplica en el cliente', async () => {
    // Filtrar aquí daría un `total` que no cuadra con la paginación: el
    // contrato dice que se aplica ANTES de paginar.
    montar()
    await screen.findAllByRole('row', {}, ESPERA)
    await abrirFiltros()

    fireEvent.change(await screen.findByLabelText('Subprograma', {}, ESPERA), { target: { value: '2' } })

    await waitFor(
      () => expect(listarClases.mock.calls.at(-1)[0]).toMatchObject({ idPrograma: '2' }),
      ESPERA,
    )
  })
})

describe('Cuándo se puede reprogramar', () => {
  it('con asistencias registradas el botón está deshabilitado y dice por qué', async () => {
    listarClases.mockResolvedValue(pagina([clase({ tiene_asistencias: true })]))
    montar()

    const boton = await screen.findByRole('button', { name: /reprogramar/i }, ESPERA)
    expect(boton).toBeDisabled()
    expect(boton).toHaveAttribute(
      'title',
      'Esta clase ya tiene asistencias registradas y no puede reprogramarse.',
    )
  })

  it('sin conexión tampoco: no es una operación offline', async () => {
    // CU013 lo dice expresamente. Encolarla podría trasladar la clase dos
    // veces al reconectar.
    enLinea = false
    montar()

    const boton = await screen.findByRole('button', { name: /reprogramar/i }, ESPERA)
    expect(boton).toBeDisabled()
    expect(boton).toHaveAttribute('title', 'Conéctate a Internet para reprogramar una clase.')
  })

  it('una clase ya trasladada ofrece ver su historial, no reprogramar otra vez', async () => {
    listarClases.mockResolvedValue(pagina([clase({ fecha: '2026-06-17', reprogramada: true })]))
    montar()

    await screen.findByRole('button', { name: /ver reprogramación/i }, ESPERA)
    expect(screen.queryByRole('button', { name: /^reprogramar$/i })).not.toBeInTheDocument()
    expect(screen.getAllByText('Reprogramada').length).toBeGreaterThan(0)
  })
})

describe('El modal de reprogramación', () => {
  const abrir = async () => {
    montar()
    await screen.findByText('Alfabetización, Comprensión Lectora', {}, ESPERA)
    fireEvent.click(screen.getByRole('button', { name: /reprogramar/i }))
    // El modal del cajón de filtros también es un `dialog` en jsdom, así que
    // se elige por su título y no por el rol a secas.
    await screen.findByRole('heading', { name: /reprogramar clase/i }, ESPERA)
    return screen.getByRole('heading', { name: /reprogramar clase/i }).closest('[role="dialog"]') ?? document.body
  }

  it('avisa de que el traslado alcanza a los dos subprogramas', async () => {
    // Es justo lo que un Supervisor podría suponer al revés, porque llegó a
    // la fila filtrando por uno de los dos.
    const dialogo = await abrir()
    expect(
      within(dialogo).getByText(
        'La reprogramación se aplica a toda la clase, incluidos los alumnos de ambos subprogramas.',
      ),
    ).toBeInTheDocument()
  })

  it('manda la fecha original y la versión leída', async () => {
    const dialogo = await abrir()

    fireEvent.change(within(dialogo).getByLabelText(/nueva fecha/i), { target: { value: '2026-06-17' } })
    fireEvent.change(within(dialogo).getByLabelText(/motivo/i), { target: { value: 'Actuación del colegio' } })
    fireEvent.click(within(dialogo).getByRole('button', { name: /guardar reprogramación/i }))

    await waitFor(() => expect(reprogramarClase).toHaveBeenCalled(), ESPERA)
    const [idColegio, cuerpo] = reprogramarClase.mock.calls[0]
    expect(idColegio).toBe(1)
    expect(cuerpo).toMatchObject({
      fechaOriginal: '2026-06-15',
      fechaNueva: '2026-06-17',
      motivo: 'Actuación del colegio',
      version: null,
    })
  })

  it('un rechazo de fecha se muestra DEBAJO del campo, no en un aviso suelto', async () => {
    const error = new Error('fallo')
    error.response = {
      status: 422,
      data: {
        detail: 'La nueva fecha no es un día lectivo del calendario del colegio.',
        motivo: 'fecha_no_lectiva',
        errores: [{ campo: 'fecha_nueva', mensaje: 'La nueva fecha no es un día lectivo del calendario del colegio.' }],
      },
    }
    reprogramarClase.mockRejectedValue(error)

    const dialogo = await abrir()
    fireEvent.change(within(dialogo).getByLabelText(/nueva fecha/i), { target: { value: '2026-06-20' } })
    fireEvent.change(within(dialogo).getByLabelText(/motivo/i), { target: { value: 'Prueba' } })
    fireEvent.click(within(dialogo).getByRole('button', { name: /guardar reprogramación/i }))

    await waitFor(() => expect(within(dialogo).getByText(/no es un día lectivo/i)).toBeInTheDocument(), ESPERA)
  })

  it('sin respuesta del servidor NO deja reintentar', async () => {
    /**
     * La solicitud pudo llegar y aplicarse. Reenviarla trasladaría la clase
     * otra vez, y CU013 lo prohíbe hasta verificar el resultado.
     */
    reprogramarClase.mockRejectedValue(Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' }))

    const dialogo = await abrir()
    fireEvent.change(within(dialogo).getByLabelText(/nueva fecha/i), { target: { value: '2026-06-17' } })
    fireEvent.change(within(dialogo).getByLabelText(/motivo/i), { target: { value: 'Prueba' } })
    fireEvent.click(within(dialogo).getByRole('button', { name: /guardar reprogramación/i }))

    await within(dialogo).findByText(/no se pudo confirmar el guardado/i, {}, ESPERA)
    expect(within(dialogo).getByRole('button', { name: /guardar reprogramación/i })).toBeDisabled()
  })
})
