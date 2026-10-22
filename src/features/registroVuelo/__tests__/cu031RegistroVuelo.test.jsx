// CU031, CU032 — Registro de Vuelo, contrato de la tanda 9.
//
// Lo que se comprueba es el reparto de responsabilidades, que es el fondo del
// caso de uso: el servidor calcula y el docente decide.
//
//   · La entrada y la sugerencia se MUESTRAN. Mandarlas es un 422 del lote
//     entero, así que no pueden colarse en el cuerpo ni por accidente.
//   · Sin nivel del periodo anterior, la entrada queda PENDIENTE y nunca cae
//     a la letra del grado.
//   · Sin rúbrica completa no hay sugerencia, y no se inventa.
//   · La habilitación es POR PERIODO: un PA futuro no se registra.
//   · El nivel colocado no se puede volver a "sin decidir".
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { crearQueryClient } from '../../../App'
import { ToastProvider } from '../../../components/ui'
import RegistroVueloAnualPage from '../RegistroVueloAnualPage'
import useSessionStore from '../../../store/sessionStore'
import useActividadStore from '../../../store/actividadStore'
import { ROLES } from '../../../auth/roles'

const ESPERA = { timeout: 8000 }

const PERMITE = { permitida: true, motivo: null, id_permiso: null, aviso_permiso: null }

const periodoGlobal = (numero, estado, escritura = PERMITE) => ({
  numero,
  id_periodo_academico: 4 + numero,
  nombre: `PA${numero}`,
  fecha_inicio: '2026-03-02',
  fecha_fin: '2026-05-15',
  estado,
  escritura,
})

const periodo = (numero, extra = {}) => ({
  numero,
  id_periodo_academico: 4 + numero,
  id_registro: null,
  version: null,
  entrada: { nivel: { id: 6, letra: 'E' }, origen: 'periodo_anterior', texto: 'Proviene del nivel colocado en el periodo anterior.' },
  sugerencia: {
    accion: 'subir',
    nivel: { id: 7, letra: 'F' },
    texto: 'Subir nivel',
    resultado_decimas: 30,
    excepcion: null,
    rubrica: { id: 12, mes: '2026-06', fluidez: 'Logrado', comprension: 'Logrado', resultado_decimas: 30 },
  },
  nivel_colocado: null,
  nivel_programa: null,
  proyeccion: null,
  observacion: null,
  aviso_entrada_cambio: false,
  aviso: null,
  incompleto: true,
  ...extra,
})

const alumno = (extra = {}) => ({
  id_alumno: 31,
  nombre: 'Torres, Ana',
  id_programa: 2,
  inactivo: false,
  avance_anual: 0,
  periodos: [periodo(1), periodo(2)],
  ...extra,
})

const respuesta = (extra = {}) => ({
  items: [alumno()],
  total: 1,
  page: 1,
  page_size: 40,
  total_pages: 1,
  periodos: [periodoGlobal(1, 'culminado'), periodoGlobal(2, 'en_curso')],
  aviso: null,
  ...extra,
})

const listarRegistroVuelo = vi.fn()
const guardarRegistroVuelo = vi.fn()

// "Cargar versión actual" descarta la operación rechazada (P4 §1).
const descartarOperacion = vi.fn(async () => ({ estado: 'descartada' }))
vi.mock('../../../api/resources/sincronizacion', async (importOriginal) => ({
  ...(await importOriginal()),
  descartarOperacion: (...a) => descartarOperacion(...a),
}))

vi.mock('../../../api/resources/registroVueloAnual', async (importOriginal) => ({
  ...(await importOriginal()),
  listarRegistroVuelo: (...a) => listarRegistroVuelo(...a),
  guardarRegistroVuelo: (...a) => guardarRegistroVuelo(...a),
}))

// Las letras de la escala: el desplegable de nivel colocado las necesita, y
// sin ellas `fireEvent.change` no encuentra la opción y no cambia nada.
vi.mock('../../../hooks/useCatalogos', async (importOriginal) => ({
  ...(await importOriginal()),
  useNivelesRazkids: () => ({
    data: [
      { id_nivel_razkids: 6, letra: 'E', orden: 6 },
      { id_nivel_razkids: 7, letra: 'F', orden: 7 },
      { id_nivel_razkids: 10, letra: 'I', orden: 10 },
    ],
    isLoading: false,
  }),
}))

