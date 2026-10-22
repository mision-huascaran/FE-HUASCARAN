// CU023 a CU026 — Seguimiento de Lectura, contrato de la tanda 7.
//
// Se comprueba lo que el contrato decide y es fácil romper sin darse cuenta:
//
//   · Que la tabla NO EXISTA no es un error: es la respuesta normal de una
//     semana sin tabla, y lo único que se puede hacer ahí es crearla.
//   · Al crearla se dice a qué CLASE quedará atada, porque crearla congela la
//     lista de alumnos de esa clase.
//   · Sin presente o tardanza no se registran libros, pero la observación sí.
//   · Una fila manda SOLO lo que cambió: un `null` de más borraría datos que
//     el docente no quiso borrar.
//   · "No realizada" bloquea también las observaciones.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider, onlineManager } from '@tanstack/react-query'
import { crearQueryClient } from '../../../App'
import { ToastProvider } from '../../../components/ui'
import LecturaPage from '../LecturaPage'
import useSessionStore from '../../../store/sessionStore'
import useActividadStore from '../../../store/actividadStore'
import { ROLES } from '../../../auth/roles'
import { _reiniciarCola, reintentarAhora } from '../../../lib/colaOffline'
import useSyncStore from '../../../store/syncStore'
import useRechazosStore from '../../../store/rechazosStore'

const ESPERA = { timeout: 8000 }

const CLASE = { id_clase: 41, fecha: '2026-06-15', tipo: 'habitual', reprogramada: false }
const ESCRITURA = { permitida: true, motivo: null, id_permiso: null, aviso_permiso: null }

const fila = (extra = {}) => ({
  id_alumno: 5,
  nombre: 'Torres, Ana',
  inactivo: false,
  asistencia: 'presente',
  nivel_academico: null,
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
  id_semana: 23,
  clase_referencia: CLASE,
  filas: [fila()],
  escritura: ESCRITURA,
  ...extra,
})

/** El 404 de "no existe todavía", con la forma exacta del contrato. */
function errorPorCrear(claseSugerida = CLASE) {
  const error = new Error('no existe')
  error.response = {
    status: 404,
    data: {
      detail: 'No existe una tabla de lectura semanal para los filtros seleccionados.',
      motivo: 'tabla_no_existe',
      clase_referencia_sugerida: claseSugerida,
      escritura: ESCRITURA,
    },
  }
  return error
}


// "Cargar versión actual" descarta la operación rechazada (P4 §1).
const descartarOperacion = vi.fn(async () => ({ estado: 'descartada' }))
vi.mock('../../../api/resources/sincronizacion', async (importOriginal) => ({
  ...(await importOriginal()),
  descartarOperacion: (...a) => descartarOperacion(...a),
}))

const obtenerTabla = vi.fn()
const crearTabla = vi.fn()
const guardarFilas = vi.fn()
const marcarNoRealizada = vi.fn()

vi.mock('../../../api/resources/lectura', async (importOriginal) => ({
  ...(await importOriginal()),
  obtenerTabla: (...a) => obtenerTabla(...a),
  crearTabla: (...a) => crearTabla(...a),
  guardarFilas: (...a) => guardarFilas(...a),
  marcarNoRealizada: (...a) => marcarNoRealizada(...a),
}))

// Los filtros salen de las asignaciones y del detalle del colegio. Se fijan
// para que el test hable de la tabla y no de los desplegables.
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

