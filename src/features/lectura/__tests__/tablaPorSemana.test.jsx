// Tandas B y D de Seguimiento de Lectura: lo que cambió de identidad.
//
//   · LA TABLA ES DE LA SEMANA, no del mes. Una semana que cae en dos meses
//     tiene UNA sola tabla, y su mes es el de su clase de referencia; el
//     filtro Mes solo la ubica, así que se ajusta al que responde el servidor.
//   · "Cambiar clase" existe y se apoya en el listado de clases del colegio,
//     porque no hay endpoint de "clases candidatas".
//   · "Habilitar registro de lectura" deshace la declaración de "no realizada"
//     sin borrarla: queda en el historial con su corrección.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider, onlineManager } from '@tanstack/react-query'
import { crearQueryClient } from '../../../App'
import { ToastProvider } from '../../../components/ui'
import LecturaPage from '../LecturaPage'
import useSessionStore from '../../../store/sessionStore'
import useActividadStore from '../../../store/actividadStore'
import useSyncStore from '../../../store/syncStore'
import { _reiniciarCola, reintentarAhora } from '../../../lib/colaOffline'
import { ROLES } from '../../../auth/roles'

const ESPERA = { timeout: 8000 }

const CLASE = { id_clase: 41, fecha: '2026-06-29', tipo: 'habitual', reprogramada: false }
const ESCRITURA = { permitida: true, motivo: null, id_permiso: null, aviso_permiso: null }

const fila = (extra = {}) => ({
  id_alumno: 5,
  nombre: 'Torres, Ana',
  inactivo: false,
  asistencia: 'presente',
  lsn_titulo: null,
  lsn_nota: null,
  lsn_maximo: null,
  cantidad_lsl: null,
  total_libros: 0,
  observacion: null,
  estado_fila: 'pendiente',
  revisar_asistencia: false,
  version: 1,
  ...extra,
})

/** La tabla de una semana PARTIDA: 29/06 a 03/07, con su clase en junio. */
const tabla = (extra = {}) => ({
  id: 7,
  version: 1,
  estado: 'normal',
  motivo_no_realizada: null,
  id_colegio: 1,
  id_grado: 2,
  id_seccion: 2,
  id_programa: 2,
  id_anio_escolar: 2,
  mes: 6,
  id_semana: 27,
  clase_referencia: CLASE,
  filas: [fila()],
  declaraciones: [],
  escritura: ESCRITURA,
  ...extra,
})

const DECLARACION = {
  id: 7,
  motivo: 'Paro de transportistas',
  declarada_por: { id: 3, nombre: 'Rosa Quispe' },
  fecha_registro: '2026-06-29T14:00:00Z',
  vigente: true,
  motivo_correccion: null,
  revertida_por: null,
  fecha_registro_reversion: null,
}

/**
 * jsdom NO TIENE IndexedDB, y declarar "no realizada" exige quedar apuntado en
 * local antes de darlo por bueno (CU026: "Pendiente de sincronización"). Sin
 * este simulador, la cola descarta el envío y la prueba mediría el fallo de
 * persistencia en vez del flujo.
 */
vi.mock('idb-keyval', () => {
  const almacen = new Map()
  return {
    get: vi.fn(async (k) => almacen.get(k)),
    set: vi.fn(async (k, v) => {
      almacen.set(k, v)
    }),
    del: vi.fn(async (k) => almacen.delete(k)),
  }
})
const obtenerTabla = vi.fn()
const habilitarRegistroLectura = vi.fn()
const cambiarClaseReferencia = vi.fn()
const marcarNoRealizada = vi.fn()

vi.mock('../../../api/resources/lectura', async (importOriginal) => ({
  ...(await importOriginal()),
  obtenerTabla: (...a) => obtenerTabla(...a),
  habilitarRegistroLectura: (...a) => habilitarRegistroLectura(...a),
  cambiarClaseReferencia: (...a) => cambiarClaseReferencia(...a),
  marcarNoRealizada: (...a) => marcarNoRealizada(...a),
}))

