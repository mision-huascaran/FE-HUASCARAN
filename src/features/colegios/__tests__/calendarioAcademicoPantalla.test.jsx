// CU027 — la pantalla del calendario académico: consulta, creación y edición
// (nunca a la vez), el 404 como "sin configurar", el calendario particular de
// un colegio y el aviso entero de `calendario_incompatible`.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { crearQueryClient } from '../../../App'
import { ToastProvider } from '../../../components/ui'
import { formatearFecha } from '../../../lib/format'
import CalendarioAcademico from '../CalendarioAcademico'

const obtenerCalendario = vi.fn()
const crearGeneral = vi.fn(async () => ({}))
const crearParticular = vi.fn(async () => ({}))
const actualizar = vi.fn(async () => ({}))
const volverAlGeneral = vi.fn(async () => ({}))

vi.mock('../../../api/resources/calendarios', async (importOriginal) => {
  const original = await importOriginal()
  return {
    ...original,
    obtenerCalendario: (...args) => obtenerCalendario(...args),
    crearCalendarioGeneral: (...args) => crearGeneral(...args),
    crearCalendarioParticular: (...args) => crearParticular(...args),
    actualizarCalendario: (...args) => actualizar(...args),
    volverAlGeneral: (...args) => volverAlGeneral(...args),
  }
})

vi.mock('../../../api/resources/administracion', async (importOriginal) => {
  const original = await importOriginal()
  return {
    ...original,
    listarAniosEscolares: async () => [
      { id: 1, nombre: '2025', vigente: false },
      { id: 2, nombre: '2026', vigente: true },
    ],
  }
})

const ESPERA = { timeout: 8000 }
const RANRAHIRCA = 'I.E. 86021 Ranrahirca'
const ANIVERSARIO = '2026-09-01'
const COLEGIOS = [
  { id_colegio: 1, nombre: RANRAHIRCA },
  { id_colegio: 2, nombre: 'I.E. 86024 Mancos' },
]

/** Las ocho filas con fechas, como las devuelve el servidor. */
const PERIODOS = [
  ['PA', 1, '2026-03-02', '2026-05-15'],
  ['PR', 1, '2026-05-18', '2026-05-22'],
  ['PA', 2, '2026-05-25', '2026-07-24'],
  ['PR', 2, '2026-07-27', '2026-08-07'],
  ['PA', 3, '2026-08-10', '2026-10-09'],
  ['PR', 3, '2026-10-12', '2026-10-16'],
  ['PA', 4, '2026-10-19', '2026-12-18'],
  ['PR', 4, '2026-12-21', '2026-12-31'],
].map(([tipo, numero, fecha_inicio, fecha_fin]) => ({ tipo, numero, fecha_inicio, fecha_fin }))

/** Cómo se ve en pantalla la primera fecha: con el mismo formato de la app. */
const INICIO_PA1 = formatearFecha(PERIODOS[0].fecha_inicio)
const EDITAR = 'Editar calendario'
const FIN_PA1 = 'Fin de PA1'

const calendario = (cambios = {}) => ({
  id_calendario: 7,
  version: 3,
  origen: 'general',
  periodos: PERIODOS,
  dias_no_lectivos: [{ motivo: 'Día del Maestro', fecha_inicio: '2026-07-06', fecha_fin: '2026-07-06', origen: 'automatico' }],
  ...cambios,
})

/** El error que da axios con el cuerpo del backend. */
const errorHttp = (status, data) => Object.assign(new Error(`HTTP ${status}`), { response: { status, data } })

function montar(onVolver = vi.fn()) {
  render(
    <QueryClientProvider client={crearQueryClient()}>
      <ToastProvider>
        <CalendarioAcademico colegios={COLEGIOS} onVolver={onVolver} />
      </ToastProvider>
    </QueryClientProvider>,
  )
  return onVolver
}

const boton = (nombre) => screen.getByRole('button', { name: nombre })

beforeEach(() => {
  for (const espia of [obtenerCalendario, crearGeneral, crearParticular, actualizar, volverAlGeneral]) espia.mockClear()
  Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true })
})

afterEach(() => {
  Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true })
})

