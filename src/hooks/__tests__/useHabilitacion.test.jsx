// ¿Puedo escribir aquí? (CU009, CU010, CU028)
//
// El orden importa: actividad abierta y referencia temporal van ANTES que la
// autorización; con conexión manda el bloque `escritura` del servidor, y sin
// él se deduce del paquete de `GET /me/habilitaciones` guardado.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import useHabilitacion, { MOTIVO_LOCAL } from '../useHabilitacion'
import { MOTIVO, TEXTO_MOTIVO } from '../../auth/habilitaciones'
import { SIN_REFERENCIA_TEMPORAL } from '../../lib/relojServidor'
import useActividadStore from '../../store/actividadStore'

const PAQUETE = { generado_en: '2026-10-22T12:00:00Z', asignaciones: [], permisos: [], calendarios: [] }
const INSTANTE = new Date('2026-10-22T15:00:00Z')

const habilitacionPara = vi.fn()
const continuidad = vi.fn(() => true)

vi.mock('../../api/resources/habilitaciones', () => ({
  obtenerMisHabilitaciones: vi.fn(async () => PAQUETE),
}))

vi.mock('../../auth/habilitaciones', async (importOriginal) => ({
  ...(await importOriginal()),
  habilitacionPara: (...args) => habilitacionPara(...args),
}))

vi.mock('../../lib/relojServidor', async (importOriginal) => ({
  ...(await importOriginal()),
  hayContinuidad: () => continuidad(),
  ahora: () => INSTANTE,
}))

const GRUPO = { modulo: 'asistencias', idColegio: 1, idGrado: 2, fecha: '2026-10-22' }

function usar(props) {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const envoltorio = ({ children }) => <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
  return renderHook(() => useHabilitacion(props), { wrapper: envoltorio })
}

const conRed = (enLinea) => Object.defineProperty(window.navigator, 'onLine', { value: enLinea, configurable: true })

beforeEach(() => {
  habilitacionPara.mockReset()
  continuidad.mockReturnValue(true)
  conRed(true)
  useActividadStore.setState({ sesion: { id_actividad: 'a1' } })
})

afterEach(() => {
  conRed(true)
  useActividadStore.setState({ sesion: null })
})

describe('useHabilitacion', () => {
  it('sin actividad abierta no se escribe, aunque el grupo sea suyo (CU010)', () => {
    useActividadStore.setState({ sesion: null })
    const { result } = usar({ ...GRUPO, escrituraDelServidor: { permitida: true, motivo: MOTIVO.ASIGNACION } })

    expect(result.current).toEqual({
      permitida: false,
      motivo: MOTIVO_LOCAL.SIN_ACTIVIDAD,
      texto: 'Inicia una actividad de trabajo para habilitar el registro de datos.',
      id_permiso: null,
      id_periodo_academico: null,
    })
  })

  it('sin conexión y sin referencia temporal verificable tampoco', () => {
    conRed(false)
    continuidad.mockReturnValue(false)
    const { result } = usar(GRUPO)

    expect(result.current).toMatchObject({
      permitida: false,
      motivo: MOTIVO_LOCAL.SIN_REFERENCIA,
      texto: SIN_REFERENCIA_TEMPORAL,
    })
  })

  it('con conexión manda el bloque `escritura` del servidor', () => {
    const permitido = usar({ ...GRUPO, escrituraDelServidor: { permitida: true, motivo: MOTIVO.PERMISO, id_permiso: 33 } })
    expect(permitido.result.current).toMatchObject({ permitida: true, motivo: MOTIVO.PERMISO, texto: null, id_permiso: 33 })

    const negado = usar({ ...GRUPO, escrituraDelServidor: { permitida: false, motivo: MOTIVO.SIN_HABILITACION } })
    expect(negado.result.current).toMatchObject({
      permitida: false,
      texto: TEXTO_MOTIVO[MOTIVO.SIN_HABILITACION],
      id_permiso: null,
    })
    expect(habilitacionPara).not.toHaveBeenCalled()
  })

  it('sin grupo o fecha completos no hay habilitación', () => {
    const { result } = usar({ ...GRUPO, fecha: null })
    expect(result.current).toMatchObject({ permitida: false, motivo: MOTIVO.SIN_HABILITACION })
  })

  it('sin bloque del servidor deduce del paquete guardado, con la hora del servidor', async () => {
    habilitacionPara.mockImplementation(({ habilitaciones }) =>
      habilitaciones
        ? { permitida: true, motivo: MOTIVO.ASIGNACION, id_periodo_academico: 5 }
        : { permitida: false, motivo: MOTIVO.SIN_HABILITACION },
    )
    const { result } = usar(GRUPO)

    await waitFor(() => expect(result.current.permitida).toBe(true))
    expect(result.current).toEqual({
      permitida: true,
      motivo: MOTIVO.ASIGNACION,
      texto: null,
      id_permiso: null,
      id_periodo_academico: 5,
    })
    expect(habilitacionPara).toHaveBeenLastCalledWith({
      habilitaciones: PAQUETE,
      modulo: 'asistencias',
      idColegio: 1,
      idGrado: 2,
      fecha: '2026-10-22',
      instante: INSTANTE,
    })
  })

  it('una pantalla de consulta no exige actividad', () => {
    useActividadStore.setState({ sesion: null })
    const { result } = usar({ ...GRUPO, exigeActividad: false, escrituraDelServidor: { permitida: true, motivo: MOTIVO.ASIGNACION } })
    expect(result.current.permitida).toBe(true)
  })
})