const listarClases = vi.fn()
vi.mock('../../../api/resources/clases', async (importOriginal) => ({
  ...(await importOriginal()),
  listarClases: (...a) => listarClases(...a),
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

// La semana 27 cruza de mes: lunes 29/06 y viernes 03/07.
vi.mock('../../../api/resources/catalogos', async (importOriginal) => ({
  ...(await importOriginal()),
  obtenerSemanas: vi.fn(async () => [
    { id: 27, id_semana: 27, numero_semana: 27, fecha_inicio: '2026-06-29', fecha_fin: '2026-07-03' },
  ]),
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
          <LecturaPage />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

/** La conexión del navegador: la cola no envía sin ella. */
function sinConexion() {
  Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true })
  window.dispatchEvent(new Event('offline'))
  onlineManager.setOnline(false)
}

/** Vuelve la señal y se vacía la cola, como al reconectar. */
async function reconectar() {
  Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true })
  window.dispatchEvent(new Event('online'))
  onlineManager.setOnline(true)
  await reintentarAhora()
}

/** Los filtros arrancan plegados en jsdom (RNF-002): hay que abrirlos. */
const abrirFiltros = () => fireEvent.click(screen.getByRole('button', { name: /filtros/i }))

beforeEach(() => {
  localStorage.clear()
  Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true })
  onlineManager.setOnline(true)
  obtenerTabla.mockReset()
  habilitarRegistroLectura.mockReset()
  cambiarClaseReferencia.mockReset()
  marcarNoRealizada.mockReset()
  _reiniciarCola()
  listarClases.mockReset()
  listarClases.mockResolvedValue({
    items: [
      CLASE,
      // Una clase de JULIO, en la misma semana: el caso que la tanda B añade.
      { id_clase: 42, fecha: '2026-07-02', tipo: 'adicional', reprogramada: false },
    ],
    total: 2,
  })
  useActividadStore.getState().iniciar({ idDocente: 1 })
})

afterEach(() => useActividadStore.getState().limpiar())

describe('La tabla se identifica por SEMANA (tanda B)', () => {
  it('la cabecera dice "Clase de esta semana" con la fecha', async () => {
    obtenerTabla.mockResolvedValue(tabla())
    montar()
    expect(await screen.findByText('Clase de esta semana: 29/06/2026', {}, ESPERA)).toBeInTheDocument()
  })

  it('el filtro Mes se AJUSTA al mes de la tabla', async () => {
    /**
     * El servidor devuelve la tabla aunque el mes enviado no sea el suyo. Si el
     * filtro no se moviera, la pantalla diría un mes y enseñaría la tabla de
     * otro, que es justo la confusión que la tanda B viene a quitar.
     */
    obtenerTabla.mockResolvedValue(tabla())
    montar()
    await screen.findByText('Clase de esta semana: 29/06/2026', {}, ESPERA)

    abrirFiltros()
    await waitFor(() => expect(screen.getByLabelText('Mes')).toHaveValue('6'), ESPERA)
  })

  it('la semana PARTIDA se escribe con las fechas completas', async () => {
    // "29/06 al 03/07" no dice de qué año es cada día.
    obtenerTabla.mockResolvedValue(tabla())
    montar()
    await screen.findByText('Clase de esta semana: 29/06/2026', {}, ESPERA)

    abrirFiltros()
    const semana = await screen.findByLabelText('Semana', {}, ESPERA)
    // `findBy`, no `getBy`: las opciones llegan con la consulta de semanas, y
    // con la suite entera en marcha eso puede tardar más que el primer render.
    expect(await within(semana).findByRole('option', { name: /29\/06\/2026 – 03\/07\/2026/ }, ESPERA)).toBeInTheDocument()
  })
})

describe('"Cambiar clase" (CU024, B6)', () => {
  it('ofrece las clases de la SEMANA, aunque caigan en otro mes', async () => {
    obtenerTabla.mockResolvedValue(tabla())
    montar()
    fireEvent.click(await screen.findByRole('button', { name: 'Cambiar clase' }, ESPERA))

    const dialogo = await screen.findByRole('dialog', {}, ESPERA)
    const select = await within(dialogo).findByLabelText(/clase de la semana/i, {}, ESPERA)
    // La actual no se ofrece: elegirla no cambiaría nada.
    expect(within(select).queryByRole('option', { name: /29\/06\/2026/ })).not.toBeInTheDocument()
    expect(within(select).getByRole('option', { name: /02\/07\/2026/ })).toBeInTheDocument()

    // Y se pide el rango de la SEMANA, no el mes.
    expect(listarClases.mock.calls[0][0]).toMatchObject({ desde: '2026-06-29', hasta: '2026-07-03' })
  })

  it('manda el id_clase cuando la clase ya tiene fila', async () => {
    const enJulio = tabla({ mes: 7, version: 2, clase_referencia: { id_clase: 42, fecha: '2026-07-02' } })
    obtenerTabla.mockResolvedValue(tabla())
    cambiarClaseReferencia.mockImplementation(async () => {
      // Como el servidor de verdad: a partir de aquí la tabla es la de julio,
      // y la recarga que sigue tiene que traer esa, no la anterior.
      obtenerTabla.mockResolvedValue(enJulio)
      return enJulio
    })
    montar()
    fireEvent.click(await screen.findByRole('button', { name: 'Cambiar clase' }, ESPERA))

    const dialogo = await screen.findByRole('dialog', {}, ESPERA)
    fireEvent.change(await within(dialogo).findByLabelText(/clase de la semana/i, {}, ESPERA), {
      target: { value: '2026-07-02' },
    })
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cambiar clase' }))

    await waitFor(() => expect(cambiarClaseReferencia).toHaveBeenCalled(), ESPERA)
    expect(cambiarClaseReferencia.mock.calls[0][1]).toMatchObject({ idClase: 42, version: 1 })

    // La clase nueva es de julio: el filtro sigue a la tabla.
    abrirFiltros()
    await waitFor(() => expect(screen.getByLabelText('Mes')).toHaveValue('7'), ESPERA)
  })

  it('con lecturas guardadas NO se ofrece: cambiarla las perdería', async () => {
    obtenerTabla.mockResolvedValue(tabla({ filas: [fila({ total_libros: 2, cantidad_lsl: 2 })] }))
    montar()
    await screen.findByText('Clase de esta semana: 29/06/2026', {}, ESPERA)
    expect(screen.queryByRole('button', { name: 'Cambiar clase' })).not.toBeInTheDocument()
  })
})

