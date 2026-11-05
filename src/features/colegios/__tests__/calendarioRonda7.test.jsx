// Ronda 7 de QA en el Calendario académico (CU027).
//
// D116 — Más de 12 meses: el backend responde 422 con el error en
// `periodos.7.fecha_fin`, y tiene que verse junto al fin del PR4 (general y
// particular). El front lo detecta antes de enviar con la misma regla y texto.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { crearQueryClient } from '../../../App'
import { ToastProvider } from '../../../components/ui'
import { formatearFecha } from '../../../lib/format'
import CalendarioAcademico, { MAS_DE_DOCE_MESES, erroresDeDuracion } from '../CalendarioAcademico'

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

/** Los años que devuelve el catálogo. Mutable: una prueba necesita que NINGUNO
 *  esté vigente, que es el caso que CU027 resuelve dejando el filtro vacío. */
const CON_VIGENTE = [
  { id: 1, nombre: '2025', vigente: false },
  { id: 2, nombre: '2026', vigente: true },
]
let aniosEscolares = CON_VIGENTE

vi.mock('../../../api/resources/administracion', async (importOriginal) => {
  const original = await importOriginal()
  return {
    ...original,
    listarAniosEscolares: async () => aniosEscolares,
  }
})

const ESPERA = { timeout: 8000 }
const RANRAHIRCA = 'I.E. 86021 Ranrahirca'
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
  // Los filtros se guardan entre visitas (D70): sin limpiarlos, una prueba
  // heredaría el año que eligió la anterior.
  localStorage.clear()
  aniosEscolares = CON_VIGENTE
})

afterEach(() => {
  Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true })
})

const FIN_PR4 = 'Fin de PR4'

/** El mensaje está en la MISMA celda que el campo, no en un aviso general. */
async function errorJuntoA(etiqueta, texto) {
  const celda = (await screen.findByLabelText(etiqueta, {}, ESPERA)).closest('td')
  await waitFor(() => expect(within(celda).getByText(texto)).toBeInTheDocument(), ESPERA)
}

const doceMeses = () =>
  errorHttp(422, {
    detail: MAS_DE_DOCE_MESES,
    motivo: 'validacion',
    errores: [{ campo: 'periodos.7.fecha_fin', mensaje: MAS_DE_DOCE_MESES }],
  })

async function verColegio(id) {
  fireEvent.change(screen.getByLabelText(/^Alcance/), { target: { value: 'colegio' } })
  fireEvent.change(screen.getByLabelText(/^Colegio/), { target: { value: id } })
}

describe('D116 · más de 12 meses junto al fin del PR4', () => {
  it('calendario general: el 422 del servidor se pinta junto a "Fin de PR4"', async () => {
    obtenerCalendario.mockResolvedValue(calendario())
    actualizar.mockRejectedValueOnce(doceMeses())
    montar()
    fireEvent.click(await screen.findByRole('button', { name: EDITAR }, ESPERA))
    fireEvent.change(screen.getByLabelText(FIN_PA1), { target: { value: '2026-05-14' } })
    fireEvent.click(boton('Guardar'))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar cambios' }, ESPERA))

    await errorJuntoA(FIN_PR4, MAS_DE_DOCE_MESES)
    expect(within(screen.getByLabelText(FIN_PA1).closest('td')).queryByText(MAS_DE_DOCE_MESES)).not.toBeInTheDocument()
  })

  it('calendario particular de un colegio: igual', async () => {
    obtenerCalendario.mockImplementation(async ({ idColegio }) =>
      idColegio ? calendario({ id_calendario: 9, version: 1, origen: 'particular' }) : calendario(),
    )
    actualizar.mockRejectedValueOnce(doceMeses())
    montar()
    await screen.findByText(INICIO_PA1, {}, ESPERA)
    await verColegio('1')
    fireEvent.click(await screen.findByRole('button', { name: EDITAR }, ESPERA))
    fireEvent.change(screen.getByLabelText(FIN_PA1), { target: { value: '2026-05-14' } })
    fireEvent.click(boton('Guardar'))

    await waitFor(() => expect(actualizar).toHaveBeenCalledTimes(1), ESPERA)
    await errorJuntoA(FIN_PR4, MAS_DE_DOCE_MESES)
  })

  it('lo detecta antes de enviar, con el mismo texto y en el mismo campo', async () => {
    obtenerCalendario.mockResolvedValue(calendario())
    montar()
    fireEvent.click(await screen.findByRole('button', { name: EDITAR }, ESPERA))
    // PA1 empieza el 02/03/2026: el PR4 tiene que terminar antes del 01/03/2027.
    fireEvent.change(screen.getByLabelText(FIN_PR4), { target: { value: '2027-03-01' } })
    fireEvent.click(boton('Guardar'))

    await errorJuntoA(FIN_PR4, MAS_DE_DOCE_MESES)
    expect(screen.queryByRole('button', { name: 'Confirmar cambios' })).not.toBeInTheDocument()
    expect(actualizar).not.toHaveBeenCalled()
  })

  it('la regla: el último día válido es el anterior al 1 del mismo mes del año siguiente', () => {
    const conFinDePR4 = (fin) => PERIODOS.map((p, i) => (i === 7 ? { ...p, fecha_fin: fin } : p))
    expect(erroresDeDuracion(conFinDePR4('2027-02-28'))).toEqual({})
    expect(erroresDeDuracion(conFinDePR4('2027-03-01'))).toEqual({ 'periodos.7.fecha_fin': MAS_DE_DOCE_MESES })
    // Incompleto: no hay con qué medir y no se adelanta nada.
    expect(erroresDeDuracion(conFinDePR4(''))).toEqual({})
  })
})