vi.mock('../../../api/resources/catalogos', async (importOriginal) => ({
  ...(await importOriginal()),
  obtenerSemanas: vi.fn(async () => [
    { id: 23, id_semana: 23, numero_semana: 23, fecha_inicio: '2026-06-15', fecha_fin: '2026-06-19', cerrada: false },
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

beforeEach(() => {
  localStorage.clear()
  _reiniciarCola()
  useRechazosStore.getState().limpiar()
  conexion(true)
  // Es global: un test que acabó sin red lo dejaría así para el siguiente.
  onlineManager.setOnline(true)
  obtenerTabla.mockReset()
  crearTabla.mockReset()
  guardarFilas.mockReset()
  marcarNoRealizada.mockReset()
  descartarOperacion.mockClear()
  marcarNoRealizada.mockImplementation(async () =>
    tabla({ estado: 'no_realizada', motivo_no_realizada: 'Paro de transportistas', version: 2 }),
  )
  guardarFilas.mockImplementation(async (_id, filas) =>
    filas.map((f) => ({
      id_operacion: f.id_operacion,
      estado: 'aceptada',
      motivo: null,
      detail: null,
      registro: fila({ ...f, version: 2 }),
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

describe('La tabla que todavía no existe (CU023)', () => {
  it('no se trata como un error: se ofrece crearla y se dice sobre qué clase', async () => {
    /**
     * Era el fallo de fondo del diseño anterior: un 404 pintaba un cartel de
     * error y el docente se quedaba sin la única acción posible. Y se nombra
     * la clase porque crear la tabla CONGELA su lista de alumnos: no es un
     * detalle de implementación, es la consecuencia de pulsar el botón.
     */
    obtenerTabla.mockRejectedValue(errorPorCrear())

    montar()

    await screen.findByText(/esta semana aún no tiene tabla de lectura/i, {}, ESPERA)
    expect(screen.getByText(/con los alumnos que estaban en ella ese día/i)).toBeInTheDocument()
    expect(screen.queryByText(/no se pudo cargar/i)).not.toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /crear la tabla/i }, ESPERA)).toBeEnabled()
  })

  it('sin clase programada en la semana no deja crearla a ciegas', async () => {
    // La semana solo tiene adicionales: hay que ELEGIR la clase. Crear sin
     // saber cuál ataría la tabla a una clase que el docente no eligió.
    obtenerTabla.mockRejectedValue(errorPorCrear(null))

    montar()

    await screen.findByText(/hace falta elegir la clase de referencia/i, {}, ESPERA)
    expect(screen.queryByRole('button', { name: /crear la tabla/i })).not.toBeInTheDocument()
  })

  it('crearla manda la clase sugerida, no una fecha inventada', async () => {
    obtenerTabla.mockRejectedValue(errorPorCrear())
    crearTabla.mockResolvedValue(tabla())

    montar()
    fireEvent.click(await screen.findByRole('button', { name: /crear la tabla/i }, ESPERA))

    await waitFor(() => expect(crearTabla).toHaveBeenCalled(), ESPERA)
    expect(crearTabla.mock.calls[0][0]).toMatchObject({
      fechaClaseReferencia: '2026-06-15',
      idSemana: '23',
      idPrograma: '2',
    })
    // Y lleva su `id_operacion`: crear dos veces por un doble clic sería
    // crear dos tablas, y el servidor solo las deduplica por ese campo.
    expect(crearTabla.mock.calls[0][0].idOperacion).toEqual(expect.any(String))
  })

  it('si alguien la creó entre medias, no se grita: se recarga', async () => {
    obtenerTabla.mockRejectedValue(errorPorCrear())
    const choque = new Error('existe')
    choque.response = { status: 409, data: { detail: 'Ya existe.', motivo: 'tabla_existente', id: 7 } }
    crearTabla.mockRejectedValue(choque)

    montar()
    fireEvent.click(await screen.findByRole('button', { name: /crear la tabla/i }, ESPERA))

    await waitFor(() => expect(crearTabla).toHaveBeenCalled(), ESPERA)
    expect(screen.queryByText(/no se pudo crear/i)).not.toBeInTheDocument()
  })
})

describe('Las filas de la tabla (CU024)', () => {
  it('manda SOLO el campo que cambió', async () => {
    /**
     * Un campo omitido no se toca; uno en `null` se borra. Si la fila viajara
     * entera, los campos que el docente no tocó irían en null y se borrarían
     * solos: es el error que `...fila` comete sin avisar.
     */
    obtenerTabla.mockResolvedValue(tabla())

    montar()
    const lsl = await screen.findByLabelText(/libros de sala de lectura de Torres, Ana/i, {}, ESPERA)
    fireEvent.change(lsl, { target: { value: '3' } })
    fireEvent.blur(lsl)

    await waitFor(() => expect(guardarFilas).toHaveBeenCalled(), ESPERA)
    const [, filas] = guardarFilas.mock.calls[0]
    expect(Object.keys(filas[0]).sort()).toEqual(
      ['cantidad_lsl', 'id_actividad', 'id_alumno', 'id_operacion', 'realizado_en', 'version'].sort(),
    )
    expect(filas[0].cantidad_lsl).toBe(3)
    // La versión que se leyó: es con lo que el servidor detecta que otro
    // editó la misma fila mientras esta persona la miraba.
    expect(filas[0].version).toBe(1)
  })

  it('un campo vacío viaja como null, y el cero NO es vacío', async () => {
    // `cantidad_lsl: null` es "no registrado" y 0 es "leyó cero libros". Si se
    // confundieran, una fila sin registrar se daría por completada.
    obtenerTabla.mockResolvedValue(tabla({ filas: [fila({ cantidad_lsl: 3 })] }))

    montar()
    const lsl = await screen.findByLabelText(/libros de sala de lectura/i, {}, ESPERA)
    fireEvent.change(lsl, { target: { value: '0' } })
    fireEvent.blur(lsl)

    await waitFor(() => expect(guardarFilas).toHaveBeenCalled(), ESPERA)
    expect(guardarFilas.mock.calls[0][1][0].cantidad_lsl).toBe(0)
  })

  it('sin asistencia no se escriben libros, pero la observación sí', async () => {
    obtenerTabla.mockResolvedValue(tabla({ filas: [fila({ asistencia: 'ausente', estado_fila: 'no_aplica' })] }))

    montar()

    expect(await screen.findByLabelText(/título del LSN/i, {}, ESPERA)).toBeDisabled()
    expect(screen.getByLabelText(/libros de sala de lectura/i)).toBeDisabled()
    // Justificar la falta es justo lo que hace falta aquí.
    expect(screen.getByRole('button', { name: /añadir observación de/i })).toBeEnabled()
  })

  it('avisa cuando hay lectura registrada y hoy consta ausente', async () => {
    /**
     * Alguien corrigió la asistencia después de registrar los libros. No se
     * borra nada solo —sería decidir por el docente—: se avisa para que él
     * resuelva (CU024).
     */
    obtenerTabla.mockResolvedValue(
      tabla({ filas: [fila({ asistencia: 'ausente', cantidad_lsl: 2, total_libros: 2, revisar_asistencia: true })] }),
    )

    montar()
    await screen.findByText(/revisa la asistencia/i, {}, ESPERA)
  })

  it('un rechazo por fila se explica con el texto del servidor', async () => {
    obtenerTabla.mockResolvedValue(tabla())
    guardarFilas.mockResolvedValue([
      {
        id_operacion: 'op',
        estado: 'rechazada',
        motivo: 'lsn_invalido',
        detail: 'Selecciona un máximo de 5 o 10 e ingresa una nota entre 0 y ese máximo.',
        registro: null,
      },
    ])

    montar()
    const nota = await screen.findByLabelText(/nota del LSN/i, {}, ESPERA)
    fireEvent.change(nota, { target: { value: '9' } })
    fireEvent.blur(nota)

    await screen.findByText(/ingresa una nota entre 0 y ese máximo/i, {}, ESPERA)
  })
})

describe('Choque de versiones (CU024)', () => {
  it('no se adopta en silencio: avisa y "Cargar versión actual" descarta la operación', async () => {
    obtenerTabla.mockResolvedValue(tabla())
    guardarFilas.mockResolvedValue([
      {
        id_operacion: 'op-1',
        estado: 'rechazada',
        motivo: 'modificacion_concurrente',
        detail: 'Este registro de lectura fue modificado desde que lo consultaste. Revisa la versión actual antes de guardar nuevamente.',
        registro: fila({ cantidad_lsl: 7, total_libros: 7, estado_fila: 'completada', version: 5 }),
      },
    ])

    montar()
    const lsl = await screen.findByLabelText(/libros de sala de lectura de Torres, Ana/i, {}, ESPERA)
    fireEvent.change(lsl, { target: { value: '3' } })
    fireEvent.blur(lsl)

    const boton = await screen.findByRole('button', { name: 'Cargar versión actual' }, ESPERA)
    expect(screen.getByText(/fue modificado desde que lo consultaste/i)).toBeInTheDocument()
    expect(descartarOperacion).not.toHaveBeenCalled()

    fireEvent.click(boton)
    await waitFor(() => expect(descartarOperacion).toHaveBeenCalledWith('op-1'), ESPERA)
    await waitFor(() => expect(screen.getByLabelText(/libros de sala de lectura de Torres, Ana/i)).toHaveValue(7), ESPERA)
    expect(screen.queryByRole('button', { name: 'Cargar versión actual' })).not.toBeInTheDocument()
  })
})

describe('Sin conexión (RNF-001)', () => {
  const LSL = /libros de sala de lectura de Torres, Ana/i
  const editarLsl = (valor) => {
    const lsl = screen.getByLabelText(LSL)
    fireEvent.change(lsl, { target: { value: valor } })
    fireEvent.blur(lsl)
  }
  /** Se corta la red con la tabla ya descargada, como en el aula. */
  const montarYCortar = async () => {
    montar()
    await screen.findByLabelText(LSL, {}, ESPERA)
    conexion(false)
  }

  it('la fila se encola y sale al reconectar con id_operacion, version, realizado_en e id_actividad', async () => {
    obtenerTabla.mockResolvedValue(tabla())
    await montarYCortar()
    editarLsl('3')

    await waitFor(() => expect(useSyncStore.getState().pendientes).toBe(1), ESPERA)
    expect(guardarFilas).not.toHaveBeenCalled()
    // Mientras espera, la fila muestra lo que escribió el docente.
    expect(screen.getByLabelText(LSL)).toHaveValue(3)

    await reconectar()
    await waitFor(() => expect(guardarFilas).toHaveBeenCalledTimes(1), ESPERA)
    const [idTabla, [enviado]] = guardarFilas.mock.calls[0]
    expect(idTabla).toBe(7)
    ;['id_operacion', 'version', 'realizado_en', 'id_actividad'].forEach((campo) => expect(enviado).toHaveProperty(campo))
    expect(enviado.version).toBe(1)
    expect(enviado.id_actividad).toBe(useActividadStore.getState().sesion.id)
    await waitFor(() => expect(useSyncStore.getState().pendientes).toBe(0), ESPERA)
  })

  it('dos cambios de la misma fila sin conexión salen en UN envío, con los dos campos', async () => {
    obtenerTabla.mockResolvedValue(tabla())
    await montarYCortar()
    editarLsl('3')
    const titulo = screen.getByLabelText(/título del LSN de Torres, Ana/i)
    fireEvent.change(titulo, { target: { value: 'El zorro' } })
    fireEvent.blur(titulo)
    await waitFor(() => expect(useSyncStore.getState().pendientes).toBe(1), ESPERA)

    await reconectar()
    await waitFor(() => expect(guardarFilas).toHaveBeenCalledTimes(1), ESPERA)
    expect(guardarFilas.mock.calls[0][1][0]).toEqual(expect.objectContaining({ cantidad_lsl: 3, lsn_titulo: 'El zorro', version: 1 }))
  })

  it('un rechazo al sincronizar se muestra con su detail y se puede descartar', async () => {
    obtenerTabla.mockResolvedValue(tabla())
    guardarFilas.mockImplementation(async (_id, filas) => [
      {
        id_operacion: filas[0].id_operacion,
        estado: 'rechazada',
        motivo: 'sin_habilitacion',
        detail: 'No tienes una habilitación vigente para registrar o corregir la lectura de esta semana.',
        registro: null,
      },
    ])
    await montarYCortar()
    editarLsl('3')
    await reconectar()

    expect(await screen.findByText(/No tienes una habilitación vigente/i, {}, ESPERA)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }))
    await waitFor(() => expect(descartarOperacion).toHaveBeenCalledWith(guardarFilas.mock.calls[0][1][0].id_operacion), ESPERA)
  })

  it('crear la tabla requiere conexión', async () => {
    obtenerTabla.mockRejectedValue(errorPorCrear())
    montar()
    const crear = await screen.findByRole('button', { name: /crear la tabla/i }, ESPERA)
    conexion(false)
    await waitFor(() => expect(crear).toBeDisabled(), ESPERA)
    expect(screen.getByText('Esta acción requiere conexión')).toBeInTheDocument()
  })
})

describe('Semana no realizada (CU026)', () => {
  it('exige un motivo antes de dejar marcarla', async () => {
    // Marcarla pone todas las filas en "no aplica": deja de constar como
    // trabajo pendiente. Sin justificación escrita, nadie podría distinguir
    // después una semana perdida por un paro de una que no se registró.
    obtenerTabla.mockResolvedValue(tabla())

    montar()
    fireEvent.click(await screen.findByRole('button', { name: /marcar como no realizada/i }, ESPERA))

    const dialogo = await screen.findByRole('dialog', { name: /no realizada/i }, ESPERA)
    const confirmar = within(dialogo).getByRole('button', { name: /^marcar como no realizada$/i })
    expect(confirmar).toBeDisabled()

    fireEvent.change(within(dialogo).getByLabelText(/motivo/i), { target: { value: 'Paro de transportistas' } })
    expect(confirmar).toBeEnabled()
    fireEvent.click(confirmar)

    // Va al endpoint de la TABLA, con su id y su versión: sin la versión, dos
    // docentes marcando la misma semana se pisarían sin enterarse.
    await waitFor(() => expect(marcarNoRealizada).toHaveBeenCalled(), ESPERA)
    const [idTabla, cuerpo] = marcarNoRealizada.mock.calls[0]
    expect(idTabla).toBe(7)
    expect(cuerpo).toMatchObject({ motivo: 'Paro de transportistas', version: 1 })
  })

  it('una tabla no realizada dice su motivo y bloquea también las observaciones', async () => {
    obtenerTabla.mockResolvedValue(
      tabla({
        estado: 'no_realizada',
        motivo_no_realizada: 'Paro de transportistas',
        filas: [fila({ estado_fila: 'no_aplica' })],
      }),
    )

    montar()

    await screen.findByText(/paro de transportistas/i, {}, ESPERA)
    expect(screen.getByLabelText(/título del LSN/i)).toBeDisabled()
    // Sin clase no hay nada que justificar por alumno: el globo tampoco.
    expect(screen.getByRole('button', { name: /añadir observación de/i })).toBeDisabled()
    expect(screen.queryByRole('button', { name: /marcar como no realizada/i })).not.toBeInTheDocument()
  })
})

describe('Quién puede escribir', () => {
  it('el Supervisor consulta en solo lectura y no ve la acción de la semana', async () => {
    obtenerTabla.mockResolvedValue(
      tabla({
        escritura: {
          permitida: false,
          motivo: 'El Supervisor consulta el Seguimiento de Lectura en solo lectura.',
          id_permiso: null,
          aviso_permiso: null,
        },
      }),
    )

    montar(ROLES.JEFA)

    await screen.findByText(/el Supervisor consulta el Seguimiento de Lectura en solo lectura/i, {}, ESPERA)
    expect(screen.getByLabelText(/título del LSN/i)).toBeDisabled()
    expect(screen.queryByRole('button', { name: /marcar como no realizada/i })).not.toBeInTheDocument()
  })

  it('sin actividad iniciada se ve la tabla pero no se edita', async () => {
    obtenerTabla.mockResolvedValue(tabla())
    useActividadStore.getState().limpiar()

    montar()

    await screen.findByText('Inicia una actividad de trabajo para habilitar el registro de datos.', {}, ESPERA)
    expect(await screen.findByLabelText(/título del LSN/i, {}, ESPERA)).toBeDisabled()
  })
})