describe('"Habilitar registro de lectura" (CU026, tanda D)', () => {
  const noRealizada = (extra = {}) =>
    tabla({
      estado: 'no_realizada',
      motivo_no_realizada: 'Paro de transportistas',
      declaraciones: [DECLARACION],
      ...extra,
    })

  it('el botón sale solo con la tabla declarada "no realizada"', async () => {
    obtenerTabla.mockResolvedValue(tabla())
    montar()
    await screen.findByText('Clase de esta semana: 29/06/2026', {}, ESPERA)
    expect(screen.queryByRole('button', { name: /habilitar registro/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /marcar como no realizada/i })).toBeInTheDocument()
  })

  it('el modal dice qué pasa y exige el motivo de la corrección', async () => {
    obtenerTabla.mockResolvedValue(noRealizada())
    montar()
    fireEvent.click(await screen.findByRole('button', { name: /habilitar registro/i }, ESPERA))

    const dialogo = await screen.findByRole('dialog', {}, ESPERA)
    expect(
      within(dialogo).getByText(
        'La lectura dejará de figurar como no realizada. Podrás registrar los datos de los alumnos según sus asistencias. La justificación anterior se conservará en el historial.',
      ),
    ).toBeInTheDocument()

    const confirmar = within(dialogo).getByRole('button', { name: 'Confirmar' })
    expect(confirmar).toBeDisabled()

    // Solo espacios no vale: el servidor responde 422 y es una ida y vuelta
    // que no hace falta.
    fireEvent.change(within(dialogo).getByLabelText(/motivo de la corrección/i), { target: { value: '   ' } })
    expect(confirmar).toBeDisabled()

    fireEvent.change(within(dialogo).getByLabelText(/motivo de la corrección/i), {
      target: { value: 'Se marcó por error' },
    })
    expect(confirmar).toBeEnabled()
  })

  it('confirmar manda el motivo recortado y la versión de la tabla', async () => {
    obtenerTabla.mockResolvedValue(noRealizada())
    habilitarRegistroLectura.mockResolvedValue(tabla({ version: 2 }))
    montar()
    fireEvent.click(await screen.findByRole('button', { name: /habilitar registro/i }, ESPERA))

    const dialogo = await screen.findByRole('dialog', {}, ESPERA)
    fireEvent.change(within(dialogo).getByLabelText(/motivo de la corrección/i), {
      target: { value: '  Se marcó por error  ' },
    })
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Confirmar' }))

    await waitFor(() => expect(habilitarRegistroLectura).toHaveBeenCalled(), ESPERA)
    expect(habilitarRegistroLectura.mock.calls[0][1]).toMatchObject({ motivo: 'Se marcó por error', version: 1 })
    expect(await screen.findByText('El registro de lectura fue habilitado.', {}, ESPERA)).toBeInTheDocument()
  })

  it('con el motivo escrito, Cancelar pregunta antes de descartarlo', async () => {
    obtenerTabla.mockResolvedValue(noRealizada())
    montar()
    fireEvent.click(await screen.findByRole('button', { name: /habilitar registro/i }, ESPERA))

    const dialogo = await screen.findByRole('dialog', {}, ESPERA)
    fireEvent.change(within(dialogo).getByLabelText(/motivo de la corrección/i), { target: { value: 'Algo' } })
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))

    expect(within(dialogo).getByText('Tienes datos sin guardar. ¿Deseas descartarlos?')).toBeInTheDocument()
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Continuar completando' }))
    expect(within(dialogo).getByLabelText(/motivo de la corrección/i)).toHaveValue('Algo')
  })

  it('un 409 de declaración no vigente NO se reintenta: se dice y se recarga', async () => {
    /**
     * Insistir en una reversión que otra operación ya hizo la desharía. Lo
     * único que puede resolverlo es ver la versión actual.
     */
    obtenerTabla.mockResolvedValue(noRealizada())
    const conflicto = new Error('conflicto')
    conflicto.response = {
      status: 409,
      data: {
        detail: 'La lectura ya no figura como no realizada. Consulta la versión actual.',
        motivo: 'declaracion_no_vigente',
      },
    }
    habilitarRegistroLectura.mockRejectedValue(conflicto)

    montar()
    fireEvent.click(await screen.findByRole('button', { name: /habilitar registro/i }, ESPERA))
    const dialogo = await screen.findByRole('dialog', {}, ESPERA)
    fireEvent.change(within(dialogo).getByLabelText(/motivo de la corrección/i), { target: { value: 'Error mío' } })
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Confirmar' }))

    expect(
      await screen.findByText('La lectura ya no figura como no realizada. Consulta la versión actual.', {}, ESPERA),
    ).toBeInTheDocument()
    expect(habilitarRegistroLectura).toHaveBeenCalledTimes(1)
  })
})