describe('CU027 · Calendario académico', () => {
  it('consulta el calendario general del año vigente y vuelve a Colegios', async () => {
    obtenerCalendario.mockResolvedValue(calendario())
    const onVolver = montar()

    expect(await screen.findByText(INICIO_PA1, {}, ESPERA)).toBeInTheDocument()
    // D81 — Se consulta por AÑO CALENDARIO, para poder pedir uno que todavía
    // no existe y recibir el 404 que ofrece crearlo.
    expect(obtenerCalendario).toHaveBeenCalledWith({ anio: '2026', idColegio: undefined })
    expect(screen.getByText('PR4')).toBeInTheDocument()
    expect(screen.getByText('cargado por el sistema')).toBeInTheDocument()
    // En consulta no hay "Guardar": cada estado muestra solo sus acciones.
    expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument()
    expect(boton(EDITAR)).toBeEnabled()

    fireEvent.click(boton('Volver a Colegios'))
    expect(onVolver).toHaveBeenCalledTimes(1)
  })

  it('edita con la versión leída, añade y quita días no lectivos, y guarda', async () => {
    obtenerCalendario.mockResolvedValue(calendario())
    montar()
    fireEvent.click(await screen.findByRole('button', { name: EDITAR }, ESPERA))

    // En edición, el año y el alcance quedan fijos.
    expect(screen.getByLabelText(/^Año escolar/)).toBeDisabled()
    fireEvent.change(screen.getByLabelText(FIN_PA1), { target: { value: '2026-05-14' } })

    fireEvent.click(boton('Añadir día'))
    expect(boton('Guardar')).toBeDisabled() // un día sin motivo deja el calendario incompleto
    fireEvent.change(screen.getByLabelText('Motivo del día no lectivo 2'), { target: { value: 'Aniversario' } })
    fireEvent.change(screen.getByLabelText('Inicio del día no lectivo 2'), { target: { value: ANIVERSARIO } })
    fireEvent.change(screen.getByLabelText('Fin del día no lectivo 2'), { target: { value: ANIVERSARIO } })
    fireEvent.click(screen.getByRole('button', { name: 'Quitar el día no lectivo 1' }))

    fireEvent.click(boton('Guardar'))

    // D72 — Guardar el GENERAL ya no escribe directo: primero confirma,
    // porque mueve las fechas de todos los colegios que lo usan.
    await screen.findByRole('button', { name: 'Confirmar cambios' }, ESPERA)
    expect(actualizar).not.toHaveBeenCalled()
    fireEvent.click(boton('Confirmar cambios'))

    await waitFor(() => expect(actualizar).toHaveBeenCalledTimes(1), ESPERA)
    const [idCalendario, cuerpo] = actualizar.mock.calls[0]
    expect(idCalendario).toBe(7)
    expect(cuerpo.version).toBe(3)
    expect(cuerpo.periodos).toHaveLength(8)
    expect(cuerpo.periodos[0]).toEqual({ ...PERIODOS[0], fecha_fin: '2026-05-14' })
    expect(cuerpo.dias_no_lectivos).toEqual([{ motivo: 'Aniversario', fecha_inicio: ANIVERSARIO, fecha_fin: ANIVERSARIO }])
    expect(await screen.findByText('Calendario académico actualizado correctamente.', {}, ESPERA)).toBeInTheDocument()
  })

  it('ofrece el AÑO SIGUIENTE, que todavía no existe (D81)', async () => {
    /**
     * Era una lista de los años escolares ya creados, así que para configurar
     * 2027 hacía falta que 2027 existiera— y lo que lo crea es justo este
     * formulario. No había por dónde empezar.
     */
    obtenerCalendario.mockResolvedValue(calendario())
    montar()
    const filtro = await screen.findByLabelText('Año escolar', {}, ESPERA)
    const opciones = within(filtro).getAllByRole('option').map((o) => o.textContent)
    expect(opciones).toContain('2027')
  })

  it('sin haber cambiado nada, Cancelar cierra directo (D84)', async () => {
    /**
     * Una confirmación que no protege nada entrena a pulsarla sin leerla, y
     * así deja de proteger el caso en que sí importa.
     */
    obtenerCalendario.mockResolvedValue(calendario())
    montar()
    fireEvent.click(await screen.findByRole('button', { name: EDITAR }, ESPERA))
    fireEvent.click(boton('Cancelar'))

    // Vuelve a consulta sin preguntar.
    expect(await screen.findByRole('button', { name: EDITAR }, ESPERA)).toBeInTheDocument()
    expect(screen.queryByText('Tienes cambios sin guardar. Si continúas, se perderán.')).not.toBeInTheDocument()
  })

  it('Cancelar pregunta antes de descartar lo escrito (D72)', async () => {
    /**
     * El calendario no se encola ni se guarda en `localStorage`: lo escrito
     * vive solo en memoria. Si se pierde, se pierde, y por eso se pregunta.
     */
    obtenerCalendario.mockResolvedValue(calendario())
    montar()
    fireEvent.click(await screen.findByRole('button', { name: EDITAR }, ESPERA))
    // Algo escrito: sin cambios no hay nada que descartar (D84, abajo).
    fireEvent.change(screen.getByLabelText(FIN_PA1), { target: { value: '2026-05-20' } })
    fireEvent.click(boton('Cancelar'))

    await screen.findByText('Tienes cambios sin guardar. Si continúas, se perderán.', {}, ESPERA)
    fireEvent.click(boton('Seguir editando'))
    expect(screen.getByLabelText(FIN_PA1)).toBeInTheDocument()

    fireEvent.click(boton('Cancelar'))
    fireEvent.click(await screen.findByRole('button', { name: 'Descartar cambios' }, ESPERA))

    expect(await screen.findByRole('button', { name: EDITAR }, ESPERA)).toBeInTheDocument()
    expect(actualizar).not.toHaveBeenCalled()
  })

  it('un conflicto de versión bloquea Guardar y ofrece la versión actual (D75)', async () => {
    // El sistema NO combina ni sobrescribe: o se conserva lo escrito, o se
    // carga lo del servidor, y las dos son decisiones de la persona.
    obtenerCalendario.mockResolvedValue(calendario())
    actualizar.mockRejectedValueOnce(
      errorHttp(409, { detail: 'La configuración fue modificada.', motivo: 'modificacion_concurrente' }),
    )
    montar()
    fireEvent.click(await screen.findByRole('button', { name: EDITAR }, ESPERA))
    fireEvent.change(screen.getByLabelText(FIN_PA1), { target: { value: '2026-05-14' } })
    fireEvent.click(boton('Guardar'))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar cambios' }, ESPERA))

    await screen.findByText(/modificado por otro Supervisor/i, {}, ESPERA)
    expect(boton('Guardar')).toBeDisabled()

    fireEvent.click(boton('Consultar versión actual'))
    await screen.findByText('Lo que hay guardado en el servidor ahora mismo', {}, ESPERA)
  })

  /**
   * D75 — CP-CAL-07. Con el backend caído el proxy responde 502: el mensaje
   * era genérico y "Guardar" seguía activo, invitando a reenviar algo que
   * pudo haberse aplicado.
   */
  it('con el servidor caído no confirma el guardado y bloquea Guardar (D75)', async () => {
    obtenerCalendario.mockResolvedValue(calendario())
    actualizar.mockRejectedValueOnce(errorHttp(502, '<html>Bad Gateway</html>'))
    montar()
    fireEvent.click(await screen.findByRole('button', { name: EDITAR }, ESPERA))
    fireEvent.change(screen.getByLabelText(FIN_PA1), { target: { value: '2026-05-14' } })
    fireEvent.click(boton('Guardar'))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar cambios' }, ESPERA))

    await screen.findByText(/No se pudo confirmar el guardado/i, {}, ESPERA)
    expect(boton('Guardar')).toBeDisabled()
    // Lo escrito sigue ahí.
    expect(screen.getByLabelText(FIN_PA1)).toHaveValue('2026-05-14')
  })

  it('sin calendario (404) ofrece crearlo y exige las ocho fechas', async () => {
    obtenerCalendario.mockRejectedValue(errorHttp(404, { detail: 'No hay calendario', motivo: 'calendario_no_configurado' }))
    montar()

    expect(await screen.findByText('Sin calendario configurado', {}, ESPERA)).toBeInTheDocument()
    fireEvent.click(boton('Crear calendario'))
    expect(screen.getByText('Ninguno. Los feriados nacionales los carga el sistema.')).toBeInTheDocument()
    expect(boton('Guardar')).toBeDisabled()

    for (const { tipo, numero, fecha_inicio, fecha_fin } of PERIODOS) {
      fireEvent.change(screen.getByLabelText(`Inicio de ${tipo}${numero}`), { target: { value: fecha_inicio } })
      fireEvent.change(screen.getByLabelText(`Fin de ${tipo}${numero}`), { target: { value: fecha_fin } })
    }
    fireEvent.click(boton('Guardar'))

    await waitFor(() => expect(crearGeneral).toHaveBeenCalledTimes(1), ESPERA)
    // Con `anio` el backend crea el año escolar en la misma transacción.
    expect(crearGeneral.mock.calls[0][0]).toEqual({ anio: 2026, periodos: PERIODOS, dias_no_lectivos: [] })
    expect(crearParticular).not.toHaveBeenCalled()
  })

  it('muestra entera la lista de registros que estorban (calendario_incompatible)', async () => {
    obtenerCalendario.mockResolvedValue(calendario())
    actualizar.mockRejectedValueOnce(
      errorHttp(409, {
        detail: 'El cambio deja registros fuera de su periodo.',
        motivo: 'calendario_incompatible',
        incompatibilidades: [
          { colegio: { nombre: RANRAHIRCA }, fecha: '2026-05-15', tipo_registro: 'asistencia', mensaje: 'quedaría en un receso' },
        ],
      }),
    )
    montar()
    fireEvent.click(await screen.findByRole('button', { name: EDITAR }, ESPERA))
    fireEvent.change(screen.getByLabelText(FIN_PA1), { target: { value: '2026-05-08' } })
    fireEvent.click(boton('Guardar'))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar cambios' }, ESPERA))

    expect(await screen.findByText('El cambio afecta a registros existentes', {}, ESPERA)).toBeInTheDocument()
    expect(screen.getByText(/I.E. 86021 Ranrahirca · 15\/05\/2026 · asistencia — quedaría en un receso/)).toBeInTheDocument()
    // Sigue en edición: es una decisión que tomar, no un error que descartar.
    expect(boton('Guardar')).toBeInTheDocument()
  })

  it('por colegio: pide el colegio, crea fechas particulares sobre el general', async () => {
    obtenerCalendario.mockResolvedValue(calendario())
    montar()
    await screen.findByText(INICIO_PA1, {}, ESPERA)

    fireEvent.change(screen.getByLabelText(/^Alcance/), { target: { value: 'colegio' } })
    expect(await screen.findByText('Complete los filtros', {}, ESPERA)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/^Colegio/), { target: { value: '2' } })

    const usa = await screen.findByText(/Este colegio usa/, {}, ESPERA)
    expect(within(usa).getByText('el calendario general')).toBeInTheDocument()
    expect(obtenerCalendario).toHaveBeenLastCalledWith({ anio: '2026', idColegio: '2' })

    fireEvent.click(boton('Crear fechas particulares'))
    for (const { tipo, numero, fecha_inicio, fecha_fin } of PERIODOS) {
      fireEvent.change(screen.getByLabelText(`Inicio de ${tipo}${numero}`), { target: { value: fecha_inicio } })
      fireEvent.change(screen.getByLabelText(`Fin de ${tipo}${numero}`), { target: { value: fecha_fin } })
    }
    fireEvent.click(boton('Guardar'))

    await waitFor(() => expect(crearParticular).toHaveBeenCalledTimes(1), ESPERA)
    expect(crearParticular.mock.calls[0][0]).toEqual(expect.objectContaining({ id_colegio: 2, anio: 2026 }))
    expect(await screen.findByText('Calendario académico creado correctamente.', {}, ESPERA)).toBeInTheDocument()
  })

  it('un colegio con fechas particulares puede volver al calendario general', async () => {
    obtenerCalendario.mockImplementation(async ({ idColegio }) =>
      idColegio ? calendario({ id_calendario: 9, version: 1, origen: 'particular' }) : calendario(),
    )
    montar()
    await screen.findByText(INICIO_PA1, {}, ESPERA)
    fireEvent.change(screen.getByLabelText(/^Alcance/), { target: { value: 'colegio' } })
    fireEvent.change(screen.getByLabelText(/^Colegio/), { target: { value: '1' } })

    expect(await screen.findByText('fechas particulares', {}, ESPERA)).toBeInTheDocument()
    fireEvent.click(boton('Usar el calendario general'))

    /**
     * D72 — El colegio renuncia a sus fechas propias y vuelve a depender del
     * general, incluidos sus cambios futuros. Se confirma antes, diciendo
     * qué colegio y qué año.
     */
    await screen.findByText(/dejará de utilizar sus fechas particulares/i, {}, ESPERA)
    expect(volverAlGeneral).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /^confirmar$/i }))

    await waitFor(() => expect(volverAlGeneral).toHaveBeenCalledWith(9, 1), ESPERA)
    expect(await screen.findByText('Calendario académico actualizado correctamente.', {}, ESPERA)).toBeInTheDocument()
  })

  it('sin conexión avisa y no deja editar', async () => {
    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true })
    obtenerCalendario.mockResolvedValue(calendario())
    montar()

    expect(await screen.findByText(/Sin conexión. Estás consultando la última versión guardada del calendario/, {}, ESPERA)).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: EDITAR }, ESPERA)).toBeDisabled()
  })
})
