// CU022 — Registrar asistencias de alumnos.
//
// Se comprueba lo que el caso de uso da por escrito y es fácil romper sin
// darse cuenta:
//
//   · No hay botón de guardar: cada marca viaja sola (Auto-save).
//   · "Marcar todos como presentes" NO pisa lo que el docente ya puso a mano.
//   · Sin actividad de trabajo, los controles se bloquean con SU mensaje.
//   · El Supervisor entra en solo lectura y ni siquiera ve el botón de lote.
//   · Si el envío se rechaza, el control vuelve solo y avisa con el texto
//     exacto del caso de uso.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { crearQueryClient } from '../../../App'
import { ToastProvider } from '../../../components/ui'
import AsistenciaPage from '../AsistenciaPage'
import { ERROR_LOCAL, ERROR_SERVIDOR } from '../useAutoguardado'
import useSessionStore from '../../../store/sessionStore'
import useActividadStore from '../../../store/actividadStore'
import useSyncStore from '../../../store/syncStore'
import { _reiniciarCola } from '../../../lib/colaOffline'
import { ROLES } from '../../../auth/roles'

const ESPERA = { timeout: 8000 }

/**
 * jsdom NO TIENE IndexedDB, y CU022 exige que la marca quede apuntada en local
 * antes de darla por buena. Sin este simulador toda marca fallaría por el
 * camino de "error de persistencia", que es justamente uno de los casos a
 * probar: hay que poder encenderlo y apagarlo a voluntad.
 */
let fallaElDisco = false
vi.mock('idb-keyval', () => {
  const almacen = new Map()
  return {
    get: vi.fn(async (k) => almacen.get(k)),
    set: vi.fn(async (k, v) => {
      if (fallaElDisco) throw new Error('QuotaExceededError')
      almacen.set(k, v)
    }),
    del: vi.fn(async (k) => almacen.delete(k)),
  }
})