describe('Sin conexión, CU026 las ENCOLA (S12)', () => {
  /**
   * Durante un tiempo estas dos exigieron conexión: se razonó que cambiar la
   * tabla entera sin confirmación del servidor era arriesgado. Pero CU026 ya
   * responde esa pregunta con su flujo "Registro sin conexión a Internet": la
   * declaración se guarda como "Pendiente de sincronización" y la reversión
   * también, "vinculada a la declaración original".
   */
  it('la declaración se queda pendiente en vez de fallar', async () => {
    obtenerTabla.mockResolvedValue(tabla())
    marcarNoRealizada.mockResolvedValue(tabla({ estado: 'no_realizada', version: 2 }))
    montar()
    await screen.findByText('Clase de esta semana: 29/06/2026', {}, ESPERA)

    sinConexion()
    fireEvent.click(screen.getByRole('button', { name: /marcar como no realizada/i }))
    const dialogo = await screen.findByRole('dialog', {}, ESPERA)
    fireEvent.change(within(dialogo).getByLabelText(/motivo/i), { target: { value: 'Paro' } })
    fireEvent.click(within(dialogo).getByRole('button', { name: /marcar como no realizada/i }))

    // Espera en la cola: sin red no se manda, pero tampoco se pierde.
    await waitFor(() => expect(useSyncStore.getState().pendientes).toBeGreaterThan(0), ESPERA)
    expect(marcarNoRealizada).not.toHaveBeenCalled()

    // Y al volver la señal sale sola, con la versión que vio el docente.
    await reconectar()
    await waitFor(() => expect(marcarNoRealizada).toHaveBeenCalled(), ESPERA)
    expect(marcarNoRealizada.mock.calls[0][1]).toMatchObject({ version: 1, motivo: 'Paro' })
  })
})

describe('El historial de declaraciones (tanda D)', () => {
  it('dice quién declaró, cuándo y por qué', async () => {
    obtenerTabla.mockResolvedValue(
      tabla({ estado: 'no_realizada', motivo_no_realizada: 'Paro de transportistas', declaraciones: [DECLARACION] }),
    )
    montar()

    expect(await screen.findByText(/historial de declaraciones \(1\)/i, {}, ESPERA)).toBeInTheDocument()
    expect(screen.getByText('Rosa Quispe')).toBeInTheDocument()
    expect(screen.getAllByText(/paro de transportistas/i).length).toBeGreaterThan(0)
  })

  it('una declaración REVERTIDA sigue en el historial, con su corrección', async () => {
    /**
     * Es lo que distingue una semana que estuvo declarada de una que nunca lo
     * estuvo. Si solo se viera el estado de hoy, las dos se leerían igual.
     */
    obtenerTabla.mockResolvedValue(
      tabla({
        declaraciones: [
          {
            ...DECLARACION,
            vigente: false,
            motivo_correccion: 'Se marcó por error',
            revertida_por: { id: 3, nombre: 'Rosa Quispe' },
            fecha_registro_reversion: '2026-06-29T15:10:00Z',
          },
        ],
      }),
    )
    montar()

    expect(await screen.findByText(/historial de declaraciones/i, {}, ESPERA)).toBeInTheDocument()
    expect(screen.getByText(/habilitó el registro el/)).toBeInTheDocument()
    expect(screen.getByText(/Se marcó por error/)).toBeInTheDocument()
  })
})
