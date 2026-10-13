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
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
vi.mock('../../../api/resources/asistencia', async (importOriginal) => {
  const original = await importOriginal()
  return { ...original, marcarAsistencia: (...args) => marcar(...args) }
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

/**
 * Elige la sección. Con dos aulas el desplegable nace VACÍO a propósito
 * (CU022, paso 3), así que hay que saltarse el marcador de posición.
 */
async function elegirSeccion() {
  const seccion = await screen.findByLabelText('Sección', {}, ESPERA)
  await waitFor(() => {
    const aulas = [...seccion.querySelectorAll('option')].filter((o) => o.value)
    expect(aulas.length).toBeGreaterThan(0)
  }, ESPERA)
  if (!seccion.value) {
    const primera = [...seccion.querySelectorAll('option')].find((o) => o.value)
    fireEvent.change(seccion, { target: { value: primera.value } })
  }
}

/** Deja los cinco filtros puestos y devuelve la lista ya pintada. */
async function abrirClase() {
  await abrirFiltros()
  await elegirSeccion()
  return screen.findByRole('table', {}, ESPERA)
}

/** Los grupos de botones Presente/Ausente que hay pintados ahora mismo. */
const controles = () => screen.getAllByRole('group', { name: /^Asistencia de / })

const ladoPresente = (control) => within(control).getByRole('button', { name: /^Presente: / })
const ladoAusente = (control) => within(control).getByRole('button', { name: /^Ausente: / })

beforeEach(() => {
  localStorage.clear()
  _reiniciarCola()
  fallaElDisco = false
  marcar.mockReset()
  marcar.mockResolvedValue({ ok: true })
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
    expect(marcar.mock.calls[0][0]).toMatchObject({ presente: true })
  })

  it('una clase nueva nace SIN MARCAR, que no es lo mismo que ausente', async () => {
    montar()
    await abrirClase()

    const control = controles()[0]
    expect(ladoPresente(control)).toHaveAttribute('aria-pressed', 'false')
    expect(ladoAusente(control)).toHaveAttribute('aria-pressed', 'false')
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
      screen.getByText('Inicia una actividad de trabajo para habilitar el registro de datos.'),
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

    await screen.findByText(
      'La fecha seleccionada no corresponde a un día lectivo válido del periodo vigente.',
      {},
      ESPERA,
    )
    expect(screen.queryByRole('button', { name: /marcar todos como presentes/i })).not.toBeInTheDocument()
  })
})
