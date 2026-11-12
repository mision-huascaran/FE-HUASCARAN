// ¿Puedo escribir aquí? (CU009, CU010, CU028)
//
// El orden importa: actividad abierta y referencia temporal van ANTES que la
// autorización; con conexión manda el bloque `escritura` del servidor, y sin
// él se deduce del paquete de `GET /me/habilitaciones` guardado.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import useHabilitacion, { MOTIVO_LOCAL, SIN_HABILITACION_VERIFICABLE } from '../useHabilitacion'
import { MOTIVO, TEXTO_MOTIVO } from '../../auth/habilitaciones'
import { SIN_REFERENCIA_TEMPORAL } from '../../lib/relojServidor'
import useActividadStore from '../../store/actividadStore'
import useSessionStore from '../../store/sessionStore'
import { ROLES } from '../../auth/roles'
import { obtenerMisHabilitaciones } from '../../api/resources/habilitaciones'

const PAQUETE = { generado_en: '2026-10-22T12:00:00Z', asignaciones: [], permisos: [], calendarios: [] }
const INSTANTE = new Date('2026-10-22T15:00:00Z')

const habilitacionPara = vi.fn()
const continuidad = vi.fn(() => true)
const guardadas = vi.fn(async () => null)

vi.mock('../../api/resources/habilitaciones', () => ({
  obtenerMisHabilitaciones: vi.fn(async () => PAQUETE),
  habilitacionesGuardadas: () => guardadas(),
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
  guardadas.mockReset()
  guardadas.mockResolvedValue(null)
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
      texto: 'Debes iniciar una actividad de trabajo para registrar o modificar información.',
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

  describe('sin conexión (D95)', () => {
    it('sin el paquete en IndexedDB bloquea con el literal de CU009 y CU022', async () => {
      conRed(false)
      const { result } = usar({ ...GRUPO, escrituraDelServidor: { permitida: true, motivo: MOTIVO.ASIGNACION } })

      // Mientras se busca, bloqueado y sin texto.
      expect(result.current).toMatchObject({ permitida: false, motivo: MOTIVO_LOCAL.POR_VERIFICAR, texto: null })
      await waitFor(() => expect(result.current.motivo).toBe(MOTIVO_LOCAL.NO_VERIFICABLE))
      expect(result.current.texto).toBe(SIN_HABILITACION_VERIFICABLE)
      expect(habilitacionPara).not.toHaveBeenCalled()
    })

    it('con el paquete en IndexedDB decide con él, no con el `escritura` en caché', async () => {
      conRed(false)
      guardadas.mockResolvedValue(PAQUETE)
      habilitacionPara.mockReturnValue({ permitida: false, motivo: MOTIVO.SIN_HABILITACION })
      const { result } = usar({ ...GRUPO, escrituraDelServidor: { permitida: true, motivo: MOTIVO.ASIGNACION } })

      await waitFor(() => expect(result.current.motivo).toBe(MOTIVO.SIN_HABILITACION))
      expect(result.current.permitida).toBe(false)
      expect(habilitacionPara).toHaveBeenLastCalledWith(expect.objectContaining({ habilitaciones: PAQUETE }))
    })
  })
})

/**
 * `GET /me/habilitaciones` es solo del Docente: al Supervisor el servidor le
 * responde 403, y quedaba un error en la consola cada vez que abría Asistencias.
 */
describe('useHabilitacion según el rol', () => {
  beforeEach(() => habilitacionPara.mockReturnValue({ permitida: false, motivo: MOTIVO.SIN_HABILITACION }))
  afterEach(() => useSessionStore.setState({ usuario: null }))

  it('al Supervisor no le pide el paquete del Docente', async () => {
    obtenerMisHabilitaciones.mockClear()
    useSessionStore.setState({ usuario: { id_usuario: 4, id_rol: ROLES.JEFA } })
    usar({ ...GRUPO, exigeActividad: false })
    await new Promise((r) => setTimeout(r, 20))
    expect(obtenerMisHabilitaciones).not.toHaveBeenCalled()
  })

  it('al Docente sí', async () => {
    obtenerMisHabilitaciones.mockClear()
    useSessionStore.setState({ usuario: { id_usuario: 7, id_rol: ROLES.PROFESOR } })
    usar({ ...GRUPO, exigeActividad: false })
    await waitFor(() => expect(obtenerMisHabilitaciones).toHaveBeenCalled())
  })
})