// El envío se espía para poder rechazarlo: es la única forma de ver la
// reversión que pide CU022 sin tocar la red.
const marcar = vi.fn()
// Sin red, pedir la clase falla como falla axios sin respuesta.
let sinRed = false
vi.mock('../../../api/resources/asistencia', async (importOriginal) => {
  const original = await importOriginal()
  return {
    ...original,
    guardarAsistencia: (...args) => marcar(...args),
    obtenerClase: (...args) =>
      sinRed ? Promise.reject(Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' })) : original.obtenerClase(...args),
  }
})

/** En jsdom no hay ancho: `FilterBar` colapsa los filtros (RNF-002). */
async function abrirFiltros() {
  fireEvent.click(await screen.findByRole('button', { name: /^filtros$/i }, ESPERA))
}

function montar(idRol = ROLES.DOCENTE) {
  useSessionStore.setState({
    token: 'mock.4.2026',
    usuario: { id_usuario: 4, id_rol: idRol, id_docente: idRol === ROLES.DOCENTE ? 1 : null, nombres: 'Prueba' },
    cargando: false,
  })
  return render(
    <QueryClientProvider client={crearQueryClient()}>
      <ToastProvider>
        <MemoryRouter>
          <AsistenciaPage />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

/** Deja los cuatro filtros puestos y devuelve la lista ya pintada. */
async function abrirClase() {
  await abrirFiltros()
  return screen.findByRole('table', {}, ESPERA)
}

/** Los grupos de botones Presente/Ausente que hay pintados ahora mismo. */
const controles = () => screen.getAllByRole('group', { name: /^Asistencia de / })

const ladoPresente = (control) => within(control).getByRole('button', { name: /^Presente: / })
const ladoTardanza = (control) => within(control).getByRole('button', { name: /^Tardanza: / })
const ladoAusente = (control) => within(control).getByRole('button', { name: /^Ausente: / })

beforeEach(() => {
  localStorage.clear()
  _reiniciarCola()
  fallaElDisco = false
  sinRed = false
  marcar.mockReset()
  // La respuesta del contrato: un `ResultadoOperacion` por registro enviado.
  // `aplicado` ya no existe; lo que hay es `estado: 'aceptada' | 'rechazada'`.
  marcar.mockImplementation(async ({ fecha, registros }) => ({
    clase: { id_clase: 12, tipo: 'habitual', etiqueta: 'Clase programada', fecha_original: fecha, fecha, aviso: null },
    resultados: registros.map((r) => ({
      id_operacion: r.id_operacion,
      estado: 'aceptada',
      motivo: null,
      detail: null,
      registro: { id_clase: 12, id_alumno: r.id_alumno, estado: r.estado ?? null, observacion: r.observacion ?? null },
    })),
  }))
  useActividadStore.getState().iniciar({ idDocente: 1 })
})

afterEach(() => {
  useActividadStore.getState().limpiar()
  Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true })
})

describe('Asistencia (CU022)', () => {
  it('no tiene botón de guardar: la marca viaja sola', async () => {
    montar()
    await abrirClase()

    expect(screen.queryByRole('button', { name: /guardar/i })).not.toBeInTheDocument()

    const control = controles()[0]
    fireEvent.click(ladoPresente(control))

    await waitFor(() => expect(ladoPresente(control)).toHaveAttribute('aria-pressed', 'true'), ESPERA)
    await waitFor(() => expect(marcar).toHaveBeenCalled(), ESPERA)
    const enviado = marcar.mock.calls[0][0]
    expect(enviado.registros[0]).toMatchObject({ estado: 'presente' })
    // La hora REAL del clic, con zona, y DENTRO del registro: la habilitación
    // se evalúa a esa hora, así que un envío encolado no puede llevar la de la
    // sincronización (CU022).
    expect(enviado.registros[0].realizado_en).toEqual(expect.any(String))
  })

  it('una clase nueva nace SIN MARCAR, que no es lo mismo que ausente', async () => {
    montar()
    await abrirClase()

    const control = controles()[0]
    // Los TRES apagados: "sin marcar" no es "ausente".
    expect(ladoPresente(control)).toHaveAttribute('aria-pressed', 'false')
    expect(ladoTardanza(control)).toHaveAttribute('aria-pressed', 'false')
    expect(ladoAusente(control)).toHaveAttribute('aria-pressed', 'false')
  })

  it('la tardanza es un estado propio, ni presente ni ausente', async () => {
    montar()
    await abrirClase()

    const control = controles()[0]
    fireEvent.click(ladoTardanza(control))

    await waitFor(() => expect(ladoTardanza(control)).toHaveAttribute('aria-pressed', 'true'), ESPERA)
    expect(ladoPresente(control)).toHaveAttribute('aria-pressed', 'false')
    expect(ladoAusente(control)).toHaveAttribute('aria-pressed', 'false')
    expect(marcar.mock.calls[0][0].registros[0]).toMatchObject({ estado: 'tardanza' })
  })

  it('una observación se guarda sin tocar el estado de asistencia', async () => {
    montar()
    await abrirClase()

    // Primero se marca; después se añade la nota.
    fireEvent.click(ladoAusente(controles()[0]))
    await waitFor(() => expect(ladoAusente(controles()[0])).toHaveAttribute('aria-pressed', 'true'), ESPERA)
    marcar.mockClear()

    fireEvent.click(screen.getAllByRole('button', { name: /observación de /i })[0])
    // Por nombre: en jsdom la barra de filtros colapsada también es un diálogo.
    const dialogo = await screen.findByRole('dialog', { name: /observación/i }, ESPERA)
    fireEvent.change(within(dialogo).getByLabelText(/motivo o justificación/i), {
      target: { value: 'Falta por enfermedad' },
    })
    fireEvent.click(within(dialogo).getByRole('button', { name: /guardar observación/i }))

    await waitFor(() => expect(marcar).toHaveBeenCalled(), ESPERA)
    // Solo viaja la observación: lo que se omite no se toca en el servidor,
    // así que la nota no borra el "ausente" de antes.
    const registro = marcar.mock.calls[0][0].registros[0]
    expect(registro.observacion).toBe('Falta por enfermedad')
    expect(registro.estado).toBeUndefined()
    await waitFor(() => expect(ladoAusente(controles()[0])).toHaveAttribute('aria-pressed', 'true'), ESPERA)
  })

  it('la observación se lee en solo lectura y con el último texto guardado', async () => {
    montar()
    await abrirClase()

    fireEvent.click(screen.getAllByRole('button', { name: /observación de /i })[0])
    let dialogo = await screen.findByRole('dialog', { name: /observación/i }, ESPERA)
    fireEvent.change(within(dialogo).getByLabelText(/motivo o justificación/i), { target: { value: 'Llegó con su madre' } })
    fireEvent.click(within(dialogo).getByRole('button', { name: /guardar observación/i }))
    await waitFor(() => expect(marcar).toHaveBeenCalled(), ESPERA)

    // Sin actividad: no se escribe, pero la nota existente se puede leer.
    act(() => useActividadStore.getState().limpiar())
    const globo = await screen.findByRole('button', { name: /^ver observación de /i }, ESPERA)
    expect(globo).toBeEnabled()
    fireEvent.click(globo)

    dialogo = await screen.findByRole('dialog', { name: /observación/i }, ESPERA)
    const texto = within(dialogo).getByLabelText(/motivo o justificación/i)
    expect(texto).toHaveValue('Llegó con su madre')
    expect(texto).toHaveAttribute('readonly')
    expect(within(dialogo).queryByRole('button', { name: /guardar observación/i })).not.toBeInTheDocument()
  })

  it('si otro dispositivo gana la carrera, se adopta lo del servidor', async () => {
    // El ítem vuelve ACEPTADA con `motivo: 'registro_mas_reciente'`, que no es
    // un error: la operación se procesó, solo que ya había algo posterior.
    // Revertir al valor anterior sería retroceder todavía más.
    marcar.mockImplementation(async ({ fecha, registros }) => ({
      clase: { id_clase: 12, tipo: 'habitual', etiqueta: 'Clase programada', fecha_original: fecha, fecha, aviso: null },
      resultados: registros.map((r) => ({
        id_operacion: r.id_operacion,
        estado: 'aceptada',
        motivo: 'registro_mas_reciente',
        detail: null,
        registro: { id_clase: 12, id_alumno: r.id_alumno, estado: 'tardanza', observacion: null },
      })),
    }))

    montar()
    await abrirClase()

    fireEvent.click(ladoPresente(controles()[0]))

    await waitFor(() => expect(ladoTardanza(controles()[0])).toHaveAttribute('aria-pressed', 'true'), ESPERA)
    expect(ladoPresente(controles()[0])).toHaveAttribute('aria-pressed', 'false')
  })

  it('"Marcar todos como presentes" respeta lo que ya se puso a mano', async () => {
    montar()
    await abrirClase()

    // Un ausente puesto a mano antes de la acción en lote.
    const primero = controles()[0]
    fireEvent.click(ladoAusente(primero))
    await waitFor(() => expect(ladoAusente(primero)).toHaveAttribute('aria-pressed', 'true'), ESPERA)

    fireEvent.click(screen.getByRole('button', { name: /marcar todos como presentes/i }))

    await waitFor(() => {
      const ahora = controles()
      // El primero sigue ausente: el lote no lo tocó.
      expect(ladoAusente(ahora[0])).toHaveAttribute('aria-pressed', 'true')
      expect(ladoPresente(ahora[1])).toHaveAttribute('aria-pressed', 'true')
    }, ESPERA)
  })

  it('sin actividad de trabajo bloquea los controles con el mensaje de CU022', async () => {
    useActividadStore.getState().limpiar()
    montar()
    await abrirClase()

    expect(
      screen.getByText('Debes iniciar una actividad de trabajo para registrar o modificar información.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /marcar todos como presentes/i })).not.toBeInTheDocument()
    expect(ladoPresente(controles()[0])).toBeDisabled()
  })

  it('el Supervisor entra en solo lectura y no ve la acción en lote', async () => {
    montar(ROLES.SUPERVISOR)
    await abrirClase()

    expect(screen.queryByRole('button', { name: /marcar todos como presentes/i })).not.toBeInTheDocument()

    const control = controles()[0]
    expect(ladoPresente(control)).toBeDisabled()
    fireEvent.click(ladoPresente(control))
    // Auto-save apagado del todo: ni PostgreSQL ni IndexedDB.
    expect(marcar).not.toHaveBeenCalled()
  })

  it('si el servidor rechaza la marca, el control vuelve atrás y avisa', async () => {
    const rechazo = new Error('rechazado')
    rechazo.response = { status: 422, data: { detail: 'No', motivo: 'conflicto' } }
    marcar.mockRejectedValue(rechazo)

    montar()
    await abrirClase()

    const control = controles()[0]
    fireEvent.click(ladoPresente(control))
    // Primero se pinta: el Auto-save es optimista a propósito.
    await waitFor(() => expect(ladoPresente(control)).toHaveAttribute('aria-pressed', 'true'), ESPERA)

    await screen.findByText(ERROR_SERVIDOR, {}, ESPERA)
    await waitFor(
      () => expect(ladoPresente(controles()[0])).toHaveAttribute('aria-pressed', 'false'),
      ESPERA,
    )
  })

  it('si no se puede apuntar en local, también vuelve atrás y lo dice', async () => {
    montar()
    await abrirClase()
    // A partir de aquí IndexedDB no acepta nada: es el "Error de persistencia"
    // de CU022. Sin botón de guardar, callarlo perdería el dato en silencio.
    fallaElDisco = true

    const control = controles()[0]
    fireEvent.click(ladoPresente(control))

    await screen.findByText(ERROR_LOCAL, {}, ESPERA)
    await waitFor(
      () => expect(ladoPresente(controles()[0])).toHaveAttribute('aria-pressed', 'false'),
      ESPERA,
    )
    expect(marcar).not.toHaveBeenCalled()
  })

  it('sin conexión la marca se queda pendiente, sin perderse ni avisar de error', async () => {
    montar()
    await abrirClase()

    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true })
    const control = controles()[0]
    fireEvent.click(ladoPresente(control))

    // Se pinta igual: el docente sigue trabajando sin enterarse del corte.
    await waitFor(() => expect(ladoPresente(control)).toHaveAttribute('aria-pressed', 'true'), ESPERA)
    // Queda esperando en la cola, que es lo que cuenta el Resumen de Acción
    // del Inicio, y NO se manda al servidor.
    await waitFor(() => expect(useSyncStore.getState().pendientes).toBe(1), ESPERA)
    expect(marcar).not.toHaveBeenCalled()
    expect(screen.queryByText(ERROR_SERVIDOR)).not.toBeInTheDocument()
    expect(screen.queryByText(ERROR_LOCAL)).not.toBeInTheDocument()

    Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true })
  })

  it('sin conexión, volver a la pantalla sigue mostrando la clase: no la vacía ni avisa de error', async () => {
    // La clase se pide fresca cada vez que se entra. Sin red, ese pedido no
    // puede borrar lo que ya se tenía: se sigue viendo la última lista.
    useSessionStore.setState({
      token: 'mock.4.2026',
      usuario: { id_usuario: 4, id_rol: ROLES.DOCENTE, id_docente: 1, nombres: 'Prueba' },
      cargando: false,
    })
    const client = crearQueryClient()
    const pantalla = (clave) => (
      <QueryClientProvider client={client}>
        <ToastProvider>
          <MemoryRouter>
            <AsistenciaPage key={clave} />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    )
    const { rerender } = render(pantalla('con-red'))
    await abrirClase()
    const antes = controles().length
    expect(antes).toBeGreaterThan(0)

    // Se corta la red y el docente sale y vuelve a entrar a la pantalla.
    sinRed = true
    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true })
    window.dispatchEvent(new Event('offline'))
    rerender(pantalla('sin-red'))

    await abrirFiltros()
    expect(await screen.findByRole('table', {}, ESPERA)).toBeInTheDocument()
    expect(controles()).toHaveLength(antes)
    expect(screen.queryByText(/sin alumnos en esta clase/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/no se pudo/i)).not.toBeInTheDocument()

    sinRed = false
    Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true })
    window.dispatchEvent(new Event('online'))
  })

  it('no deja elegir una fecha futura', async () => {
    montar()
    await abrirFiltros()
    const fecha = await screen.findByLabelText('Fecha', {}, ESPERA)
    const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date())
    expect(fecha).toHaveAttribute('max', hoy)
  })

  it('un día no lectivo no dibuja la lista y lo explica', async () => {
    montar()
    await abrirClase()

    // Un sábado del año escolar: ninguna semana lectiva lo contiene.
    fireEvent.change(await screen.findByLabelText('Fecha', {}, ESPERA), { target: { value: '2026-04-04' } })

    // El texto es el del SERVIDOR, no uno de la pantalla: el de
    // `fecha_no_lectiva` lleva dentro el motivo concreto —fin de semana, un
    // feriado, una suspensión— que el front no tiene forma de saber.
    await screen.findByText(/d[ií]a no lectivo/i, {}, ESPERA)
    expect(screen.queryByRole('button', { name: /marcar todos como presentes/i })).not.toBeInTheDocument()
  })
})