vi.mock('../../../api/resources/administracion', async (importOriginal) => ({
  ...(await importOriginal()),
  listarMisAsignaciones: vi.fn(async () => [
    {
      id_colegio: 1,
      colegio: 'I.E. 1234',
      grados: [{ id_grado: 2, nombre: '2.° grado' }],
      detalle_grados: [{ id_grado: 2, subprogramas: ['Comprensión Lectora'] }],
    },
  ]),
  obtenerColegio: vi.fn(async () => ({
    id_colegio: 1,
    nombre: 'I.E. 1234',
    grados: [{ id_grado: 2, nombre: '2.° grado', secciones: [{ id: 2, nombre: 'Única' }] }],
    programas: [{ id_programa: 2, nombre: 'Comprensión Lectora' }],
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
          <RegistroVueloAnualPage />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  listarRegistroVuelo.mockReset()
  guardarRegistroVuelo.mockReset()
  listarRegistroVuelo.mockResolvedValue(respuesta())
  guardarRegistroVuelo.mockImplementation(async (items) =>
    items.map((it) => ({
      id_operacion: it.id_operacion,
      estado: 'aceptada',
      motivo: null,
      detail: null,
      registro: periodo(2, {
        nivel_colocado: { id: it.id_nivel_colocado ?? 7, letra: 'F' },
        nivel_programa: 'Logrado',
        version: 1,
        incompleto: false,
      }),
    })),
  )
  useActividadStore.getState().iniciar({ idDocente: 1 })
})

afterEach(() => useActividadStore.getState().limpiar())

describe('Lo que calcula el servidor', () => {
  it('la entrada y la sugerencia se muestran, no se editan', async () => {
    montar()

    // La entrada es una letra pintada, no un control. Se busca en su celda y
    // no por texto suelto: la "E" también es el nombre de una opción de los
    // desplegables, y buscarla a secas encuentra tres.
    await screen.findByText('Subir nivel', {}, ESPERA)
    const celdas = screen.getAllByRole('cell')
    expect(celdas[1]).toHaveTextContent('E')

    // Los ÚNICOS desplegables de la fila son los dos del docente. Si la
    // entrada o la sugerencia fueran editables, mandarlas daría un 422 del
    // lote entero.
    const editables = screen
      .getAllByRole('combobox')
      .map((c) => c.getAttribute('aria-label'))
      .filter((etiqueta) => etiqueta?.includes('Torres, Ana'))
    expect(editables).toEqual(['Nivel colocado de Torres, Ana', 'Proyección de Torres, Ana'])
  })

  it('sin nivel del periodo anterior la entrada queda PENDIENTE, no la letra del grado', async () => {
    /**
     * Es la regla que evita arrastrar un error: caer a la letra del grado
     * daría por buena una entrada inventada, y el PA siguiente se construiría
     * sobre ella sin que nadie lo notara.
     */
    listarRegistroVuelo.mockResolvedValue(
      respuesta({
        items: [
          alumno({
            periodos: [
              periodo(1),
              periodo(2, {
                entrada: { nivel: null, origen: 'pendiente_periodo_anterior', texto: 'Pendiente del periodo anterior' },
              }),
            ],
          }),
        ],
      }),
    )

    montar()

    await screen.findByText('Pendiente del periodo anterior', {}, ESPERA)
    // La letra de 2.º grado es "C": no debe aparecer como entrada.
    expect(screen.queryByText('C')).not.toBeInTheDocument()
  })

  it('sin rúbrica completa no se inventa una sugerencia', async () => {
    // Inventarla sería peor que no darla: el docente la leería como una
    // recomendación fundada.
    listarRegistroVuelo.mockResolvedValue(
      respuesta({
        items: [
          alumno({
            periodos: [
              periodo(1),
              periodo(2, {
                sugerencia: {
                  accion: null,
                  nivel: null,
                  texto: 'Pendiente de evaluar',
                  resultado_decimas: null,
                  excepcion: null,
                  rubrica: null,
                },
              }),
            ],
          }),
        ],
      }),
    )

    montar()

    await screen.findByText('Pendiente de evaluar', {}, ESPERA)
    expect(screen.queryByRole('button', { name: /ver la rúbrica/i })).not.toBeInTheDocument()
  })

  it('la rúbrica de referencia se puede abrir para ver de dónde sale la sugerencia', async () => {
    montar()

    fireEvent.click(await screen.findByRole('button', { name: /ver la rúbrica/i }, ESPERA))

    const dialogo = await screen.findByRole('dialog', { name: /rúbrica de referencia/i }, ESPERA)
    expect(within(dialogo).getByText(/junio de 2026/i)).toBeInTheDocument()
    // 30 décimas = 3,0.
    expect(within(dialogo).getByText('3.0')).toBeInTheDocument()
  })
})

describe('Lo que decide el docente', () => {
  it('manda SOLO los tres campos suyos: nada calculado', async () => {
    /**
     * Mandar `entrada` o `sugerencia` no es un campo que el servidor ignore:
     * es un 422 `validacion` que tira el LOTE COMPLETO, hasta 200 decisiones.
     * Y viven en el mismo objeto del que sale el nivel colocado, así que un
     * `...periodo` las mandaría sin que nadie lo notara hasta el error.
     */
    montar()

    const colocado = await screen.findByLabelText(/nivel colocado de Torres, Ana/i, {}, ESPERA)
    fireEvent.change(colocado, { target: { value: '7' } })

    await waitFor(() => expect(guardarRegistroVuelo).toHaveBeenCalled(), ESPERA)
    const [enviado] = guardarRegistroVuelo.mock.calls[0][0]

    expect(enviado.id_nivel_colocado).toBe(7)
    expect(enviado).not.toHaveProperty('entrada')
    expect(enviado).not.toHaveProperty('sugerencia')
    expect(enviado).not.toHaveProperty('nivel_programa')
    expect(enviado).not.toHaveProperty('avance_anual')
    // La proyección no se tocó: no viaja, así que no se borra.
    expect('id_nivel_proyeccion' in enviado).toBe(false)
    expect(enviado.version).toBeNull()
  })

  it('colocar la misma letra que la entrada también es una decisión y se guarda', async () => {
    // Si se tratara como "sin cambios", un docente que confirma el nivel
    // actual se quedaría con el periodo marcado como incompleto para siempre.
    montar()

    const colocado = await screen.findByLabelText(/nivel colocado de/i, {}, ESPERA)
    fireEvent.change(colocado, { target: { value: '6' } })

    await waitFor(() => expect(guardarRegistroVuelo).toHaveBeenCalled(), ESPERA)
    expect(guardarRegistroVuelo.mock.calls[0][0][0].id_nivel_colocado).toBe(6)
  })

  it('el avance anual se actualiza al decidir, sin recargar', async () => {
    // Son 25 puntos por cada PA con nivel colocado. Sin recalcularlo, decidir
    // el cuarto periodo dejaría el avance en 75 % hasta que alguien recargara.
    montar()

    expect(await screen.findByText('0%', {}, ESPERA)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/nivel colocado de/i), { target: { value: '7' } })

    await screen.findByText('25%', {}, ESPERA)
  })

  it('quitar un nivel colocado ya registrado se rechaza con su motivo', async () => {
    // La fila del PA siguiente se construye sobre esa decisión.
    guardarRegistroVuelo.mockResolvedValue([
      {
        id_operacion: 'op',
        estado: 'rechazada',
        motivo: 'nivel_colocado_obligatorio',
        detail: 'El nivel colocado ya registrado no se puede quitar; selecciona otro nivel.',
        registro: null,
      },
    ])
    listarRegistroVuelo.mockResolvedValue(
      respuesta({
        items: [
          alumno({
            periodos: [periodo(1), periodo(2, { nivel_colocado: { id: 7, letra: 'F' }, version: 1, incompleto: false })],
          }),
        ],
      }),
    )

    montar()
    fireEvent.change(await screen.findByLabelText(/nivel colocado de/i, {}, ESPERA), { target: { value: '' } })

    await screen.findByText(/no se puede quitar; selecciona otro nivel/i, {}, ESPERA)
  })

  it('un choque de versiones no se reintenta: "Cargar versión actual" adopta el vigente y descarta', async () => {
    descartarOperacion.mockClear()
    listarRegistroVuelo.mockResolvedValue(
      respuesta({ items: [alumno({ periodos: [periodo(1), periodo(2, { version: 1 })] })] }),
    )
    guardarRegistroVuelo.mockResolvedValue([
      {
        id_operacion: 'op',
        estado: 'rechazada',
        motivo: 'modificacion_concurrente',
        detail: null,
        registro: periodo(2, {
          nivel_colocado: { id: 10, letra: 'I' },
          nivel_programa: 'Avanzado',
          version: 9,
          incompleto: false,
        }),
      },
    ])

    montar()
    fireEvent.change(await screen.findByLabelText(/nivel colocado de/i, {}, ESPERA), { target: { value: '7' } })

    fireEvent.click(await screen.findByRole('button', { name: 'Cargar versión actual' }, ESPERA))
    await waitFor(() => expect(descartarOperacion).toHaveBeenCalledWith('op'), ESPERA)

    // Se ve lo del servidor, no lo que se acababa de elegir.
    await waitFor(() => expect(screen.getByLabelText(/nivel colocado de/i)).toHaveValue('10'), ESPERA)
    expect(screen.getByText('Avanzado')).toBeInTheDocument()
  })

  it('avisa cuando la entrada cambió después de decidir', async () => {
    /**
     * Alguien corrigió el periodo anterior. La decisión del docente NO se
     * recalcula —sería decidir por él—: se avisa con el texto del servidor.
     */
    listarRegistroVuelo.mockResolvedValue(
      respuesta({
        items: [
          alumno({
            periodos: [
              periodo(1),
              periodo(2, {
                nivel_colocado: { id: 7, letra: 'F' },
                version: 1,
                aviso_entrada_cambio: true,
                aviso: 'La entrada de este periodo cambió después de registrar el nivel colocado: revisa la decisión.',
              }),
            ],
          }),
        ],
      }),
    )

    montar()
    await screen.findByText(/la entrada de este periodo cambió después de registrar/i, {}, ESPERA)
  })
})

describe('La habilitación es por periodo', () => {
  it('un PA futuro se puede mirar pero no registrar, y lo dice', async () => {
    listarRegistroVuelo.mockResolvedValue(
      respuesta({
        periodos: [
          periodoGlobal(1, 'culminado'),
          periodoGlobal(2, 'futuro', {
            permitida: false,
            motivo: 'No se puede registrar un periodo académico que todavía no empieza.',
            id_permiso: null,
            aviso_permiso: null,
          }),
        ],
      }),
    )

    montar()

    // Se propone el culminado, porque es el que se puede registrar.
    const pa2 = await screen.findByRole('tab', { name: /PA2/ }, ESPERA)
    fireEvent.click(pa2)

    await screen.findByText(/todavía no empieza/i, {}, ESPERA)
    expect(screen.getByLabelText(/nivel colocado de/i)).toBeDisabled()
  })

  it('tener permiso en un PA no habilita el otro', async () => {
    // La habilitación es de cada periodo: por eso `escritura` llega una vez
    // por PA y no una por alumno.
    listarRegistroVuelo.mockResolvedValue(
      respuesta({
        periodos: [
          periodoGlobal(1, 'culminado', {
            permitida: false,
            motivo: 'No tienes autorización vigente para registrar o modificar este periodo.',
            id_permiso: null,
            aviso_permiso: null,
          }),
          periodoGlobal(2, 'en_curso'),
        ],
      }),
    )

    montar()

    // PA2 está en curso y se propone: ahí sí se puede escribir.
    expect(await screen.findByLabelText(/nivel colocado de/i, {}, ESPERA)).toBeEnabled()

    fireEvent.click(screen.getByRole('tab', { name: /PA1/ }))
    await screen.findByText(/no tienes autorización vigente para registrar o modificar este periodo/i, {}, ESPERA)
    expect(screen.getByLabelText(/nivel colocado de/i)).toBeDisabled()
  })

  it('el Supervisor consulta en solo lectura', async () => {
    listarRegistroVuelo.mockResolvedValue(
      respuesta({
        periodos: [
          periodoGlobal(1, 'culminado'),
          periodoGlobal(2, 'en_curso', {
            permitida: false,
            motivo: 'El Supervisor consulta el Registro de Vuelo en solo lectura.',
            id_permiso: null,
            aviso_permiso: null,
          }),
        ],
      }),
    )

    montar(ROLES.JEFA)

    await screen.findByText(/el Supervisor consulta el Registro de Vuelo en solo lectura/i, {}, ESPERA)
    expect(screen.getByLabelText(/nivel colocado de/i)).toBeDisabled()
  })
})
